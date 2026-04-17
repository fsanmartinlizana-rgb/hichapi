export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { checkDteStatus, getSiiToken, getSiiTokenFactura, SiiEnvironment } from '@/lib/dte/sii-client'
import { loadCredentials } from '@/lib/dte/signer'

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
  if (dbValue === 'production') return 'produccion'
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
    .select('id, sii_track_id, document_type, folio, emitted_at, total_amount, rut_receptor')
    .eq('restaurant_id', body.restaurant_id)
    .eq('status', 'sent')
    .not('sii_track_id', 'is', null)

  if (!sentEmissions || sentEmissions.length === 0) {
    return NextResponse.json({ updated: 0, emissions: [] })
  }

  // Load restaurant + credentials
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('rut, dte_environment')
    .eq('id', body.restaurant_id)
    .single()

  const environment = toSiiEnvironment(restaurant?.dte_environment)

  const creds = await loadCredentials(body.restaurant_id)
  if ('error' in creds) {
    return NextResponse.json({ error: `Credenciales: ${creds.error}` }, { status: 500 })
  }

  // Separate emissions by type
  const boletaEmissions  = sentEmissions.filter(e => e.document_type === 39 || e.document_type === 41)
  const facturaEmissions = sentEmissions.filter(e => e.document_type === 33 || e.document_type === 56 || e.document_type === 61)

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

  // ── Facturas: use SOAP QueryEstUp (by track_id) ────────────────────────────
  if (facturaEmissions.length > 0) {
    const tokenResult = await getSiiTokenFactura(creds.privateKeyPem, creds.certificate, environment)
    if (tokenResult.token) {
      for (const em of facturaEmissions) {
        try {
          const servidor = environment === 'produccion' ? 'palena' : 'maullin'
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const https = require('https') as typeof import('https')

          const [rutEmisor] = (restaurant?.rut ?? '').replace(/\./g, '').split('-')
          const [dvEmisor]  = (restaurant?.rut ?? '').replace(/\./g, '').split('-').slice(1)

          const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Body>
    <getEstUp xmlns="http://DefaultNamespace">
      <RutEmpresa>${rutEmisor}</RutEmpresa>
      <DvEmpresa>${dvEmisor}</DvEmpresa>
      <TrackId>${em.sii_track_id}</TrackId>
      <token>${tokenResult.token}</token>
    </getEstUp>
  </soapenv:Body>
</soapenv:Envelope>`

          const responseXml = await new Promise<string>((resolve, reject) => {
            let settled = false, gotResponse = false
            const done = (v: string) => { if (!settled) { settled = true; resolve(v) } }
            const fail = (e: Error)  => { if (!settled) { settled = true; reject(e) } }
            const req = https.request({
              hostname: `${servidor}.sii.cl`, port: 443,
              path: '/DTEWS/QueryEstUp.jws', method: 'POST',
              headers: { 'Content-Type': 'text/xml; charset=UTF-8', 'SOAPAction': '', 'Connection': 'close' },
            }, (res: any) => {
              gotResponse = true
              const chunks: Buffer[] = []
              res.on('data', (c: Buffer) => chunks.push(c))
              res.on('end',  () => done(Buffer.concat(chunks).toString('utf8')))
              res.on('close',() => { if (chunks.length > 0) done(Buffer.concat(chunks).toString('utf8')) })
              res.on('error',(e: Error) => { if (chunks.length > 0) done(Buffer.concat(chunks).toString('utf8')); else fail(e) })
            })
            req.on('error', (err: NodeJS.ErrnoException) => {
              if (gotResponse) setTimeout(() => fail(err), 500)
              else fail(err)
            })
            req.write(soapEnvelope)
            req.end()
          })

          // Decode HTML entities and extract ACEPTADOS/RECHAZADOS
          const decode = (s: string) => s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&#xd;/gi,'').replace(/&quot;/g,'"')
          const returnMatch = /<(?:\w+:)?getEstUpReturn[^>]*>([\s\S]*?)<\/(?:\w+:)?getEstUpReturn>/.exec(responseXml)
          if (!returnMatch) continue

          const inner = decode(returnMatch[1])
          const aceptados = parseInt(/<ACEPTADOS>(\d+)<\/ACEPTADOS>/.exec(inner)?.[1] ?? '0')
          const rechazados = parseInt(/<RECHAZADOS>(\d+)<\/RECHAZADOS>/.exec(inner)?.[1] ?? '0')
          const estado = /<ESTADO>([^<]+)<\/ESTADO>/.exec(inner)?.[1]?.trim()

          if (estado === 'EPR' && aceptados > 0 && rechazados === 0) {
            await supabase.from('dte_emissions').update({ status: 'accepted', accepted_at: now }).eq('id', em.id)
            updated++
          } else if (rechazados > 0) {
            await supabase.from('dte_emissions').update({ status: 'rejected', error_detail: `Rechazado por el SII (QueryEstUp)` }).eq('id', em.id)
            updated++
          }
          // EPR with 0 aceptados = still processing, skip
        } catch { /* non-fatal */ }
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
