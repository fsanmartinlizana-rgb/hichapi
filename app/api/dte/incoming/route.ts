export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { loadCredentials } from '@/lib/dte/signer'
import { buildRecepcionDteXml, buildEnvioRecibosXml, buildResultadoDteXml } from '@/lib/dte/aec-builder'
import { sendBrandedEmail } from '@/lib/email/sender'
import { aecEmail } from '@/lib/email/templates'

// ══════════════════════════════════════════════════════════════════════════════
//  /api/dte/incoming  — Facturas recibidas de proveedores
//
//  GET  ?restaurant_id=...&status=...&limit=...
//       Lista las facturas recibidas con filtro opcional por estado.
//
//  POST (registro manual o desde integración)
//       Registra una nueva factura recibida de un proveedor.
//
//  PATCH (aceptar / rechazar / reclamar)
//       Actualiza el estado de recepción de una factura recibida.
//       Body: { restaurant_id, id, reception_status, reception_glosa? }
//
//  Plazo legal: 8 días corridos desde la recepción para aceptar/rechazar.
// ══════════════════════════════════════════════════════════════════════════════

// ── Schemas ───────────────────────────────────────────────────────────────────

const IncomingCreateSchema = z.object({
  restaurant_id:  z.string().uuid(),
  rut_emisor:     z.string().min(1).max(20),
  razon_emisor:   z.string().min(1).max(200),
  giro_emisor:    z.string().max(100).optional(),
  email_emisor:   z.string().email().optional(),
  document_type:  z.literal(33).default(33),
  folio:          z.number().int().positive(),
  fecha_emision:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  total_amount:   z.number().int().positive(),
  net_amount:     z.number().int().nonnegative().optional(),
  iva_amount:     z.number().int().nonnegative().optional(),
  xml_content:    z.string().optional(),
  pdf_url:        z.string().url().optional(),
})

const IncomingUpdateSchema = z.object({
  restaurant_id:    z.string().uuid(),
  id:               z.string().uuid(),
  reception_status: z.enum(['aceptado', 'rechazado', 'reclamado']),
  reception_glosa:  z.string().max(500).optional(),
})

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  const status       = req.nextUrl.searchParams.get('status')
  const limit        = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200)

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(
    restaurantId,
    ['owner', 'admin', 'supervisor', 'cajero']
  )
  if (authErr) return authErr

  const supabase = createAdminClient()

  let query = supabase
    .from('dte_incoming_invoices')
    .select(`
      id, rut_emisor, razon_emisor, giro_emisor, email_emisor,
      document_type, folio, fecha_emision, total_amount, net_amount, iva_amount,
      reception_status, reception_glosa, reception_date, received_at, pdf_url
    `)
    .eq('restaurant_id', restaurantId)
    .order('received_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('reception_status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('dte/incoming GET error:', error)
    return NextResponse.json({ error: 'Error consultando facturas recibidas' }, { status: 500 })
  }

  // Calcular días restantes para actuar (plazo legal: 8 días corridos)
  const now = Date.now()
  const invoices = (data ?? []).map((inv: any) => {
    const receivedMs  = new Date(inv.received_at).getTime()
    const diasTranscurridos = Math.floor((now - receivedMs) / (1000 * 60 * 60 * 24))
    const diasRestantes     = Math.max(0, 8 - diasTranscurridos)
    const vencido           = inv.reception_status === 'pendiente' && diasTranscurridos >= 8
    return { ...inv, dias_restantes: diasRestantes, vencido }
  })

  return NextResponse.json({ invoices })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: z.infer<typeof IncomingCreateSchema>
  try {
    body = IncomingCreateSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { user, error: authErr } = await requireRestaurantRole(
    body.restaurant_id,
    ['owner', 'admin', 'supervisor']
  )
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No auth' }, { status: 401 })

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('dte_incoming_invoices')
    .insert({
      restaurant_id:  body.restaurant_id,
      rut_emisor:     body.rut_emisor,
      razon_emisor:   body.razon_emisor,
      giro_emisor:    body.giro_emisor ?? null,
      email_emisor:   body.email_emisor ?? null,
      document_type:  body.document_type,
      folio:          body.folio,
      fecha_emision:  body.fecha_emision,
      total_amount:   body.total_amount,
      net_amount:     body.net_amount ?? null,
      iva_amount:     body.iva_amount ?? null,
      xml_content:    body.xml_content ?? null,
      pdf_url:        body.pdf_url ?? null,
      reception_status: 'pendiente',
    })
    .select('id, folio, rut_emisor, razon_emisor, reception_status, received_at')
    .single()

  if (error) {
    // Unique constraint violation = factura duplicada
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'FACTURA_DUPLICADA', message: 'Ya existe una factura con ese folio y emisor' },
        { status: 409 }
      )
    }
    console.error('dte/incoming POST error:', error)
    return NextResponse.json({ error: 'No se pudo registrar la factura' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, invoice: data }, { status: 201 })
}

// ── PATCH — aceptar / rechazar / reclamar ─────────────────────────────────────

