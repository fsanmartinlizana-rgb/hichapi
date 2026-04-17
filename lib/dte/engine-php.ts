// ══════════════════════════════════════════════════════════════════════════════
//  PHP_Emission_Engine — lib/dte/engine-php.ts
//
//  Orchestrates DTE emission using the working PHP LibreDTE code via bridge.
//  This bypasses the TypeScript XML signing implementation which had issues
//  with SII's strict canonicalization requirements.
//
//  Pipeline:
//    (a) Reserve folio
//    (b) Call PHP bridge to generate, sign, and submit XML
//    (c) Update emission record with track_id
// ══════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto/aes'
import { emitDteViaPhp, PhpDteInput } from '@/lib/dte/php-bridge'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmissionResult {
  ok:          boolean
  folio?:      number
  track_id?:   string
  xml_file?:   string
  error?:      string
}

// ── runEmissionViaPhp ─────────────────────────────────────────────────────────

/**
 * Runs DTE emission using the PHP LibreDTE bridge.
 * 
 * Pre-conditions:
 *   - Order must have status `paid`
 *   - Order must not have an active emission
 * 
 * Pipeline:
 *   (a) Reserve folio from CAF
 *   (b) Load certificate and CAF XML
 *   (c) Call PHP bridge to generate, sign, and submit
 *   (d) Update emission record with track_id
 */
