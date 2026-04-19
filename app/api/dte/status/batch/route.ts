export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { checkDteStatus, getSiiToken, getSiiTokenFactura, queryEstDteFactura, SiiEnvironment } from '@/lib/dte/sii-client'
import { loadCredentials } from '@/lib/dte/signer'
import { sendBrandedEmail } from '@/lib/email/sender'
import { facturaEmail } from '@/lib/email/templates'
import { generateDtePdf } from '@/lib/dte/pdf-generator'

// ══════════════════════════════════════════════════════════════════════════════
//  POST /api/dte/status/batch
//
//  Polls SII for all 'sent' emissions of a restaurant in one request.
//  - Boletas (39/41): uses checkDteStatus (REST endpoint)
//  - Facturas (33/56/61): uses queryEstDteFactura (SOAP QueryEstDte)
//  Gets separate tokens for boleta and factura endpoints as needed.
//  Returns updated emissions list.
// ══════════════════════════════════════════════════════════════════════════════

const Schema = z.object({
  restaurant_id: z.string().uuid(),
})

function toSiiEnvironment(dbValue: string | null | undefined): SiiEnvironment {
  if (dbValue === 'production' || dbValue === 'produccion') return 'produccion'
  // Handle both 'certification' and 'certificacion'
  return 'certificacion'
}