export async function PATCH(req: NextRequest) {
  let body: z.infer<typeof IncomingUpdateSchema>
  try {
    body = IncomingUpdateSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(
    body.restaurant_id,
    ['owner', 'admin', 'supervisor']
  )
  if (authErr) return authErr

  const supabase = createAdminClient()

  // Verificar que la factura existe y pertenece al restaurante
  const { data: invoice_full, error: fetchErr } = await supabase
    .from('dte_incoming_invoices')
    .select('id, reception_status, received_at, rut_emisor, razon_emisor, email_emisor, document_type, folio, fecha_emision, total_amount')
    .eq('id', body.id)
    .eq('restaurant_id', body.restaurant_id)
    .single()

  if (fetchErr || !invoice_full) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  // Alias para compatibilidad con el código de validación
  const invoice = invoice_full

  // No permitir cambiar estado si ya fue procesada
  if (invoice.reception_status !== 'pendiente') {
    return NextResponse.json(
      {
        error:   'FACTURA_YA_PROCESADA',
        message: `La factura ya fue ${invoice.reception_status}. No se puede cambiar el estado.`,
      },
      { status: 409 }
    )
  }

  // Verificar plazo legal (8 días corridos)
  const diasTranscurridos = Math.floor(
    (Date.now() - new Date(invoice.received_at).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diasTranscurridos >= 8 && body.reception_status === 'rechazado') {
    return NextResponse.json(
      {
        error:   'PLAZO_VENCIDO',
        message: `Han pasado ${diasTranscurridos} días desde la recepción. El plazo legal de 8 días para rechazar ha vencido.`,
      },
      { status: 400 }
    )
  }

  const { error: updateErr } = await supabase
    .from('dte_incoming_invoices')
    .update({
      reception_status: body.reception_status,
      reception_glosa:  body.reception_glosa ?? null,
      reception_date:   new Date().toISOString(),
    })
    .eq('id', body.id)
    .eq('restaurant_id', body.restaurant_id)

  if (updateErr) {
    console.error('dte/incoming PATCH error:', updateErr)
    return NextResponse.json({ error: 'No se pudo actualizar el estado' }, { status: 500 })
  }

  // ── Generar XMLs de intercambio y enviarlos al emisor por email ─────────────
  // Solo si la factura tiene email_emisor registrado
  if (invoice_full.email_emisor) {
    try {
      const creds = await loadCredentials(body.restaurant_id)

      if (!('error' in creds)) {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('rut, razon_social')
          .eq('id', body.restaurant_id)
          .maybeSingle()

        if (restaurant?.rut && restaurant?.razon_social) {
          const baseInput = {
            rutReceptor:   restaurant.rut,
            razonReceptor: restaurant.razon_social,
            rutEmisor:     invoice_full.rut_emisor,
            razonEmisor:   invoice_full.razon_emisor,
            documento: {
              tipoDte:      invoice_full.document_type,
              folio:        invoice_full.folio,
              fechaEmision: invoice_full.fecha_emision,
              rutEmisor:    invoice_full.rut_emisor,
              rutReceptor:  restaurant.rut,
              montoTotal:   invoice_full.total_amount,
            },
            privateKeyPem: creds.privateKeyPem,
            certificate:   creds.certificate,
          }

          // Etapa 1: RecepcionDTE — confirma que recibiste el XML
          const xml015 = buildRecepcionDteXml(baseInput)

          // Etapa 2: EnvioRecibos — confirma que recibiste las mercaderías
          const xml016 = buildEnvioRecibosXml(baseInput, 'Oficina central')

          // Etapa 3: ResultadoDTE — aceptado / rechazado / reclamado
          const xml017 = buildResultadoDteXml({
            ...baseInput,
            estado: body.reception_status,
            glosa:  body.reception_glosa,
          })

          const { subject, html, text } = aecEmail({
            razonEmisor:   invoice_full.razon_emisor,
            razonReceptor: restaurant.razon_social,
            folio:         invoice_full.folio,
            tipoDte:       invoice_full.document_type,
            totalAmount:   invoice_full.total_amount,
            estado:        body.reception_status,
            glosa:         body.reception_glosa,
          })

          await sendBrandedEmail({
            to:      invoice_full.email_emisor,
            subject,
            html,
            text,
            attachments: [
              {
                filename: `015_RecepcionDTE_${invoice_full.folio}.xml`,
                content:  Buffer.from(xml015, 'utf8').toString('base64'),
                type:     'application/xml',
              },
              {
                filename: `016_EnvioRecibos_${invoice_full.folio}.xml`,
                content:  Buffer.from(xml016, 'utf8').toString('base64'),
                type:     'application/xml',
              },
              {
                filename: `017_ResultadoDTE_${invoice_full.folio}.xml`,
                content:  Buffer.from(xml017, 'utf8').toString('base64'),
                type:     'application/xml',
              },
            ],
          })
        }
      }
    } catch (aecErr) {
      console.error('[incoming PATCH] Error generando/enviando XMLs de intercambio:', aecErr)
    }
  }

  return NextResponse.json({ ok: true, reception_status: body.reception_status })
}
