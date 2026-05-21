/**
 * lib/customer/geofence-service.ts
 *
 * GeofenceService — detección de proximidad a restaurantes y control de
 * notificaciones push por geofencing.
 *
 * Requirements: 8.2, 8.3, 8.9, 8.10
 *
 * Tabla usada: `customer_geofence_events`
 * (la migración creó la tabla con este nombre porque ya existía `geofence_events`)
 */
import { createAdminClient } from '@/lib/supabase/server'
import type { GeofenceEvent } from './types'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum geofencing push notifications per customer per calendar day (Requirement 8.9) */
const MAX_DAILY_NOTIFICATIONS = 3

/** Maximum geofencing push notifications per customer per restaurant in a 24-hour window (Requirement 8.3) */
const MAX_PER_RESTAURANT_24H = 1

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeofenceCheckResult {
  /** Restaurants whose geofence the customer has entered and that are eligible for notification */
  eligible: Array<{
    restaurant_id: string
    restaurant_name: string
    geofence_message: string | null
  }>
  /** Restaurants skipped due to daily or per-restaurant rate limits */
  skipped: Array<{
    restaurant_id: string
    reason: 'daily_limit_reached' | 'restaurant_24h_limit'
  }>
}

interface RestaurantGeofence {
  id: string
  name: string
  geofence_radius_m: number
  geofence_message: string | null
  geofence_enabled: boolean
  lat: number | null
  lng: number | null
}

// ── checkGeofences ────────────────────────────────────────────────────────────

/**
 * Checks which active restaurant geofences the customer is currently inside,
 * applying rate-limit rules before returning eligible restaurants for notification.
 *
 * Rate limits enforced (Requirements 8.3, 8.9):
 * - Maximum 3 notifications per customer per calendar day (UTC).
 * - Maximum 1 notification per customer per restaurant in any 24-hour window.
 *
 * This method does NOT insert events or send notifications — it only returns
 * which restaurants are eligible. Call `recordEvent()` after sending each
 * notification to persist the event.
 *
 * @param customer_id  UUID of the customer profile
 * @param lat          Customer's current latitude
 * @param lng          Customer's current longitude
 * @returns            GeofenceCheckResult with eligible and skipped restaurants
 */
export async function checkGeofences(
  customer_id: string,
  lat: number,
  lng: number,
): Promise<GeofenceCheckResult> {
  const supabase = createAdminClient()

  // 1. Fetch all restaurants with geofencing enabled that have coordinates set
  const { data: restaurants, error: restaurantsError } = await supabase
    .from('restaurants')
    .select('id, name, geofence_radius_m, geofence_message, geofence_enabled, lat, lng')
    .eq('geofence_enabled', true)

  if (restaurantsError) throw new Error(restaurantsError.message)
  if (!restaurants || restaurants.length === 0) {
    return { eligible: [], skipped: [] }
  }

  // 2. Filter restaurants whose geofence the customer is currently inside
  const insideGeofences = (restaurants as RestaurantGeofence[]).filter((r) => {
    if (r.lat == null || r.lng == null || !r.geofence_radius_m) return false
    const distanceM = haversineDistanceMeters(lat, lng, r.lat, r.lng)
    return distanceM <= r.geofence_radius_m
  })

  if (insideGeofences.length === 0) {
    return { eligible: [], skipped: [] }
  }

  // 3. Check daily notification count for this customer (Requirement 8.9)
  const todayCount = await getDailyCount(customer_id, new Date())
  const remainingToday = MAX_DAILY_NOTIFICATIONS - todayCount

  const eligible: GeofenceCheckResult['eligible'] = []
  const skipped: GeofenceCheckResult['skipped'] = []

  // 4. For each restaurant inside the geofence, apply per-restaurant 24h limit
  for (const restaurant of insideGeofences) {
    // If daily limit already reached, skip all remaining restaurants
    if (eligible.length >= remainingToday) {
      skipped.push({ restaurant_id: restaurant.id, reason: 'daily_limit_reached' })
      continue
    }

    // Check per-restaurant 24h limit (Requirement 8.3)
    const count24h = await getRestaurantCount24h(customer_id, restaurant.id)
    if (count24h >= MAX_PER_RESTAURANT_24H) {
      skipped.push({ restaurant_id: restaurant.id, reason: 'restaurant_24h_limit' })
      continue
    }

    eligible.push({
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      geofence_message: restaurant.geofence_message,
    })
  }

  return { eligible, skipped }
}