const REJECTION_STATES = ['RFR', 'RCT', 'FAU', 'FNA']

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Schema>
  try {
    body = Schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin', 'supervisor', 'cajero'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  // Load all 'sent' emissions with fields needed for factura status query
  const { data: sentEmissions } = await supabase
    .from('dte_emissions')
    .select('id, sii_track_id, document_type, folio, emitted_at, total_amount, rut_receptor, razon_receptor, email_receptor, xml_signed')
    .eq('restaurant_id', body.restaurant_id)
    .eq('status', 'sent')
    .not('sii_track_id', 'is', null)

  if (!sentEmissions || sentEmissions.length === 0) {
    return NextResponse.json({ updated: 0, emissions: [] })
  }

  // Load restaurant + credentials
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('rut, razon_social, dte_environment, photo_url')
    .eq('id', body.restaurant_id)
    .single()

  const environment = toSiiEnvironment(restaurant?.dte_environment)

  const creds = await loadCredentials(body.restaurant_id)
  if ('error' in creds) {
    return NextResponse.json({ error: `Credenciales: ${creds.error}` }, { status: 500 })
  }

  // Separate emissions by type
  const boletaEmissions  = sentEmissions.filter((e: any) => e.document_type === 39 || e.document_type === 41)
  const facturaEmissions = sentEmissions.filter((e: any) => e.document_type === 33 || e.document_type === 56 || e.document_type === 61)

  const now = new Date().toISOString()
  let updated = 0

  // ── Boletas: use REST checkDteStatus ────────────────────────────────────────
  if (boletaEmissions.length > 0) {
    const tokenResult = await getSiiToken(creds.privateKeyPem, creds.certificate, environment)
    if (tokenResult.token) {
      for (const em of boletaEmissions) {
        try {
          const result = await checkDteStatus(
            em.sii_track_id!,
            restaurant?.rut ?? '',
            tokenResult.token,
            environment
          )
          if (!result.success) continue

          const siiStatus   = result.sii_response?.estado
          const estadistica = result.sii_response?.estadistica ?? []
          const aceptados   = estadistica.reduce((s: number, e: any) => s + (e.aceptados ?? 0), 0)
          const rechazados  = estadistica.reduce((s: number, e: any) => s + (e.rechazados ?? 0), 0)

          if (siiStatus === 'EPR' && aceptados > 0 && rechazados === 0) {
            await supabase.from('dte_emissions').update({ status: 'accepted', accepted_at: now }).eq('id', em.id)
            updated++
          } else if (rechazados > 0 || siiStatus === 'RFR') {
            const detalle = result.sii_response?.detalle_rep_rech?.[0]?.error?.[0]?.descripcion
            await supabase.from('dte_emissions').update({ status: 'rejected', error_detail: detalle ?? 'Rechazado por el SII' }).eq('id', em.id)
            updated++
          }
        } catch { /* non-fatal */ }
      }
    }
  }

  // ── Facturas: use SOAP QueryEstDte (individual queries) ────────────────────
  if (facturaEmissions.length > 0) {
    const tokenResult = await getSiiTokenFactura(creds.privateKeyPem, creds.certificate, environment)
    if (tokenResult.token) {
      for (const em of facturaEmissions) {
        try {
          // Validate rut_receptor format
          const rawRut = (em.rut_receptor ?? '').replace(/\./g, '')
          const rutReceptorValid = /^\d{7,8}-[\dkK]$/.test(rawRut)
          
          if (!rutReceptorValid) {
            continue // Skip emissions with invalid receptor RUT
          }

          const queryResult = await queryEstDteFactura(
            {
              rutConsultante: restaurant?.rut ?? '',
              rutCompania:    restaurant?.rut ?? '',
              rutReceptor:    rawRut,
              tipoDte:        em.document_type,
              folioDte:       em.folio,
              fechaEmisionDte: em.emitted_at ? (em.emitted_at as string).split('T')[0] : new Date().toISOString().split('T')[0],
              montoDte:       em.total_amount,
              token:          tokenResult.token,
            },
            environment
          )

          if (queryResult.error) continue // Skip on error

          const errorDetailJson = JSON.stringify({ estado: queryResult.estado, glosa: queryResult.glosa })

          if (queryResult.estado === 'DOK') {
            await supabase
              .from('dte_emissions')
              .update({ status: 'accepted', accepted_at: now, error_detail: errorDetailJson })
              .eq('id', em.id)
            updated++

            // Enviar XML + PDF al receptor por email si tiene email_receptor y xml_signed
            if (em.email_receptor && em.xml_signed) {
              try {
                const pdfResult = await generateDtePdf(em.xml_signed, restaurant?.photo_url ?? undefined)

                const { subject, html, text } = facturaEmail({
                  restaurantName: restaurant?.razon_social ?? 'Restaurante',
                  razonReceptor:  em.razon_receptor ?? 'Cliente',
                  folio:          em.folio,
                  totalAmount:    em.total_amount,
                  emittedAt:      em.emitted_at as string,
                  hasXml:         true,
                  hasPdf:         pdfResult.ok,
                })

                const attachments: Array<{ filename: string; content: string; type: string }> = [
                  {
                    filename: `factura_${em.folio}.xml`,
                    content:  Buffer.from(em.xml_signed).toString('base64'),
                    type:     'application/xml',
                  },
                ]

                // Solo agregar PDF si se generó correctamente
                if (pdfResult.ok && pdfResult.buffer) {
                  attachments.push({
                    filename: `factura_${em.folio}.pdf`,
                    content:  pdfResult.buffer.toString('base64'),
                    type:     'application/pdf',
                  })
                }

                await sendBrandedEmail({
                  to:      em.email_receptor,
                  subject,
                  html,
                  text,
                  attachments,
                })
              } catch (emailErr) {
                console.error(`[batch] Error enviando email factura ${em.folio}:`, emailErr)
              }
            }
          } else if (queryResult.estado && REJECTION_STATES.includes(queryResult.estado)) {
            await supabase
              .from('dte_emissions')
              .update({ status: 'rejected', error_detail: errorDetailJson })
              .eq('id', em.id)
            updated++
          } else {
            // Pending or unknown state — just save traceability info
            await supabase
              .from('dte_emissions')
              .update({ error_detail: errorDetailJson })
              .eq('id', em.id)
          }
        } catch (err) {
          console.error(`[batch] Error processing factura ${em.folio}:`, err)
          // Continue with next emission
        }
      }
    }
  }

  // Return fresh emissions list
  const { data: emRes } = await supabase
    .from('dte_emissions')
    .select('id, document_type, folio, status, total_amount, net_amount, iva_amount, rut_receptor, razon_receptor, sii_track_id, emitted_at, order_id, error_detail, xml_signed, aec_status, aec_fecha, aec_glosa, giro_receptor, direccion_receptor, comuna_receptor')
    .eq('restaurant_id', body.restaurant_id)
    .order('emitted_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ updated, emissions: emRes ?? [] })
}
