/**
 * lib/customer/tracking-service.ts
 *
 * TrackingService — seguimiento en tiempo real del rider para pedidos de delivery.
 *
 * Dos clientes de Supabase se usan intencionalmente:
 *   - createAdminClient (service role): para queries de datos (delivery_orders,
 *     rider_profiles, rider_locations) que requieren acceso sin restricciones RLS.
 *   - createClient con anon key: para Supabase Realtime, ya que el service role
 *     no es compatible con los canales de Realtime en el cliente JS.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import type { DeliveryStatus } from '@/lib/delivery/types'

// ── GPS Coordinate Validation ─────────────────────────────────────────────────

/**
 * Validates that GPS coordinates are within valid ranges.
 * Throws if coordinates are out of bounds.
 *
 * Requirements: 6.3
 *
 * @param lat  Latitude — must be in [-90, 90]
 * @param lng  Longitude — must be in [-180, 180]
 */
export function validateGpsCoordinates(lat: number, lng: number): void {
  if (lat < -90 || lat > 90) {
    throw new Error(`Latitud inválida: ${lat}. Debe estar entre -90 y 90.`)
  }
  if (lng < -180 || lng > 180) {
    throw new Error(`Longitud inválida: ${lng}. Debe estar entre -180 y 180.`)
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

/** GPS coordinate with timestamp */
export interface GpsCoordinate {
  lat: number
  lng: number
  recorded_at: string
}

/** Rider info exposed to the customer during tracking (Requirement 6.4, 10.6) */
export interface TrackingRiderInfo {
  id: string
  first_name: string
  profile_photo_url: string | null
}

/** Full tracking data returned by getTrackingData (Requirements 6.1–6.6) */
export interface TrackingData {
  delivery_order_id: string
  status: DeliveryStatus
  rider: TrackingRiderInfo | null
  /** Latest known GPS position of the rider. null if no location recorded yet. */
  last_location: GpsCoordinate | null
  /** Delivery address for ETA calculation (Requirement 6.5) */
  delivery_address: string
  /** ISO timestamp when the order was delivered. null if not yet delivered. */
  delivered_at: string | null
}

/** Payload delivered to the subscribeToRiderLocation callback */
export interface RiderLocationUpdate {
  lat: number
  lng: number
  recorded_at: string
}

/** Unsubscribe function returned by subscribeToRiderLocation */
export type UnsubscribeFn = () => void

// ── Anon client factory (for Realtime) ───────────────────────────────────────

/**
 * Creates a Supabase client using the anon key.
 * Required for Realtime subscriptions — the service role key does not work
 * with Supabase Realtime channels in the JS client.
 */
function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ── getTrackingData ───────────────────────────────────────────────────────────

/**
 * Returns the current tracking data for a delivery order.
 *
 * This method is intentionally public (no auth required) so it can be used
 * from the public tracking URL `/r/[slug]` (Requirement 6.9).
 *
 * Data returned:
 * - Delivery order status and delivery address
 * - Rider's first name and profile photo (no sensitive data — Requirement 10.6)
 * - Latest GPS position of the rider (validated: lat ∈ [-90,90], lng ∈ [-180,180])
 * - Delivered timestamp if the order has been delivered
 *
 * Requirements: 6.1, 6.2, 6.4, 6.5, 6.6, 6.8
 *
 * @param delivery_order_id  UUID of the delivery order to track
 * @returns                  TrackingData or null if the order does not exist
 */
export async function getTrackingData(
  delivery_order_id: string,
): Promise<TrackingData | null> {
  const supabase = createAdminClient()

  // 1. Fetch the delivery order
  const { data: order, error: orderError } = await supabase
    .from('delivery_orders')
    .select('id, status, rider_id, delivery_address, delivered_at')
    .eq('id', delivery_order_id)
    .maybeSingle()

  if (orderError) throw new Error(orderError.message)
  if (!order) return null

  // 2. Fetch rider info (first name + photo only — Requirement 10.6)
  let rider: TrackingRiderInfo | null = null
  if (order.rider_id) {
    const { data: riderData } = await supabase
      .from('rider_profiles')
      .select('id, full_name, profile_photo_url')
      .eq('id', order.rider_id)
      .maybeSingle()

    if (riderData) {
      // Expose only the first name (Requirement 10.6: "solo nombre y dirección de entrega")
      const firstName = (riderData.full_name as string).split(' ')[0] ?? riderData.full_name
      rider = {
        id:               riderData.id as string,
        first_name:       firstName,
        profile_photo_url: riderData.profile_photo_url as string | null,
      }
    }
  }

  // 3. Fetch the latest GPS position for this delivery order
  let last_location: GpsCoordinate | null = null
  if (order.rider_id) {
    const { data: locationData } = await supabase
      .from('rider_locations')
      .select('lat, lng, recorded_at')
      .eq('delivery_order_id', delivery_order_id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (locationData) {
      const lat = Number(locationData.lat)
      const lng = Number(locationData.lng)

      // Validate GPS coordinates before returning (Requirement 6.3)
      validateGpsCoordinates(lat, lng)

      last_location = {
        lat,
        lng,
        recorded_at: locationData.recorded_at as string,
      }
    }
  }

  return {
    delivery_order_id: order.id as string,
    status:            order.status as DeliveryStatus,
    rider,
    last_location,
    delivery_address:  order.delivery_address as string,
    delivered_at:      order.delivered_at as string | null,
  }
}

// ── subscribeToRiderLocation ──────────────────────────────────────────────────

/**
 * Subscribes to real-time GPS location updates for a delivery order's rider
 * using Supabase Realtime (postgres_changes on rider_locations).
 *
 * The anon key client is used because Supabase Realtime does not work with
 * the service role key in the JS client.
 *
 * The callback receives validated GPS coordinates. If a coordinate from the
 * database is out of range (lat ∉ [-90,90] or lng ∉ [-180,180]), the update
 * is silently discarded to protect the UI from invalid data (Requirement 6.3).
 *
 * Requirements: 6.3, 6.5, 6.6
 *
 * @param delivery_order_id  UUID of the delivery order to track
 * @param callback           Called with each new GPS position update
 * @returns                  Unsubscribe function — call it to stop listening
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToRiderLocation(orderId, (update) => {
 *   console.log(`Rider at ${update.lat}, ${update.lng}`)
 * })
 * // Later, when the component unmounts:
 * unsubscribe()
 * ```
 */
export function subscribeToRiderLocation(
  delivery_order_id: string,
  callback: (update: RiderLocationUpdate) => void,
): UnsubscribeFn {
  const supabase = createAnonClient()

  const channelName = `rider-location-${delivery_order_id}`

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'rider_locations',
        filter: `delivery_order_id=eq.${delivery_order_id}`,
      },
      (payload) => {
        const record = payload.new as {
          lat: number | string
          lng: number | string
          recorded_at: string
        }

        const lat = Number(record.lat)
        const lng = Number(record.lng)

        // Validate coordinates before forwarding to callback (Requirement 6.3)
        // Discard invalid coordinates silently to protect the UI
        try {
          validateGpsCoordinates(lat, lng)
        } catch {
          // Invalid coordinate from DB — discard this update
          return
        }

        callback({
          lat,
          lng,
          recorded_at: record.recorded_at,
        })
      },
    )
    .subscribe()

  // Return an unsubscribe function
  return () => {
    supabase.removeChannel(channel)
  }
}
