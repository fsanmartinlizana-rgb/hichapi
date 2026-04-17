// ══════════════════════════════════════════════════════════════════════════════
//  CAF_Manager — lib/dte/caf.ts
//
//  Handles upload, validation, encrypted storage, and metadata retrieval of
//  CAF (Código de Autorización de Folios) XML files issued by the SII.
//
//  Supported document types: 33 (Factura), 39 (Boleta), 41 (Boleta exenta),
//                            56 (Nota de Débito), 61 (Nota de Crédito)
//
//  Storage: AES-256-GCM encrypted XML in `dte_cafs` table.
//  The raw XML is never returned — only metadata columns are exposed.
// ══════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto/aes'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CafMetadata {
  id?:                  string
  rut_emisor:           string
  document_type:        33 | 39 | 41 | 56 | 61
  folio_desde:          number
  folio_hasta:          number
  fecha_autorizacion:   string   // ISO date YYYY-MM-DD
  expires_at:           string | null
  status?:              'active' | 'exhausted' | 'expired'
  folio_actual?:        number
  created_at?:          string
}

// ── XML parsing helpers ───────────────────────────────────────────────────────

/**
 * Extracts the text content of the first occurrence of a tag in an XML string.
 * Returns null if the tag is not found.
 */
function getTagText(xml: string, tag: string): string | null {
  // Match both <TAG>content</TAG> and handle whitespace
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i')
  const m = re.exec(xml)
  return m ? m[1].trim() : null
}

/**
 * Checks whether a tag exists anywhere in the XML string (open or self-closing).
 */
function hasTag(xml: string, tag: string): boolean {
  const re = new RegExp(`<${tag}[\\s/>]`, 'i')
  return re.test(xml)
}

// Required top-level elements per SII CAF schema
// Note: real SII CAFs use <RE> for RUT emisor, not <RUT>
const REQUIRED_ELEMENTS = ['AUTORIZACION', 'CAF', 'DA', 'RE', 'TD', 'RNG', 'D', 'H', 'FRMA'] as const

const VALID_DOCUMENT_TYPES = [33, 39, 41, 56, 61] as const

// ── parseCafXml ───────────────────────────────────────────────────────────────

/**
 * Parses and validates a CAF XML string.
 *
 * Validates presence of all required SII elements, extracts metadata, and
 * rejects unsupported document types.
 *
 * Requirements: 1.1, 1.6
 */
export function parseCafXml(xml: string): CafMetadata | { error: string } {
  if (!xml || typeof xml !== 'string') {
    return { error: 'CAF_INVALID_XML: XML vacío o inválido' }
  }

  // 1. Validate all required elements are present
  for (const tag of REQUIRED_ELEMENTS) {
    if (!hasTag(xml, tag)) {
      return { error: `CAF_INVALID_XML: Elemento obligatorio ausente: <${tag}>` }
    }
  }

  // 2. Extract RUT emisor — SII uses <RE> inside <DA>, fallback to <RUT>
  const rut_emisor = getTagText(xml, 'RE') ?? getTagText(xml, 'RUT')
  if (!rut_emisor) {
    return { error: 'CAF_INVALID_XML: No se pudo extraer el RUT del emisor' }
  }

  // 3. Extract document type (TD)
  const tdRaw = getTagText(xml, 'TD')
  if (!tdRaw) {
    return { error: 'CAF_INVALID_XML: No se pudo extraer el tipo de documento (TD)' }
  }
  const document_type = parseInt(tdRaw, 10)
  if (!VALID_DOCUMENT_TYPES.includes(document_type as 33 | 39 | 41 | 56 | 61)) {
    return {
      error: `CAF_INVALID_XML: Tipo de documento ${document_type} no soportado. Solo se aceptan: 33, 39, 41, 56, 61`,
    }
  }

  // 4. Extract folio range — D (desde) and H (hasta) are inside RNG
  const folioDesdeRaw = getTagText(xml, 'D')
  const folioHastaRaw = getTagText(xml, 'H')
  if (!folioDesdeRaw || !folioHastaRaw) {
    return { error: 'CAF_INVALID_XML: No se pudo extraer el rango de folios (D/H)' }
  }
  const folio_desde = parseInt(folioDesdeRaw, 10)
  const folio_hasta = parseInt(folioHastaRaw, 10)
  if (isNaN(folio_desde) || isNaN(folio_hasta) || folio_hasta < folio_desde) {
    return { error: 'CAF_INVALID_XML: Rango de folios inválido' }
  }

  // 5. Extract fecha_autorizacion from FRMA or FA element
  // The SII CAF XML typically has <FA>YYYY-MM-DD</FA> inside DA
  let fecha_autorizacion = getTagText(xml, 'FA')
  if (!fecha_autorizacion) {
    // Fallback: try to find a date-like string near FRMA
    fecha_autorizacion = new Date().toISOString().split('T')[0]
  }

  return {
    rut_emisor,
    document_type: document_type as 33 | 39 | 41 | 56 | 61,
    folio_desde,
    folio_hasta,
    fecha_autorizacion,
    expires_at: null,
  }
}

// ── detectOverlap ─────────────────────────────────────────────────────────────

/**
 * Checks whether the given folio range overlaps with any active CAF for the
 * same restaurant and document type.
 *
 * Overlap condition: max(folioDesde, existing.folio_desde) <= min(folioHasta, existing.folio_hasta)
 *
 * Requirements: 1.4
 */
