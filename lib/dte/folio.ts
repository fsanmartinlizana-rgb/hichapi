// ══════════════════════════════════════════════════════════════════════════════
//  Folio_Manager — lib/dte/folio.ts
//
//  Handles atomic folio assignment via the `dte_take_next_folio` RPC and
//  low-stock notifications for DTE document types.
//
//  Supported document types: 33 (Factura), 39 (Boleta), 41 (Boleta exenta)
//
//  Notification thresholds:
//    < 50 folios → warning
//    <  9 folios → critical
// ══════════════════════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActiveCaf {
  folio_desde:  number
  folio_hasta:  number
  folio_actual: number
  expires_at:   string | null
  status:       'active' | 'exhausted' | 'expired'
}

// ── countAvailableFolios ──────────────────────────────────────────────────────

/**
 * Pure function: sums `(folio_hasta - folio_actual + 1)` across all active,
 * non-expired CAFs.
 *
 * A CAF is considered active and non-expired when:
 *   - status === 'active'
 *   - expires_at is null OR expires_at > now
 *
 * Requirements: 2.5
 *
 * Property 9: Available folio count formula
 */
export function countAvailableFolios(cafs: ActiveCaf[]): number {
  const now = new Date()
  return cafs
    .filter((caf) => {
      if (caf.status !== 'active') return false
      if (caf.expires_at !== null && new Date(caf.expires_at) <= now) return false
      return true
    })
    .reduce((sum, caf) => sum + Math.max(0, caf.folio_hasta - caf.folio_actual + 1), 0)
}

// ── takeNextFolio ─────────────────────────────────────────────────────────────

/**
 * Atomically reserves the next available folio for a restaurant + document type
 * by delegating to the `dte_take_next_folio` database RPC.
 *
 * On success, triggers `checkFolioAlerts` asynchronously (non-blocking).
 *
 * Maps the Postgres `P0001` exception (raised when no CAF is available) to the
 * `NO_CAF_AVAILABLE` error code.
 *
 * Requirements: 2.1, 2.2
 */
export async function takeNextFolio(
  restaurantId: string,
  documentType: number
): Promise<{ caf_id: string; folio: number } | { error: 'NO_CAF_AVAILABLE' }> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc('dte_take_next_folio', {
    p_restaurant_id: restaurantId,
    p_document_type: documentType,
  })

  if (error) {
    // P0001 is the SQLSTATE raised by the RPC when no CAF is available
    if (
      error.code === 'P0001' ||
      (error.message && error.message.includes('NO_CAF_AVAILABLE'))
    ) {
      return { error: 'NO_CAF_AVAILABLE' }
    }
    console.error('takeNextFolio RPC error:', error)
    return { error: 'NO_CAF_AVAILABLE' }
  }

  // The RPC returns a single-row result set: [{ caf_id, folio }]
  const row = Array.isArray(data) ? data[0] : data
  if (!row || row.caf_id == null || row.folio == null) {
    return { error: 'NO_CAF_AVAILABLE' }
  }

  // Fire-and-forget: check alerts after successful assignment
  checkFolioAlerts(restaurantId, documentType).catch((err) => {
    console.error('checkFolioAlerts error (non-blocking):', err)
  })

  return { caf_id: row.caf_id as string, folio: row.folio as number }
}

// ── checkFolioAlerts ──────────────────────────────────────────────────────────

/**
 * Fetches active CAFs for the given restaurant + document type, computes the
 * available folio count, and inserts a notification if below a threshold.
 *
 * Thresholds:
 *   < 50 → severity 'warning'
 *   <  9 → severity 'critical'
 *
 * Deduplication: before inserting, checks for an existing unread notification
 * of the same severity + type ('dte') for the restaurant. If one exists, skips
 * the insert.
 *
 * Requirements: 2.3, 2.4
 */
export async function checkFolioAlerts(
  restaurantId: string,
  documentType: number
): Promise<void> {
  const supabase = createAdminClient()

  // 1. Fetch active CAFs for this restaurant + document type
  const { data: cafs, error: cafsError } = await supabase
    .from('dte_cafs')
    .select('folio_desde, folio_hasta, folio_actual, expires_at, status')
    .eq('restaurant_id', restaurantId)
    .eq('document_type', documentType)
    .eq('status', 'active')

  if (cafsError) {
    console.error('checkFolioAlerts: error fetching CAFs:', cafsError)
    return
  }

  const available = countAvailableFolios((cafs ?? []) as ActiveCaf[])

  // 2. Determine severity (critical takes precedence over warning)
  let severity: 'warning' | 'critical' | null = null
  if (available < 9) {
    severity = 'critical'
  } else if (available < 50) {
    severity = 'warning'
  }

  if (severity === null) return

  // 3. Deduplicate: check for existing unread notification of same severity + type
  const { data: existing, error: existingError } = await supabase
    .from('notifications')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('type', 'dte')
    .eq('severity', severity)
    .eq('is_read', false)
    .limit(1)

  if (existingError) {
    console.error('checkFolioAlerts: error checking existing notifications:', existingError)
    return
  }

  if (existing && existing.length > 0) {
    // Already have an unread notification of this severity — skip
    return
  }

  // 4. Insert notification
  const docTypeLabel: Record<number, string> = {
    33: 'Factura (tipo 33)',
    39: 'Boleta (tipo 39)',
    41: 'Boleta exenta (tipo 41)',
    56: 'Nota de Débito (tipo 56)',
    61: 'Nota de Crédito (tipo 61)',
  }
  const label = docTypeLabel[documentType] ?? `Tipo ${documentType}`

  const message =
    severity === 'critical'
      ? `Quedan solo ${available} folio(s) disponibles para ${label}. Sube un nuevo CAF de inmediato.`
      : `Quedan ${available} folio(s) disponibles para ${label}. Considera subir un nuevo CAF pronto.`

  const title =
    severity === 'critical'
      ? `Folios DTE críticos — ${label}`
      : `Folios DTE bajos — ${label}`

  const { error: insertError } = await supabase.from('notifications').insert({
    restaurant_id: restaurantId,
    type:          'dte',
    title,
    message,
    severity,
    category:      'dte',
    is_read:       false,
  })

  if (insertError) {
    console.error('checkFolioAlerts: error inserting notification:', insertError)
  }
}
