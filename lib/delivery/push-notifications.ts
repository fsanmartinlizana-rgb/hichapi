/**
 * lib/delivery/push-notifications.ts
 *
 * Server-side helper for sending Expo push notifications to riders and
 * recording in-app notifications for restaurants.
 *
 * Uses Expo Push API directly via HTTP (no SDK) — compatible with
 * Next.js Edge Runtime and Node.js environments.
 *
 * Requirements: 3.1, 3.7, 3.9
 */
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications/server'
import { haversineDistance } from './route-engine.service'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  badge?: number
}

interface ExpoMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  badge?: number
}

// ── Core sender ───────────────────────────────────────────────────────────────

/**
 * Sends push notifications to a list of Expo tokens.
 * Batches up to 100 messages per request (Expo limit).
 * Non-blocking — errors are logged but do not throw.
 */
export async function sendExpoPush(
  tokens: string[],
  payload: PushPayload,
): Promise<void> {
  if (tokens.length === 0) return

  const messages: ExpoMessage[] = tokens.map(token => ({
    to:    token,
    title: payload.title,
    body:  payload.body,
    data:  payload.data ?? {},
    sound: payload.sound ?? 'default',
    badge: payload.badge,
  }))

  // Batch in chunks of 100 (Expo limit per request)
  const BATCH_SIZE = 100
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept:         'application/json',
        },
        body: JSON.stringify(batch),
      })
      if (!res.ok) {
        const body = await res.text()
        console.error(`[push] Expo API error ${res.status}:`, body)
      }
    } catch (err) {
      console.error('[push] Failed to send batch:', err)
    }
  }
}

// ── Domain helpers ────────────────────────────────────────────────────────────

/**
 * Sends a push notification to all available riders within the restaurant's
 * delivery zone that have a registered expo_push_token.
 *
 * Steps:
 *  1. Get restaurant's primary delivery zone
 *  2. Get all available riders with push token
 *  3. Filter by last known GPS position within zone radius
 *  4. Send push
 */
export async function sendPushToRidersInZone(
  restaurantId: string,
  payload: PushPayload,
): Promise<{ sent: number }> {
  const supabase = createAdminClient()

  // 1. Get delivery zone
  const { data: zones } = await supabase
    .from('delivery_zones')
    .select('center_lat, center_lng, radius_km')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .limit(1)

  const zone = zones?.[0] ?? null

  // 2. Get available riders with push token
  const { data } = await supabase
    .from('rider_profiles')
    .select('id, expo_push_token')
    .eq('status', 'available')
    .not('expo_push_token', 'is', null)

  const riders = data as { id: string; expo_push_token: string | null }[] | null

  if (!riders || riders.length === 0) return { sent: 0 }

  let eligibleTokens: string[] = []

  if (!zone) {
    // No zone configured — send to all available riders
    eligibleTokens = riders.map(r => r.expo_push_token as string)
  } else {
    // 3. Filter by last known GPS position
    const riderIds = riders.map(r => r.id)

    // Get the most recent location per rider using a subquery approach
    const { data: locations } = await supabase
      .from('rider_locations')
      .select('rider_id, lat, lng')
      .in('rider_id', riderIds)
      .order('recorded_at', { ascending: false })

    // Keep only the most recent location per rider
    const latestByRider = new Map<string, { lat: number; lng: number }>()
    for (const loc of locations ?? []) {
      if (!latestByRider.has(loc.rider_id)) {
        latestByRider.set(loc.rider_id, { lat: Number(loc.lat), lng: Number(loc.lng) })
      }
    }

    for (const rider of riders) {
      const pos = latestByRider.get(rider.id)
      if (!pos) {
        // No GPS data — include rider anyway (they might be starting their shift)
        eligibleTokens.push(rider.expo_push_token as string)
        continue
      }
      const dist = haversineDistance(
        pos.lat, pos.lng,
        Number(zone.center_lat), Number(zone.center_lng),
      )
      // Include rider if within 2x the zone radius (generous buffer)
      if (dist <= Number(zone.radius_km) * 2) {
        eligibleTokens.push(rider.expo_push_token as string)
      }
    }
  }

  await sendExpoPush(eligibleTokens, payload)
  return { sent: eligibleTokens.length }
}

/**
 * Creates an in-app notification for the restaurant using the existing
 * notification system. Used when rider changes delivery order state.
 */
export async function notifyRestaurantDeliveryUpdate(params: {
  restaurantId:    string
  deliveryOrderId: string
  orderId?:        string | null
  clientName:      string
  newStatus:       'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'cancelled'
  riderName?:      string
}): Promise<void> {
  const { restaurantId, deliveryOrderId, clientName, newStatus, riderName } = params

  const config: Record<string, { title: string; message: string; severity: 'info' | 'success' | 'warning' | 'critical'; type: string }> = {
    assigned: {
      type:     'delivery_rider_assigned',
      severity: 'info',
      title:    `Rider asignado — ${clientName}`,
      message:  riderName
        ? `${riderName} aceptó el pedido y va en camino a recogerlo.`
        : 'Un rider aceptó el pedido y va en camino a recogerlo.',
    },
    picked_up: {
      type:     'delivery_picked_up',
      severity: 'info',
      title:    `Pedido recogido — ${clientName}`,
      message:  riderName
        ? `${riderName} ya recogió el pedido y está en camino al cliente.`
        : 'El rider ya recogió el pedido y está en camino al cliente.',
    },
    in_transit: {
      type:     'delivery_in_transit',
      severity: 'info',
      title:    `En camino — ${clientName}`,
      message:  'El pedido está en camino al cliente.',
    },
    delivered: {
      type:     'delivery_completed',
      severity: 'success',
      title:    `✅ Entregado — ${clientName}`,
      message:  'El pedido fue entregado exitosamente. Recuerda calificar al rider.',
    },
    failed: {
      type:     'delivery_failed',
      severity: 'critical',
      title:    `❌ Entrega fallida — ${clientName}`,
      message:  'El rider no pudo completar la entrega. Revisa el detalle del pedido.',
    },
    cancelled: {
      type:     'delivery_cancelled',
      severity: 'warning',
      title:    `Delivery cancelado — ${clientName}`,
      message:  'El pedido de delivery fue cancelado.',
    },
  }

  const notifConfig = config[newStatus]
  if (!notifConfig) return

  try {
    await createNotification({
      restaurant_id: restaurantId,
      type:          notifConfig.type,
      severity:      notifConfig.severity,
      category:      'operacion',
      title:         notifConfig.title,
      message:       notifConfig.message,
      action_url:    `/delivery/pedidos`,
      action_label:  'Ver pedido',
      dedupe_key:    `delivery_${newStatus}:${deliveryOrderId}`,
      metadata:      { delivery_order_id: deliveryOrderId },
    })
  } catch (err) {
    // Non-blocking
    console.error('[push] createNotification failed:', err)
  }
}