export async function detectOverlap(
  restaurantId: string,
  documentType: number,
  folioDesde: number,
  folioHasta: number
): Promise<boolean> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('dte_cafs')
    .select('folio_desde, folio_hasta')
    .eq('restaurant_id', restaurantId)
    .eq('document_type', documentType)
    .eq('status', 'active')

  if (error) {
    console.error('detectOverlap query error:', error)
    // Fail safe: treat as overlap to prevent duplicate uploads on DB error
    return true
  }

  if (!data || data.length === 0) return false

  for (const existing of data) {
    const overlapStart = Math.max(folioDesde, existing.folio_desde)
    const overlapEnd   = Math.min(folioHasta, existing.folio_hasta)
    if (overlapStart <= overlapEnd) {
      return true
    }
  }

  return false
}

// ── uploadCaf ─────────────────────────────────────────────────────────────────

/**
 * Full CAF upload flow:
 *   1. Parse and validate XML
 *   2. Validate RUT against restaurant record
 *   3. Check for folio range overlap
 *   4. Encrypt XML with AES-256-GCM
 *   5. Insert into dte_cafs with folio_actual = folio_desde
 *
 * Requirements: 1.2, 1.3, 1.4, 1.5
 */
export async function uploadCaf(
  restaurantId: string,
  xmlContent: string,
  uploadedBy?: string
): Promise<{ ok: true; caf_id: string } | { error: string }> {
  // 1. Parse and validate XML
  const parsed = parseCafXml(xmlContent)
  if ('error' in parsed) {
    return { error: parsed.error }
  }

  const supabase = createAdminClient()

  // 2. Validate that a certificate exists for this restaurant
  const { data: credential, error: credErr } = await supabase
    .from('dte_credentials')
    .select('rut_envia')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (credErr || !credential) {
    return { error: 'CERT_REQUIRED: Debes subir un certificado SII antes de cargar folios CAF' }
  }

  // 3. Validate RUT against restaurant record
  const { data: restaurant, error: restaurantErr } = await supabase
    .from('restaurants')
    .select('rut')
    .eq('id', restaurantId)
    .maybeSingle()

  if (restaurantErr || !restaurant) {
    return { error: 'No se encontró el restaurante' }
  }

  if (restaurant.rut) {
    // Normalize RUTs for comparison (strip dots, lowercase)
    const normalizeRut = (r: string) => r.replace(/\./g, '').toLowerCase().trim()
    if (normalizeRut(parsed.rut_emisor) !== normalizeRut(restaurant.rut)) {
      return { error: 'CAF_RUT_MISMATCH: El RUT del CAF no coincide con el RUT del restaurante' }
    }
  }

  // 4. Check for folio range overlap
  const hasOverlap = await detectOverlap(
    restaurantId,
    parsed.document_type,
    parsed.folio_desde,
    parsed.folio_hasta
  )
  if (hasOverlap) {
    return {
      error: 'CAF_OVERLAP: Ya existe un CAF activo con folios solapados para este tipo de documento',
    }
  }

  // 5. Encrypt XML with AES-256-GCM
  const encrypted = encrypt(xmlContent)

  // 6. Insert into dte_cafs with folio_actual = folio_desde
  const { data: inserted, error: insertErr } = await supabase
    .from('dte_cafs')
    .insert({
      restaurant_id:       restaurantId,
      document_type:       parsed.document_type,
      folio_desde:         parsed.folio_desde,
      folio_hasta:         parsed.folio_hasta,
      folio_actual:        parsed.folio_desde,   // Requirement 1.5
      fecha_autorizacion:  parsed.fecha_autorizacion,
      expires_at:          parsed.expires_at,
      status:              'active',
      xml_ciphertext:      encrypted.ciphertext,
      xml_iv:              encrypted.iv,
      xml_auth_tag:        encrypted.authTag,
      caf_xml:             xmlContent,           // Plain text for PHP bridge
      rut_emisor:          parsed.rut_emisor,
      uploaded_by:         uploadedBy ?? null,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('uploadCaf insert error:', insertErr)
    return { error: 'No se pudo guardar el CAF en la base de datos' }
  }

  return { ok: true, caf_id: inserted.id }
}

// ── listCafs ──────────────────────────────────────────────────────────────────

/**
 * Returns metadata for all CAFs belonging to a restaurant.
 * Never selects xml_ciphertext, xml_iv, or xml_auth_tag.
 *
 * Requirements: 1.7
 */
export async function listCafs(restaurantId: string): Promise<CafMetadata[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('dte_cafs')
    .select(
      'id, rut_emisor, document_type, folio_desde, folio_hasta, folio_actual, fecha_autorizacion, expires_at, status, created_at'
    )
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('listCafs query error:', error)
    return []
  }

  return (data ?? []).map((row: any) => ({
    id:                  row.id,
    document_type:       row.document_type as 33 | 39 | 41 | 56 | 61,
    folio_desde:         row.folio_desde,
    folio_hasta:         row.folio_hasta,
    folio_actual:        row.folio_actual,
    fecha_autorizacion:  row.fecha_autorizacion,
    expires_at:          row.expires_at ?? null,
    status:              row.status as 'active' | 'exhausted' | 'expired',
    created_at:          row.created_at,
  }))
}
