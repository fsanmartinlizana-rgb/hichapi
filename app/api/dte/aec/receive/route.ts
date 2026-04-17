export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { parseAecXml } from '@/lib/dte/aec-parser'

// ══════════════════════════════════════════════════════════════════════════════
//  POST /api/dte/aec/receive
//
//  Webhook público — lo llama el sistema del receptor (LibreDTE, Bsale, etc.)
//  para notificarnos el resultado de una factura que nosotros emitimos.
//
//  NO requiere autenticación: el receptor no tiene sesión en nuestro sistema.
//  La identidad se resuelve por el RutRecibe (nuestro RUT) dentro del XML,
//  que se cruza contra la tabla restaurants para encontrar el restaurante.
//
//  Body: multipart/form-data  →  campo "xml" con el archivo
//     o: application/xml      →  body directo con el XML
//     o: application/json     →  { "xml": "..." }
//
//  Flujo:
//    1. Extraer XML del body
//    2. Parsear para detectar tipo (RecepcionDTE / EnvioRecibos / ResultadoDTE)
//    3. Buscar restaurante por RutRecibe (nuestro RUT emisor)
//    4. Buscar emisión por restaurant_id + folio
//    5. Si es 017: actualizar aec_status, aec_fecha, aec_glosa
//    6. Si es 015/016: respuesta informativa (no cambia estado comercial)
// ══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  let xmlContent: string | null = null

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file  = form.get('xml')
    if (file instanceof File) {
      xmlContent = new TextDecoder('utf-8').decode(await file.arrayBuffer())
    } else if (typeof file === 'string') {
      xmlContent = file
    }
  } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
    xmlContent = await req.text()
  } else {
    const body = await req.json().catch(() => null)
    xmlContent = body?.xml ?? null
  }

  if (!xmlContent) {
    return NextResponse.json({ error: 'xml requerido' }, { status: 400 })
  }

  // ── Parsear XML ────────────────────────────────────────────────────────────
  const parsed = parseAecXml(xmlContent)

  if (parsed.error) {
    return NextResponse.json({ error: parsed.error, tipo: parsed.tipo }, { status: 422 })
  }

  if (!parsed.folio || !parsed.rutEmisor) {
    return NextResponse.json(
      { error: 'XML no contiene folio o RUT emisor', parsed },
      { status: 422 }
    )
  }

  // En RespuestaDTE / ResultadoDTE:
  //   RUTEmisor = el cliente (quien recibió nuestra factura y nos responde)
  //   RUTRecep  = nosotros (77042148-9, La Bodega)
  // También puede venir en RecepcionEnvio como RutReceptor
  // Buscamos nuestro RUT (RUTRecep) en dte_credentials.rut_envia
  const nuestroRut = parsed.rutReceptor ?? parsed.rutRecibe
  console.log('[aec/receive] parsed:', JSON.stringify({ tipo: parsed.tipo, rutEmisor: parsed.rutEmisor, rutReceptor: parsed.rutReceptor, rutRecibe: parsed.rutRecibe, folio: parsed.folio, nuestroRut }))

  const supabase = createAdminClient()

  // ── Buscar la emisión directamente por rut_emisor + folio ──────────────────
  // dte_emissions.rut_emisor = nuestro RUT (77042148-9)
  // No necesitamos pasar por dte_credentials
  const { data: emission, error: fetchErr } = await supabase
    .from('dte_emissions')
    .select('id, restaurant_id, document_type, folio, aec_status')
    .eq('rut_emisor', nuestroRut)
    .eq('folio', parsed.folio)
    .order('emitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchErr) {
    console.error('[aec/receive] fetch emission error:', fetchErr)
    return NextResponse.json({ error: 'Error consultando emisión' }, { status: 500 })
  }

  if (!emission) {
    return NextResponse.json(
      {
        error:   'EMISION_NO_ENCONTRADA',
        message: `No se encontró emisión con folio ${parsed.folio} para RUT ${nuestroRut}`,
        parsed,
      },
      { status: 404 }
    )
  }

  const restaurantId = emission.restaurant_id

  // ── Actualizar según tipo de XML ───────────────────────────────────────────

  if (parsed.tipo === 'ResultadoDTE') {
    // 017 — resultado comercial: actualiza aec_status
    if (!parsed.estadoNormalizado) {
      return NextResponse.json(
        { error: `Código de estado desconocido: ${parsed.estadoCodigo}`, parsed },
        { status: 422 }
      )
    }

    const { error: updateErr } = await supabase
      .from('dte_emissions')
      .update({
        aec_status: parsed.estadoNormalizado,
        aec_fecha:  new Date().toISOString(),
        aec_glosa:  parsed.estadoGlosa ?? null,
      })
      .eq('id', emission.id)
      .eq('restaurant_id', emission.restaurant_id)

    if (updateErr) {
      console.error('[aec/receive] update error:', updateErr)
      return NextResponse.json({ error: 'No se pudo actualizar la emisión' }, { status: 500 })
    }

    return NextResponse.json({
      ok:          true,
      tipo:        parsed.tipo,
      emission_id: emission.id,
      folio:       parsed.folio,
      aec_status:  parsed.estadoNormalizado,
      aec_glosa:   parsed.estadoGlosa,
      message:     `Emisión folio ${parsed.folio} marcada como "${parsed.estadoNormalizado}"`,
    })
  }

  if (parsed.tipo === 'RecepcionDTE') {
    // 015 — el receptor confirmó que recibió el XML. Informativo.
    return NextResponse.json({
      ok:          true,
      tipo:        parsed.tipo,
      emission_id: emission.id,
      folio:       parsed.folio,
      estadoCodigo: parsed.estadoCodigo,
      estadoGlosa:  parsed.estadoGlosa,
      message:     `Recepción XML confirmada para folio ${parsed.folio} (estado ${parsed.estadoCodigo}: ${parsed.estadoGlosa})`,
    })
  }

  if (parsed.tipo === 'EnvioRecibos') {
    // 016 — el receptor confirmó que recibió las mercaderías. Informativo.
    return NextResponse.json({
      ok:          true,
      tipo:        parsed.tipo,
      emission_id: emission.id,
      folio:       parsed.folio,
      recinto:     parsed.recinto,
      message:     `Recepción de mercaderías confirmada para folio ${parsed.folio}${parsed.recinto ? ` en "${parsed.recinto}"` : ''}`,
    })
  }

  return NextResponse.json({ ok: true, tipo: parsed.tipo, parsed })
}