// ── recordEvent ───────────────────────────────────────────────────────────────

/**
 * Records a geofence entry event in `customer_geofence_events`.
 *
 * Should be called after a push notification is sent (or attempted) for a
 * restaurant geofence entry. The `notification_sent` flag indicates whether
 * the push notification was successfully dispatched.
 *
 * If the push notification service fails, the event is still recorded with
 * `notification_sent = false` for retry and analytics purposes (Design doc:
 * "Geofencing: manejo de errores").
 *
 * Requirements: 8.10
 *
 * @param customer_id    UUID of the customer profile
 * @param restaurant_id  UUID of the restaurant whose geofence was entered
 * @param notification_sent  Whether the push notification was sent (default: true)
 * @returns              The created GeofenceEvent record
 */
export async function recordEvent(
  customer_id: string,
  restaurant_id: string,
  notification_sent = true,
): Promise<GeofenceEvent> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('customer_geofence_events')
    .insert({
      customer_id,
      restaurant_id,
      notification_sent,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as GeofenceEvent
}

// ── getDailyCount ─────────────────────────────────────────────────────────────

/**
 * Returns the total number of geofence notification events recorded for a
 * customer on a given calendar day (UTC).
 *
 * Used to enforce the 3-notifications-per-day limit (Requirement 8.9).
 *
 * @param customer_id  UUID of the customer profile
 * @param date         The calendar day to query (time component is ignored)
 * @returns            Count of geofence events on that day
 */
export async function getDailyCount(customer_id: string, date: Date): Promise<number> {
  const supabase = createAdminClient()

  // Build UTC day boundaries
  const dayStart = new Date(date)
  dayStart.setUTCHours(0, 0, 0, 0)

  const dayEnd = new Date(date)
  dayEnd.setUTCHours(23, 59, 59, 999)

  const { count, error } = await supabase
    .from('customer_geofence_events')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customer_id)
    .gte('entered_at', dayStart.toISOString())
    .lte('entered_at', dayEnd.toISOString())

  if (error) throw new Error(error.message)
  return count ?? 0
}

// ── getRestaurantCount24h ─────────────────────────────────────────────────────

/**
 * Returns the number of geofence notification events recorded for a customer
 * at a specific restaurant within the last 24 hours.
 *
 * Used to enforce the 1-notification-per-restaurant-per-24h limit (Requirement 8.3).
 *
 * @param customer_id    UUID of the customer profile
 * @param restaurant_id  UUID of the restaurant
 * @returns              Count of geofence events in the last 24 hours for that restaurant
 */
export async function getRestaurantCount24h(
  customer_id: string,
  restaurant_id: string,
): Promise<number> {
  const supabase = createAdminClient()

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { count, error } = await supabase
    .from('customer_geofence_events')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customer_id)
    .eq('restaurant_id', restaurant_id)
    .gte('entered_at', since)

  if (error) throw new Error(error.message)
  return count ?? 0
}

// ── Haversine helper ──────────────────────────────────────────────────────────

/**
 * Calculates the great-circle distance in meters between two GPS coordinates
 * using the Haversine formula.
 *
 * @param lat1  Latitude of point 1 (degrees)
 * @param lng1  Longitude of point 1 (degrees)
 * @param lat2  Latitude of point 2 (degrees)
 * @param lng2  Longitude of point 2 (degrees)
 * @returns     Distance in meters
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
