// ══════════════════════════════════════════════════════════════════════════════
//  Emission_Engine — lib/dte/engine.ts
//
//  Orchestrates the full DTE emission pipeline for a single emission row:
//
//    Guard checks → (a) reserve folio → (b) build + sign XML → (c) submit SII
//
//  Each step updates `dte_emissions.status` before proceeding. On any failure
//  the error is written to `error_detail` and the sequence stops. Folios are
//  never decremented after assignment.
//
//  Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 1.1, 1.2, 1.3, 7.1, 7.4
// ══════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/server'
import { takeNextFolio } from '@/lib/dte/folio'
import { DteLineItem, buildDteXml, signDte, loadCredentials } from '@/lib/dte/signer'
import {
  SiiEnvironment,
  getSiiToken,
  sendDteToSII,
  getSiiTokenFactura,
  sendFacturaToSII,
} from '@/lib/dte/sii-client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmissionResult {
  ok:          boolean
  folio?:      number
  signed_xml?: string
  track_id?:   string
  error?:      string
}

// ── DB environment value → SiiEnvironment mapping ────────────────────────────

/**
 * Maps the `dte_environment` column value (Sprint 13 schema uses English keys)
 * to the `SiiEnvironment` type used by `sii-client.ts`.
 *
 * DB values: 'certification' | 'production'
 * SiiEnvironment: 'certificacion' | 'produccion'
 */
function toSiiEnvironment(dbValue: string | null | undefined): SiiEnvironment {
  if (dbValue === 'production') return 'produccion'
  // Default to certificacion for safety
  return 'certificacion'
}

// ── RUT validation ────────────────────────────────────────────────────────────

/**
 * Validates a Chilean RUT format: XXXXXXXX-X (7-8 digits, dash, digit or K/k).
 * Strips dots before checking.
 *
 * Requirements: 1.2
 */
function isValidRutFormat(rut: string): boolean {
  const stripped = rut.replace(/\./g, '')
  return /^\d{7,8}-[\dkK]$/.test(stripped)
}

// ── runEmission ───────────────────────────────────────────────────────────────

/**
 * Runs the full DTE emission pipeline for an existing `dte_emissions` row.
 *
 * Pre-conditions (checked before any DB writes):
 *   - Order must have status `paid`           → ORDER_NOT_PAID
 *   - Order must not have an active emission  → DUPLICATE_EMISSION
 *   - For types 33, 56, 61: receptor fields must be present and valid
 *   - For types 56, 61: reference fields must be present
 *
 * Pipeline steps:
 *   (a) `takeNextFolio`  → update emission to `draft` with folio + caf_id
 *   (b) `buildDteXml` + `signDte` → update emission to `signed`, set `signed_at`
 *   (c) `submitDte`      → update emission to `sent`, set `sii_track_id`
 *
 * On any step failure: write `error_detail`, stop (folio is NOT decremented).
 * On success: set `emitted_at`, return `{ ok: true, folio, signed_xml, track_id }`.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 1.1, 1.2, 1.3, 7.1, 7.4
 */
