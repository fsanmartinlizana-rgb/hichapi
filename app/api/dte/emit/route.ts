export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { runEmission } from '@/lib/dte/engine'

// ══════════════════════════════════════════════════════════════════════════════
//  POST /api/dte/emit  — emit a boleta/factura for a paid order
//
//  Flow:
//    1. Validate inputs (restaurant, order, factura receptor)
//    2. Insert emission row in 'pending' status
//    3. Call runEmission() — full pipeline: folio → sign → SII submit
//    4. Return { folio, track_id, signed_xml } on success or error with status
//
//  Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
// ══════════════════════════════════════════════════════════════════════════════

// ── Error code → HTTP status mapping ─────────────────────────────────────────

function emissionErrorStatus(errorCode: string): number {
  if (errorCode === 'ORDER_NOT_PAID')             return 400
  if (errorCode === 'DUPLICATE_EMISSION')         return 409
  if (errorCode === 'NO_CAF_AVAILABLE')           return 400
  if (errorCode === 'CERT_NOT_FOUND')             return 400
  if (errorCode === 'CERT_EXPIRED')               return 400
  if (errorCode === 'SII_AUTH_ERROR')             return 502
  if (errorCode.startsWith('SII_SCHEMA_ERROR'))   return 422
  if (errorCode === 'SII_TIMEOUT')                return 504
  if (errorCode === 'RECEPTOR_RUT_INVALIDO')      return 400
  if (errorCode === 'RECEPTOR_DATOS_INCOMPLETOS') return 400
  if (errorCode === 'REFERENCIA_INCOMPLETA')      return 400
  return 500
}

// ── Request schema ────────────────────────────────────────────────────────────

const EmitSchema = z.object({
  restaurant_id:  z.string().uuid(),
  order_id:       z.string().uuid(),
  document_type:  z.union([z.literal(39), z.literal(41), z.literal(33), z.literal(56), z.literal(61)]),
  rut_receptor:   z.string().max(20).nullable().optional(),
  razon_receptor: z.string().max(200).nullable().optional(),
  // Receptor fields for facturas (33, 56, 61)
  giro_receptor:      z.string().max(100).nullable().optional(),
  direccion_receptor: z.string().max(70).nullable().optional(),
  comuna_receptor:    z.string().max(40).nullable().optional(),
  // Factura-specific fields
  fma_pago:           z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  descuento_global:   z.number().int().nonnegative().optional(),
  // Line items (optional — falls back to order_items)
  items: z.array(z.object({
    name:          z.string(),
    quantity:      z.number(),
    unit_price:    z.number(),
    cod_imp_adic:  z.number().int().optional(),
    ind_exe:       z.literal(1).optional(),
  })).optional(),
  // Reference fields for notas de crédito/débito (56, 61)
  tipo_doc_ref: z.number().int().optional(),
  folio_ref:    z.number().int().positive().optional(),
  fch_ref:      z.string().optional(),
  cod_ref:      z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  razon_ref:    z.string().max(90).optional(),
})

