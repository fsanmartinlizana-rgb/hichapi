/**
 * Server-side helpers to create notifications from anywhere in the codebase.
 *
 * Pattern: any code path that needs to alert a restaurant (a webhook handler,
 * a cron, an API route closing a turno, etc.) can call `createNotification()`
 * directly with the service-role client and the bell will pick it up via
 * realtime subscription.
 *
 * Includes lightweight in-DB de-duplication: if a notification with the same
 * (restaurant_id, dedupe_key) was created in the last 6 hours, we update its
 * timestamp instead of inserting a new row.
 */

import { createAdminClient } from '@/lib/supabase/server'
import type { CreateNotificationInput, NotificationRow } from './types'

const DEDUPE_WINDOW_HOURS = 6

export async function createNotification(input: CreateNotificationInput): Promise<NotificationRow | null> {
  const supabase = createAdminClient()

  // 1. Dedupe lookup
  if (input.dedupe_key) {
    const since = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 3600_000).toISOString()
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('restaurant_id', input.restaurant_id)
      .eq('dedupe_key', input.dedupe_key)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      // Refresh the row in place: bring it back to the top, mark unread.
      const { data: updated, error: upErr } = await supabase
        .from('notifications')
        .update({
          title: input.title,
          message: input.message ?? null,
          severity: input.severity ?? 'info',
          metadata: input.metadata ?? {},
          is_read: false,
          read_at: null,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 10 * 24 * 3600_000).toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (upErr) {
        console.error('[notifications] dedupe update failed', upErr)
        return null
      }
      return updated as NotificationRow
    }
  }

  // 2. Insert
  const { data: row, error } = await supabase
    .from('notifications')
    .insert({
      restaurant_id: input.restaurant_id,
      type:          input.type,
      severity:      input.severity ?? 'info',
      category:      input.category ?? 'operacion',
      title:         input.title,
      message:       input.message ?? null,
      action_url:    input.action_url ?? null,
      action_label:  input.action_label ?? null,
      dedupe_key:    input.dedupe_key ?? null,
      metadata:      input.metadata ?? {},
    })
    .select('*')
    .single()

  if (error) {
    console.error('[notifications] insert failed', error)
    return null
  }
  return row as NotificationRow
}

/**
 * Convenience: create a stock-low notification with the standard shortcut
 * to the /stock page. Used by the comandas endpoint and any background
 * watcher we add later.
 */
export async function notifyStockLow(args: {
  restaurant_id: string
  itemName: string
  itemId: string
  qty: number
  minQty: number
}) {
  return createNotification({
    restaurant_id: args.restaurant_id,
    type:          'stock_low',
    severity:      'warning',
    category:      'inventario',
    title:         `Stock bajo: ${args.itemName}`,
    message:       `Quedan ${args.qty} (mínimo ${args.minQty}). Reabastece antes que se quiebre.`,
    action_url:    `/stock?focus=${args.itemId}`,
    action_label:  'Reabastecer',
    dedupe_key:    `stock_low:${args.itemId}`,
    metadata:      { stock_item_id: args.itemId, qty: args.qty, min_qty: args.minQty },
  })
}

export async function notifyStockOut(args: {
  restaurant_id: string
  itemName: string
  itemId: string
}) {
  return createNotification({
    restaurant_id: args.restaurant_id,
    type:          'stock_out',
    severity:      'critical',
    category:      'inventario',
    title:         `Sin stock: ${args.itemName}`,
    message:       `${args.itemName} llegó a 0. Chapi dejará de ofrecerlo en discovery hasta que reabastezcas.`,
    action_url:    `/stock?focus=${args.itemId}`,
    action_label:  'Ir a reabastecer',
    dedupe_key:    `stock_out:${args.itemId}`,
    metadata:      { stock_item_id: args.itemId },
  })
}

export async function notifyItem86(args: {
  restaurant_id: string
  itemName: string
  itemKey: string
}) {
  return createNotification({
    restaurant_id: args.restaurant_id,
    type:          'item_86',
    severity:      'warning',
    category:      'inventario',
    title:         `${args.itemName} marcado como quiebre`,
    message:       'Está oculto del menú y de Chapi. Cuando tengas reposición, desmárcalo en Carta.',
    action_url:    `/carta?search=${encodeURIComponent(args.itemName)}`,
    action_label:  'Gestionar en Carta',
    dedupe_key:    `item_86:${args.itemKey}`,
    metadata:      { item_key: args.itemKey },
  })
}