export async function runEmission(
  emissionId:           string,
  restaurantId:         string,
  orderId:              string,
  documentType:         33 | 39 | 41 | 56 | 61,
  rutReceptor?:         string,
  razonReceptor?:       string,
  // New optional params (Task 7.1):
  giroReceptor?:        string,
  direccionReceptor?:   string,
  comunaReceptor?:      string,
  fmaPago?:             1 | 2 | 3,
  items?:               DteLineItem[],
  descuentoGlobal?:     number,
  tipoDocRef?:          number,
  folioRef?:            number,
  fchRef?:              string,
  codRef?:              1 | 2 | 3,
  razonRef?:            string,
): Promise<EmissionResult> {
  const supabase = createAdminClient()

  // ── Task 7.2: Validaciones de receptor para tipos 33, 56 y 61 ─────────────
  const isFactura = documentType === 33 || documentType === 56 || documentType === 61

  if (isFactura) {
    // Validate RUT format first
    if (!rutReceptor || !isValidRutFormat(rutReceptor)) {
      const detail = 'RECEPTOR_RUT_INVALIDO'
      await writeErrorDetail(supabase, emissionId, detail)
      return { ok: false, error: detail }
    }

    // Validate all required receptor fields are present and non-empty
    const missingReceptorField =
      !rutReceptor?.trim() ||
      !razonReceptor?.trim() ||
      !giroReceptor?.trim() ||
      !direccionReceptor?.trim() ||
      !comunaReceptor?.trim()

    if (missingReceptorField) {
      const detail = 'RECEPTOR_DATOS_INCOMPLETOS'
      await writeErrorDetail(supabase, emissionId, detail)
      return { ok: false, error: detail }
    }
  }

  // ── Task 7.3: Validaciones para notas de crédito/débito ───────────────────
  if (documentType === 56 || documentType === 61) {
    const missingRefField =
      tipoDocRef === undefined ||
      folioRef === undefined ||
      codRef === undefined ||
      !razonRef?.trim()

    if (missingRefField) {
      const detail = 'REFERENCIA_INCOMPLETA'
      await writeErrorDetail(supabase, emissionId, detail)
      return { ok: false, error: detail }
    }
  }

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

  // ── Guard 2: no duplicate active emission for this order ───────────────────
  const { data: existing, error: dupErr } = await supabase
    .from('dte_emissions')
    .select('id, status')
    .eq('order_id', orderId)
    .neq('status', 'cancelled')
    .neq('id', emissionId)   // exclude the current emission row itself
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
    .select('rut, razon_social, giro, address, direccion, comuna, dte_environment')
    .eq('id', restaurantId)
    .maybeSingle()

  if (restErr || !restaurant) {
    const detail = 'RESTAURANT_NOT_FOUND'
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  // ── Load order items for XML line items ────────────────────────────────────
  // Task 7.4: use passed `items` if provided, otherwise fall back to order items
  let lineItems: DteLineItem[]

  if (items && items.length > 0) {
    lineItems = items
  } else {
    const { data: orderItems, error: itemsErr } = await supabase
      .from('order_items')
      .select('name, quantity, unit_price, tax_exempt')
      .eq('order_id', orderId)
      .neq('status', 'cancelled')

    if (itemsErr) {
      const detail = `ORDER_ITEMS_ERROR: ${itemsErr.message}`
      await writeErrorDetail(supabase, emissionId, detail)
      return { ok: false, error: detail }
    }

    lineItems = (orderItems ?? []).map((item: any) => ({
      name:       item.name,
      quantity:   item.quantity,
      unit_price: item.unit_price,
      // Propagar exención de IVA desde order_items (heredado de menu_items.tax_exempt)
      ...(item.tax_exempt ? { ind_exe: 1 as const } : {}),
    }))

    // If no items, use a single summary line from the order total
    if (lineItems.length === 0) {
      lineItems.push({
        name:       'Consumo',
        quantity:   1,
        unit_price: order.total,
      })
    }
  }

  // ── Step (a): reserve folio ────────────────────────────────────────────────
  const folioResult = await takeNextFolio(restaurantId, documentType)

  if ('error' in folioResult) {
    const detail = folioResult.error
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  const { folio, caf_id } = folioResult

  // Update emission to draft with folio
  const { error: draftErr } = await supabase
    .from('dte_emissions')
    .update({
      status:   'draft',
      folio,
      caf_id,
    })
    .eq('id', emissionId)

  if (draftErr) {
    const detail = `DRAFT_UPDATE_ERROR: ${draftErr.message}`
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  // ── Step (b): Build XML & Sign ─────────────────────────────────────────────
  // Task 7.4: pass all new fields to buildDteXml
  // Usar fecha local para evitar que el timezone offset cambie el día
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

  let unsignedXml: string
  try {
    unsignedXml = buildDteXml({
      document_type:       documentType,
      folio,
      fecha_emision:       today,
      rut_emisor:          restaurant.rut ?? '',
      razon_social:        restaurant.razon_social ?? '',
      giro:                restaurant.giro ?? '',
      direccion:           (restaurant as any).direccion ?? restaurant.address ?? '',
      comuna:              (restaurant as any).comuna ?? '',
      acteco:              (restaurant as any).acteco ?? '463020',  // fallback — idealmente guardar en tabla restaurants
      total_amount:        order.total,
      items:               lineItems,
      // Receptor fields
      rut_receptor:        isFactura ? (rutReceptor ?? '') : (rutReceptor ?? '66666666-6'),
      razon_receptor:      isFactura ? (razonReceptor ?? '') : (razonReceptor ?? 'Sin RUT'),
      giro_receptor:       giroReceptor,
      direccion_receptor:  direccionReceptor,
      comuna_receptor:     comunaReceptor,
      // Factura-specific fields
      fma_pago:            fmaPago,
      descuento_global:    descuentoGlobal,
      // Reference fields for notas (56/61)
      tipo_doc_ref:        tipoDocRef,
      folio_ref:           folioRef,
      fch_ref:             fchRef,
      cod_ref:             codRef,
      razon_ref:           razonRef,
    })
  } catch (buildErr) {
    const detail = buildErr instanceof Error ? buildErr.message : 'BUILD_XML_ERROR'
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  // Firmar el documento localmente con la implementación en `signer.ts`
  const signResult = await signDte(restaurantId, unsignedXml, caf_id)

  if (!signResult || 'error' in signResult) {
    const detail = (signResult && signResult.error) ? signResult.error : 'UNKNOWN_SIGNING_ERROR'
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  const signed_xml = signResult.signed_xml

  // ── Step (c): Obtener Token y Enviar al SII ────────────────────────────────
  // Task 7.5: branch on document type for correct SII endpoints

  // Load credentials for token authentication
  const creds = await loadCredentials(restaurantId)
  if ('error' in creds) {
    const detail = `LOAD_CRED_ERROR: ${creds.error}`
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  const envSii = toSiiEnvironment(restaurant.dte_environment)

  let track_id: string

  if (isFactura) {
    // Types 33, 56, 61: use SOAP endpoints for factura
    const tokenParams = await getSiiTokenFactura(creds.privateKeyPem, creds.certificate, envSii)

    if (tokenParams.error || !tokenParams.token) {
      const detail = `TOKEN_ERROR: ${tokenParams.error} - ${tokenParams.message || ''}`
      await writeErrorDetail(supabase, emissionId, detail)
      return { ok: false, error: detail }
    }

    const sendResult = await sendFacturaToSII(
      signed_xml,
      restaurant.rut ?? '',
      creds.rutEnvia,
      tokenParams.token,
      envSii
    )

    if (!sendResult.success) {
      const detail = `SII_UPLOAD_ERROR: ${sendResult.error} - ${sendResult.message || ''}`
      await writeErrorDetail(supabase, emissionId, detail)
      return { ok: false, error: detail, signed_xml }
    }

    track_id = sendResult.track_id!
  } else {
    // Types 39, 41: keep existing boleta flow unchanged
    const tokenParams = await getSiiToken(creds.privateKeyPem, creds.certificate, envSii)

    if (tokenParams.error || !tokenParams.token) {
      const detail = `TOKEN_ERROR: ${tokenParams.error} - ${tokenParams.message || ''}`
      await writeErrorDetail(supabase, emissionId, detail)
      return { ok: false, error: detail }
    }

    const sendResult = await sendDteToSII(
      signed_xml,
      restaurant.rut ?? '',
      creds.rutEnvia,
      tokenParams.token,
      envSii
    )

    if (!sendResult.success) {
      const detail = `SII_UPLOAD_ERROR: ${sendResult.error} - ${sendResult.message || ''}`
      await writeErrorDetail(supabase, emissionId, detail)
      return { ok: false, error: detail, signed_xml }
    }

    track_id = sendResult.track_id!
  }

  const signedAt  = new Date().toISOString()
  const emittedAt = signedAt

  // ── Task 7.6: Update emission to sent with all new fields ─────────────────
  const sentUpdate: Record<string, unknown> = {
    status:        'sent',
    xml_signed:    signed_xml || null,
    signed_at:     signedAt,
    emitted_at:    emittedAt,
    sii_track_id:  track_id,
    // New receptor fields for facturas
    giro_receptor:       giroReceptor ?? null,
    direccion_receptor:  direccionReceptor ?? null,
    comuna_receptor:     comunaReceptor ?? null,
    fma_pago:            fmaPago ?? null,
  }

  // For notas (56/61): also save reference fields
  if (documentType === 56 || documentType === 61) {
    sentUpdate.tipo_doc_ref = tipoDocRef ?? null
    sentUpdate.folio_ref    = folioRef ?? null
    sentUpdate.fch_ref      = fchRef ?? null
    sentUpdate.cod_ref      = codRef ?? null
    sentUpdate.razon_ref    = razonRef ?? null
  }

  const { error: sentErr } = await supabase
    .from('dte_emissions')
    .update(sentUpdate)
    .eq('id', emissionId)

  if (sentErr) {
    const detail = `SENT_UPDATE_ERROR: ${sentErr.message}`
    await writeErrorDetail(supabase, emissionId, detail)
    return { ok: false, error: detail }
  }

  // ── Task 7.7: Anulación para notas de crédito con cod_ref = 1 ─────────────
  if (documentType === 61 && codRef === 1 && folioRef !== undefined && tipoDocRef !== undefined) {
    try {
      const { data: originalEmission } = await supabase
        .from('dte_emissions')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('document_type', tipoDocRef)
        .eq('folio', folioRef)
        .maybeSingle()

      if (originalEmission) {
        const { error: cancelErr } = await supabase
          .from('dte_emissions')
          .update({ status: 'cancelled' })
          .eq('id', originalEmission.id)

        if (cancelErr) {
          // Log but don't fail — best-effort operation
          console.error(
            `runEmission: failed to cancel original emission ${originalEmission.id}:`,
            cancelErr
          )
        }
      }
    } catch (cancelEx) {
      // Log but don't fail — best-effort operation
      console.error('runEmission: error during original emission cancellation:', cancelEx)
    }
  }

  // ── Success ────────────────────────────────────────────────────────────────
  return {
    ok:         true,
    folio,
    signed_xml,
    track_id,
  }
}

// ── writeErrorDetail ──────────────────────────────────────────────────────────

/**
 * Writes an error message to `dte_emissions.error_detail` without changing
 * the status. Used to record failures at any pipeline step.
 *
 * Requirements: 5.4
 */
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