// Chilean IVA rate
const IVA_RATE = 0.19

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: z.infer<typeof EmitSchema>
  try {
    body = EmitSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { user, error: authErr } = await requireRestaurantRole(
    body.restaurant_id,
    ['owner', 'admin', 'supervisor', 'cajero']
  )
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No auth' }, { status: 401 })

  // ── Factura / nota validations ────────────────────────────────────────────
  const isFactura = body.document_type === 33 || body.document_type === 56 || body.document_type === 61

  if (isFactura) {
    // Validate RUT format (strip dots first)
    const rutStripped = (body.rut_receptor ?? '').replace(/\./g, '')
    if (!rutStripped || !/^\d{7,8}-[\dkK]$/.test(rutStripped)) {
      return NextResponse.json({ error: 'RECEPTOR_RUT_INVALIDO' }, { status: 400 })
    }

    // For type 33: all receptor fields are required
    if (body.document_type === 33) {
      const missing =
        !body.rut_receptor?.trim() ||
        !body.razon_receptor?.trim() ||
        !body.giro_receptor?.trim() ||
        !body.direccion_receptor?.trim() ||
        !body.comuna_receptor?.trim()

      if (missing) {
        return NextResponse.json({ error: 'RECEPTOR_DATOS_INCOMPLETOS' }, { status: 400 })
      }
    }
  }

  // For notas (56, 61): reference fields are required
  if (body.document_type === 56 || body.document_type === 61) {
    const missingRef =
      body.tipo_doc_ref === undefined ||
      body.folio_ref === undefined ||
      body.cod_ref === undefined ||
      !body.razon_ref?.trim()

    if (missingRef) {
      return NextResponse.json({ error: 'REFERENCIA_INCOMPLETA' }, { status: 400 })
    }
  }

  const supabase = createAdminClient()

  // Verify restaurant has DTE enabled and required tax data
  const { data: rest } = await supabase
    .from('restaurants')
    .select('rut, razon_social, dte_enabled, dte_environment')
    .eq('id', body.restaurant_id)
    .single()

  if (!rest) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }
  if (!rest.dte_enabled) {
    return NextResponse.json({ error: 'DTE no habilitado para este restaurante' }, { status: 400 })
  }
  if (!rest.rut || !rest.razon_social) {
    return NextResponse.json({ error: 'Falta RUT o razón social del emisor' }, { status: 400 })
  }

  // Verify order exists and belongs to this restaurant
  const { data: order } = await supabase
    .from('orders')
    .select('id, total, status, restaurant_id')
    .eq('id', body.order_id)
    .single()

  if (!order || order.restaurant_id !== body.restaurant_id) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  // Compute net + IVA from gross total
  const total = order.total
  const net   = Math.round(total / (1 + IVA_RATE))
  const iva   = total - net

  // Insert emission row in 'pending' status before running the pipeline
  const { data: emission, error: insertErr } = await supabase
    .from('dte_emissions')
    .insert({
      restaurant_id:      body.restaurant_id,
      order_id:           body.order_id,
      document_type:      body.document_type,
      rut_emisor:         rest.rut,
      rut_receptor:       body.rut_receptor ?? null,
      razon_receptor:     body.razon_receptor ?? null,
      giro_receptor:      body.giro_receptor ?? null,
      direccion_receptor: body.direccion_receptor ?? null,
      comuna_receptor:    body.comuna_receptor ?? null,
      fma_pago:           body.fma_pago ?? null,
      // Reference fields for notas (56/61)
      tipo_doc_ref:       body.tipo_doc_ref ?? null,
      folio_ref:          body.folio_ref ?? null,
      fch_ref:            body.fch_ref ?? null,
      cod_ref:            body.cod_ref ?? null,
      razon_ref:          body.razon_ref ?? null,
      net_amount:         net,
      iva_amount:         iva,
      total_amount:       total,
      status:             'pending',
      emitted_by:         user.id,
    })
    .select('id')
    .single()

  if (insertErr || !emission) {
    console.error('dte/emit insert error:', insertErr)
    return NextResponse.json({ error: 'No se pudo crear la emisión' }, { status: 500 })
  }

  // Run the full emission pipeline
  const result = await runEmission(
    emission.id,
    body.restaurant_id,
    body.order_id,
    body.document_type,
    body.rut_receptor ?? undefined,
    body.razon_receptor ?? undefined,
    body.giro_receptor ?? undefined,
    body.direccion_receptor ?? undefined,
    body.comuna_receptor ?? undefined,
    body.fma_pago ?? undefined,
    body.items ?? undefined,
    body.descuento_global ?? undefined,
    body.tipo_doc_ref ?? undefined,
    body.folio_ref ?? undefined,
    body.fch_ref ?? undefined,
    body.cod_ref ?? undefined,
    body.razon_ref ?? undefined,
  )

  if (!result.ok) {
    const errorCode = result.error ?? 'EMISSION_FAILED'
    return NextResponse.json(
      { error: errorCode, emission_id: emission.id },
      { status: emissionErrorStatus(errorCode) }
    )
  }

  return NextResponse.json({
    ok:         true,
    emission_id: emission.id,
    folio:      result.folio,
    track_id:   result.track_id,
    signed_xml: result.signed_xml,
  })
}
