import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ══════════════════════════════════════════════════════════════════════════════
//  POST /api/dte/emit  — emit a boleta/factura for an order
//
//  Sprint 13 SCAFFOLD: this endpoint validates inputs, reserves a folio via
//  the dte_take_next_folio RPC, and inserts a 'draft' emission row. Actual SII
//  XML signing + webservice submission is wired in a follow-up sprint once we
//  have a real PFX in cert env.
//
//  Pipeline (current → planned):
//    draft   ← we are here (folio reserved, totals frozen)
//    signed  ← will sign XML with PFX (lib/dte/sign.ts)
//    sent    ← submitted to SII webservice, sii_track_id stored
//    accepted/rejected ← polled from SII
// ══════════════════════════════════════════════════════════════════════════════

// Allowed Chilean DTE document types
const DOC_TYPES = {
  39: 'Boleta electrónica',
  41: 'Boleta exenta',
  33: 'Factura electrónica',
} as const

const EmitSchema = z.object({
  restaurant_id: z.string().uuid(),
  order_id:      z.string().uuid(),
  document_type: z.union([z.literal(39), z.literal(41), z.literal(33)]),
  rut_receptor:  z.string().max(20).nullable().optional(),
  razon_receptor: z.string().max(200).nullable().optional(),
})

// Chilean IVA rate
const IVA_RATE = 0.19

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

  // Factura requires receptor
  if (body.document_type === 33 && (!body.rut_receptor || !body.razon_receptor)) {
    return NextResponse.json(
      { error: 'Factura requiere RUT y razón social del receptor' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify the restaurant has DTE enabled and tax data set
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

  // Fetch order totals (must be paid)
  const { data: order } = await supabase
    .from('orders')
    .select('id, total, status, restaurant_id')
    .eq('id', body.order_id)
    .single()

  if (!order || order.restaurant_id !== body.restaurant_id) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }
  if (order.status !== 'paid') {
    return NextResponse.json({ error: 'El pedido debe estar pagado para emitir DTE' }, { status: 400 })
  }

  // Prevent double emission for the same order
  const { data: existing } = await supabase
    .from('dte_emissions')
    .select('id, folio, document_type, status')
    .eq('order_id', body.order_id)
    .neq('status', 'cancelled')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Este pedido ya tiene un DTE emitido', emission: existing },
      { status: 409 }
    )
  }

  // Compute net + IVA from gross total (Chilean boletas show gross)
  const total = order.total
  const net   = Math.round(total / (1 + IVA_RATE))
  const iva   = total - net

  // Reserve next folio atomically
  const { data: folioData, error: folioErr } = await supabase.rpc('dte_take_next_folio', {
    p_restaurant_id: body.restaurant_id,
    p_document_type: body.document_type,
  })

  if (folioErr || !folioData || folioData.length === 0) {
    return NextResponse.json(
      { error: folioErr?.message?.includes('NO_CAF_AVAILABLE')
          ? 'No hay folios disponibles. Sube un CAF del SII.'
          : 'No se pudo reservar folio' },
      { status: 400 }
    )
  }

  const { caf_id, folio } = folioData[0]

  // Insert draft emission
  const { data: emission, error: insertErr } = await supabase
    .from('dte_emissions')
    .insert({
      restaurant_id:  body.restaurant_id,
      order_id:       body.order_id,
      document_type:  body.document_type,
      folio,
      caf_id,
      rut_emisor:     rest.rut,
      rut_receptor:   body.rut_receptor ?? null,
      razon_receptor: body.razon_receptor ?? null,
      net_amount:     net,
      iva_amount:     iva,
      total_amount:   total,
      status:         'draft',
      emitted_by:     user.id,
    })
    .select()
    .single()

  if (insertErr || !emission) {
    console.error('dte/emit insert error:', insertErr)
    return NextResponse.json({ error: 'No se pudo crear la emisión' }, { status: 500 })
  }

  // TODO Sprint 13b: sign XML, submit to SII, poll for acceptance
  return NextResponse.json({
    ok:        true,
    emission,
    doc_label: DOC_TYPES[body.document_type],
    note:      'Emisión registrada en estado draft. Firma XML + envío SII pendiente de configuración.',
  })
}
