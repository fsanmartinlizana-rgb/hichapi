/**
 * Shared types for the notifications system.
 *
 * The DB schema lives in supabase/migrations/20260411_034_notifications.sql
 */

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical'
export type NotificationCategory = 'operacion' | 'inventario' | 'caja' | 'dte' | 'equipo' | 'sistema'

/**
 * Stable string identifiers for the notifications the app emits.
 * Adding a new type here helps the bell/panel render category-specific
 * icons and lets us add filters later without DB changes.
 */
export type NotificationType =
  | 'stock_low'        // Item under min threshold
  | 'stock_out'        // Item at zero
  | 'item_86'          // Item manually marked as quiebre in /comandas
  | 'caja_open'        // Caja still open at end of day
  | 'caja_diff'        // Cierre de caja con diferencia
  | 'dte_pending'      // DTE awaiting submission
  | 'dte_failed'       // SII rejected DTE
  | 'turno_open'       // Turno sin cerrar
  | 'review_negative'  // Review ≤ 2★
  | 'integration_down' // Conector externo caído
  | 'system'           // Mensaje genérico

export interface NotificationRow {
  id: string
  restaurant_id: string
  type: NotificationType | string
  severity: NotificationSeverity
  category: NotificationCategory
  title: string
  message: string | null
  action_url: string | null
  action_label: string | null
  dedupe_key: string | null
  metadata: Record<string, unknown>
  is_read: boolean
  read_at: string | null
  resolved_at: string | null
  created_at: string
  expires_at: string
}

export interface CreateNotificationInput {
  restaurant_id: string
  type: NotificationType | string
  title: string
  message?: string
  severity?: NotificationSeverity
  category?: NotificationCategory
  action_url?: string
  action_label?: string
  dedupe_key?: string
  metadata?: Record<string, unknown>
}