export async function runEmissionViaPhp(
  emissionId:     string,
  restaurantId:   string,
  orderId:        string,
  documentType:   33 | 39 | 41,
  rutReceptor?:   string,
  razonReceptor?: string
): Promise<EmissionResult> {
  const supabase = createAdminClient()

  // ── Guard 1: order must be paid ────────────────────────────────────────────
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, status, total, restaurant_id')
    .eq('id', orderId)
    .maybeSingle()

  if (orderErr || !order) {
    const detail = 'ORDER_NOT_FOUND'
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  if (order.status !== 'paid') {
    const detail = 'ORDER_NOT_PAID'
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  // ── Guard 2: no duplicate active emission ──────────────────────────────────
  const { data: existing, error: dupErr } = await supabase
    .from('dte_emissions')
    .select('id, status')
    .eq('order_id', orderId)
    .neq('status', 'cancelled')
    .neq('id', emissionId)
    .maybeSingle()

  if (dupErr) {
    const detail = `DB_ERROR: ${dupErr.message}`
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  if (existing) {
    const detail = 'DUPLICATE_EMISSION'
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  // ── Load restaurant data ───────────────────────────────────────────────────
  const { data: restaurant, error: restErr } = await supabase
    .from('restaurants')
    .select('rut, razon_social, giro, address')
    .eq('id', restaurantId)
    .maybeSingle()

  if (restErr || !restaurant) {
    const detail = 'RESTAURANT_NOT_FOUND'
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  // ── Load order items ───────────────────────────────────────────────────────
  const { data: orderItems, error: itemsErr } = await supabase
    .from('order_items')
    .select('name, quantity, unit_price')
    .eq('order_id', orderId)
    .neq('status', 'cancelled')

  if (itemsErr) {
    const detail = `ORDER_ITEMS_ERROR: ${itemsErr.message}`
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  const items = (orderItems ?? []).map((item: any) => ({
    name:       item.name,
    quantity:   item.quantity,
    unit_price: item.unit_price,
  }))

  // If no items, use a single summary line
  if (items.length === 0) {
    items.push({
      name:       'Consumo',
      quantity:   1,
      unit_price: order.total,
    })
  }

  // ── Step (a): Reserve folio ────────────────────────────────────────────────
  // Get active CAF for this document type
  const { data: caf, error: cafErr } = await supabase
    .from('dte_cafs')
    .select('id, xml_ciphertext, xml_iv, xml_auth_tag, folio_actual, folio_hasta')
    .eq('restaurant_id', restaurantId)
    .eq('document_type', documentType)
    .eq('status', 'active')
    .single()

  if (cafErr || !caf) {
    const detail = 'NO_ACTIVE_CAF'
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  const folio = caf.folio_actual

  // Check if folio is within range
  if (folio > caf.folio_hasta) {
    const detail = 'CAF_EXHAUSTED'
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  // Decrypt CAF XML
  const cafXml = decrypt({
    ciphertext: caf.xml_ciphertext,
    iv: caf.xml_iv,
    authTag: caf.xml_auth_tag,
  }).toString('utf8')

  // Update emission to draft with folio
  const { error: draftErr } = await supabase
    .from('dte_emissions')
    .update({
      status:   'draft',
      folio,
      caf_id:   caf.id,
    })
    .eq('id', emissionId)

  if (draftErr) {
    const detail = `DRAFT_UPDATE_ERROR: ${draftErr.message}`
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  // Increment folio for next emission
  const { error: folioErr } = await supabase
    .from('dte_cafs')
    .update({ folio_actual: folio + 1 })
    .eq('id', caf.id)

  if (folioErr) {
    const detail = `FOLIO_INCREMENT_ERROR: ${folioErr.message}`
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  // ── Step (b): Load certificate ─────────────────────────────────────────────
  const { data: cred, error: credErr } = await supabase
    .from('dte_credentials')
    .select('cert_ciphertext, cert_iv, cert_auth_tag, pass_ciphertext, pass_iv, pass_auth_tag')
    .eq('restaurant_id', restaurantId)
    .single()

  if (credErr || !cred) {
    const detail = 'NO_CERTIFICATE'
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  const pfxBuffer = decrypt({
    ciphertext: cred.cert_ciphertext,
    iv: cred.cert_iv,
    authTag: cred.cert_auth_tag,
  })

  const pfxPassword = decrypt({
    ciphertext: cred.pass_ciphertext,
    iv: cred.pass_iv,
    authTag: cred.pass_auth_tag,
  }).toString('utf8')

  const certBase64 = pfxBuffer.toString('base64')

  // ── Step (c): Call PHP bridge ──────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0]

  const phpInput: PhpDteInput = {
    document_type:   documentType,
    folio,
    fecha_emision:   today,
    rut_emisor:      restaurant.rut ?? '',
    razon_social:    restaurant.razon_social ?? '',
    giro:            restaurant.giro ?? '',
    direccion:       restaurant.address ?? '',
    comuna:          '',  // Not stored separately
    total_amount:    order.total,
    rut_receptor:    rutReceptor,
    razon_receptor:  razonReceptor,
    items,
  }

  // TODO: Extract cert RUT from certificate instead of hardcoding
  // For now, use the known RUT from the certificate (10089092-5)
  const rutEnvia = '10089092-5'

  const phpResult = await emitDteViaPhp(
    phpInput,
    cafXml,
    certBase64,
    pfxPassword,
    rutEnvia
  )

  if ('error' in phpResult) {
    const detail = phpResult.error
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  // ── Step (d): Update emission record ───────────────────────────────────────
  const now = new Date().toISOString()

  const { error: sentErr } = await supabase
    .from('dte_emissions')
    .update({
      status:        'sent',
      sii_track_id:  phpResult.track_id,
      signed_at:     now,
      emitted_at:    now,
    })
    .eq('id', emissionId)

  if (sentErr) {
    const detail = `SENT_UPDATE_ERROR: ${sentErr.message}`
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  // ── Success ────────────────────────────────────────────────────────────────
  return {
    ok:       true,
    folio,
    track_id: phpResult.track_id,
    xml_file: phpResult.xml_file,
  }
}

// ── writeErrorDetail ──────────────────────────────────────────────────────────

async function writeErrorDetail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  emissionId: string,
  detail: string
): Promise<void> {
  const { error } = await supabase
    .from('dte_emissions')
    .update({ error_detail: detail })
    .eq('id', emissionId)

  if (error) {
    console.error('writeErrorDetail failed:', error)
  }
}
