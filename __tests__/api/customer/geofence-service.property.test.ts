// ══════════════════════════════════════════════════════════════════════════════
//  GeofenceService Property Tests
//  __tests__/api/customer/geofence-service.property.test.ts
//
//  Property-based tests for GeofenceService rate-limiting logic.
//  These tests operate on PURE simulation functions that replicate the
//  rate-limiting logic from GeofenceService — no Supabase mocks required.
//
//  Feature: usuario-comensal
//  Properties: 8, 9
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import { expect } from 'vitest'
import {
  arbGeofenceConfig,
  arbGpsCoordinate,
  arbUuid,
} from '@/__tests__/setup/fast-check-arbitraries'
import { haversineDistanceMeters } from '@/lib/customer/geofence-service'

// ── Constants (mirrors GeofenceService) ──────────────────────────────────────

const MAX_DAILY_NOTIFICATIONS = 3
const MAX_PER_RESTAURANT_24H = 1

// ── Pure simulation types ─────────────────────────────────────────────────────

interface SimGeofenceEvent {
  customer_id: string
  restaurant_id: string
  entered_at: number // epoch ms
}

interface SimRestaurant {
  id: string
  center_lat: number
  center_lng: number
  radius_m: number
}

// ── Pure simulation helpers ───────────────────────────────────────────────────

/**
 * Counts how many geofence events a customer has on a given UTC calendar day.
 * Replicates getDailyCount() logic from GeofenceService.
 */
function simGetDailyCount(
  events: SimGeofenceEvent[],
  customer_id: string,
  dayEpochMs: number,
): number {
  const dayStart = new Date(dayEpochMs)
  dayStart.setUTCHours(0, 0, 0, 0)
  const dayEnd = new Date(dayEpochMs)
  dayEnd.setUTCHours(23, 59, 59, 999)

  return events.filter(
    (e) =>
      e.customer_id === customer_id &&
      e.entered_at >= dayStart.getTime() &&
      e.entered_at <= dayEnd.getTime(),
  ).length
}

/**
 * Counts how many geofence events a customer has for a specific restaurant
 * within the last 24 hours from a reference time.
 * Replicates getRestaurantCount24h() logic from GeofenceService.
 */
function simGetRestaurantCount24h(
  events: SimGeofenceEvent[],
  customer_id: string,
  restaurant_id: string,
  nowMs: number,
): number {
  const since = nowMs - 24 * 60 * 60 * 1000
  return events.filter(
    (e) =>
      e.customer_id === customer_id &&
      e.restaurant_id === restaurant_id &&
      e.entered_at >= since,
  ).length
}

/**
 * Simulates the full checkGeofences + recordEvent flow for a single GPS update.
 * Returns the updated events array after processing all restaurants.
 *
 * Replicates the rate-limiting logic from checkGeofences() in GeofenceService:
 * - Max 3 notifications per customer per calendar day (Requirement 8.9)
 * - Max 1 notification per customer per restaurant in any 24h window (Requirement 8.3)
 */
function simProcessGpsUpdate(
  events: SimGeofenceEvent[],
  customer_id: string,
  lat: number,
  lng: number,
  restaurants: SimRestaurant[],
  nowMs: number,
): SimGeofenceEvent[] {
  const updatedEvents = [...events]

  // Filter restaurants whose geofence the customer is currently inside
  const insideGeofences = restaurants.filter((r) => {
    const distanceM = haversineDistanceMeters(lat, lng, r.center_lat, r.center_lng)
    return distanceM <= r.radius_m
  })

  if (insideGeofences.length === 0) return updatedEvents

  // Check daily notification count
  const todayCount = simGetDailyCount(updatedEvents, customer_id, nowMs)
  let notificationsSentThisUpdate = 0

  for (const restaurant of insideGeofences) {
    // If daily limit already reached, skip
    if (todayCount + notificationsSentThisUpdate >= MAX_DAILY_NOTIFICATIONS) {
      break
    }

    // Check per-restaurant 24h limit
    const count24h = simGetRestaurantCount24h(
      updatedEvents,
      customer_id,
      restaurant.id,
      nowMs,
    )
    if (count24h >= MAX_PER_RESTAURANT_24H) {
      continue
    }

    // Record the event (notification sent)
    updatedEvents.push({
      customer_id,
      restaurant_id: restaurant.id,
      entered_at: nowMs,
    })
    notificationsSentThisUpdate++
  }

  return updatedEvents
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates a list of restaurants with geofence configs.
 * Uses arbGeofenceConfig() and arbUuid() from fast-check-arbitraries.ts.
 */
function arbRestaurantList(
  minLength = 1,
  maxLength = 5,
): fc.Arbitrary<SimRestaurant[]> {
  return fc
    .array(
      fc.record({
        id: arbUuid(),
        config: arbGeofenceConfig(),
      }),
      { minLength, maxLength },
    )
    .map((items) =>
      items.map(({ id, config }) => ({
        id,
        center_lat: config.center_lat,
        center_lng: config.center_lng,
        radius_m: config.radius_m,
      })),
    )
}

/**
 * Generates a sequence of GPS updates (lat/lng + timestamp offset in ms).
 * Timestamps are offsets within a single UTC calendar day (0 to 86399999 ms).
 */
function arbGpsUpdateSequence(
  minLength = 1,
  maxLength = 10,
): fc.Arbitrary<Array<{ lat: number; lng: number; offsetMs: number }>> {
  return fc.array(
    fc.record({
      coord: arbGpsCoordinate(),
      offsetMs: fc.integer({ min: 0, max: 86_399_999 }),
    }),
    { minLength, maxLength },
  ).map((items) =>
    items.map(({ coord, offsetMs }) => ({
      lat: coord.lat,
      lng: coord.lng,
      offsetMs,
    })),
  )
}

// ── Property 8: Geofence daily rate limit invariant ───────────────────────────
//
// For any customer on any given calendar day, the total count of geofencing
// push notifications sent SHALL never exceed 3.
//
// **Validates: Requirements 8.9**

describe('GeofenceService — Property 8: Geofence daily rate limit invariant', () => {
  it(
    'total notifications per customer per day never exceeds 3',
    () => {
      fc.assert(
        fc.property(
          arbUuid(), // customer_id
          arbRestaurantList(1, 8), // up to 8 restaurants to stress the limit
          arbGpsUpdateSequence(1, 15), // up to 15 GPS updates in a day
          (customer_id, restaurants, updates) => {
            // Fix a reference day start (UTC midnight)
            const dayStartMs = new Date('2025-06-01T00:00:00.000Z').getTime()

            let events: SimGeofenceEvent[] = []

            for (const update of updates) {
              const nowMs = dayStartMs + update.offsetMs
              events = simProcessGpsUpdate(
                events,
                customer_id,
                update.lat,
                update.lng,
                restaurants,
                nowMs,
              )
            }

            // Count total notifications for this customer on this day
            const dailyCount = simGetDailyCount(events, customer_id, dayStartMs)

            // Property 8: daily count must never exceed MAX_DAILY_NOTIFICATIONS (3)
            expect(dailyCount).toBeLessThanOrEqual(MAX_DAILY_NOTIFICATIONS)
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'daily limit holds even when the customer is inside many restaurant geofences simultaneously',
    () => {
      fc.assert(
        fc.property(
          arbUuid(), // customer_id
          // Generate restaurants all centered at the same point so the customer
          // is always inside all of them
          fc.integer({ min: 4, max: 10 }).chain((count) =>
            fc.array(arbUuid(), { minLength: count, maxLength: count }).map((ids) =>
              ids.map((id) => ({
                id,
                center_lat: 0,
                center_lng: 0,
                radius_m: 2000, // large radius — customer always inside
              })),
            ),
          ),
          arbGpsUpdateSequence(3, 10),
          (customer_id, restaurants, updates) => {
            const dayStartMs = new Date('2025-06-01T00:00:00.000Z').getTime()
            let events: SimGeofenceEvent[] = []

            for (const update of updates) {
              const nowMs = dayStartMs + update.offsetMs
              // Place customer at the center of all geofences
              events = simProcessGpsUpdate(
                events,
                customer_id,
                0, // lat = 0 (center)
                0, // lng = 0 (center)
                restaurants,
                nowMs,
              )
            }

            const dailyCount = simGetDailyCount(events, customer_id, dayStartMs)
            expect(dailyCount).toBeLessThanOrEqual(MAX_DAILY_NOTIFICATIONS)
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'daily limit resets across different calendar days',
    () => {
      fc.assert(
        fc.property(
          arbUuid(), // customer_id
          // Single restaurant centered at origin with large radius
          arbUuid().map((id) => [
            { id, center_lat: 0, center_lng: 0, radius_m: 2000 },
          ]),
          fc.integer({ min: 2, max: 5 }), // number of days
          (customer_id, restaurants, numDays) => {
            const baseMs = new Date('2025-06-01T00:00:00.000Z').getTime()
            let events: SimGeofenceEvent[] = []

            for (let day = 0; day < numDays; day++) {
              const dayStartMs = baseMs + day * 86_400_000

              // Simulate 5 GPS updates per day (more than the daily limit)
              for (let i = 0; i < 5; i++) {
                const nowMs = dayStartMs + i * 3_600_000 // 1 hour apart
                events = simProcessGpsUpdate(
                  events,
                  customer_id,
                  0,
                  0,
                  restaurants,
                  nowMs,
                )
              }

              // Each day's count must not exceed 3
              const dailyCount = simGetDailyCount(events, customer_id, dayStartMs)
              expect(dailyCount).toBeLessThanOrEqual(MAX_DAILY_NOTIFICATIONS)
            }
          },
        ),
        { numRuns: 25 },
      )
    },
  )
})

// ── Property 9: Geofence per-restaurant rate limit invariant ──────────────────
//
// For any customer and any restaurant, the system SHALL not send more than 1
// geofencing push notification within any 24-hour window for that specific
// restaurant.
//
// **Validates: Requirements 8.3**

describe('GeofenceService — Property 9: Geofence per-restaurant rate limit invariant', () => {
  it(
    'at most 1 notification per customer per restaurant within any 24-hour window',
    () => {
      fc.assert(
        fc.property(
          arbUuid(), // customer_id
          arbUuid(), // restaurant_id (single restaurant to focus the test)
          fc.array(
            fc.integer({ min: 0, max: 47 * 3_600_000 }), // offsets over 48h
            { minLength: 1, maxLength: 20 },
          ),
          (customer_id, restaurant_id, offsetsMs) => {
            const baseMs = new Date('2025-06-01T00:00:00.000Z').getTime()
            const restaurant: SimRestaurant = {
              id: restaurant_id,
              center_lat: 0,
              center_lng: 0,
              radius_m: 2000,
            }

            let events: SimGeofenceEvent[] = []

            // Sort offsets to simulate chronological GPS updates
            const sortedOffsets = [...offsetsMs].sort((a, b) => a - b)

            for (const offsetMs of sortedOffsets) {
              const nowMs = baseMs + offsetMs
              events = simProcessGpsUpdate(
                events,
                customer_id,
                0, // always inside the geofence
                0,
                [restaurant],
                nowMs,
              )
            }

            // Verify the 24h invariant: no two events for the same restaurant
            // should be within 24h of each other.
            // This is the correct post-hoc check: for each pair of events for
            // the same (customer, restaurant), their timestamps must differ by
            // at least 24h.
            const restaurantEvents = events
              .filter((e) => e.customer_id === customer_id && e.restaurant_id === restaurant_id)
              .sort((a, b) => a.entered_at - b.entered_at)

            for (let i = 1; i < restaurantEvents.length; i++) {
              const gap = restaurantEvents[i].entered_at - restaurantEvents[i - 1].entered_at
              // Consecutive events for the same restaurant must be at least 24h apart
              expect(gap).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000)
            }
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'per-restaurant 24h limit holds across multiple restaurants independently',
    () => {
      fc.assert(
        fc.property(
          arbUuid(), // customer_id
          arbRestaurantList(2, 5), // 2–5 restaurants
          arbGpsUpdateSequence(1, 15),
          (customer_id, restaurants, updates) => {
            const baseMs = new Date('2025-06-01T00:00:00.000Z').getTime()
            let events: SimGeofenceEvent[] = []

            // Place all restaurants at origin so customer is always inside all of them
            const centeredRestaurants = restaurants.map((r) => ({
              ...r,
              center_lat: 0,
              center_lng: 0,
              radius_m: 2000,
            }))

            for (const update of updates) {
              const nowMs = baseMs + update.offsetMs
              events = simProcessGpsUpdate(
                events,
                customer_id,
                0,
                0,
                centeredRestaurants,
                nowMs,
              )
            }

            // For each restaurant, verify the 24h limit was never exceeded
            for (const restaurant of centeredRestaurants) {
              // Check at each event timestamp for this restaurant
              const restaurantEvents = events.filter(
                (e) =>
                  e.customer_id === customer_id &&
                  e.restaurant_id === restaurant.id,
              )

              for (const event of restaurantEvents) {
                const count24h = simGetRestaurantCount24h(
                  events,
                  customer_id,
                  restaurant.id,
                  event.entered_at,
                )
                expect(count24h).toBeLessThanOrEqual(MAX_PER_RESTAURANT_24H)
              }
            }
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'second entry to same restaurant after 24h window is allowed',
    () => {
      fc.assert(
        fc.property(
          arbUuid(), // customer_id
          arbUuid(), // restaurant_id
          fc.integer({ min: 24 * 3_600_001, max: 48 * 3_600_000 }), // gap > 24h
          (customer_id, restaurant_id, gapMs) => {
            const baseMs = new Date('2025-06-01T00:00:00.000Z').getTime()
            const restaurant: SimRestaurant = {
              id: restaurant_id,
              center_lat: 0,
              center_lng: 0,
              radius_m: 2000,
            }

            let events: SimGeofenceEvent[] = []

            // First entry
            events = simProcessGpsUpdate(events, customer_id, 0, 0, [restaurant], baseMs)

            // Second entry after the 24h window has passed
            const secondEntryMs = baseMs + gapMs
            events = simProcessGpsUpdate(
              events,
              customer_id,
              0,
              0,
              [restaurant],
              secondEntryMs,
            )

            // There should be exactly 2 events (one per entry, each in its own 24h window)
            const totalEvents = events.filter(
              (e) => e.customer_id === customer_id && e.restaurant_id === restaurant_id,
            )
            expect(totalEvents.length).toBe(2)

            // Verify the 24h limit at the time of the second entry
            const count24hAtSecond = simGetRestaurantCount24h(
              events,
              customer_id,
              restaurant_id,
              secondEntryMs,
            )
            expect(count24hAtSecond).toBeLessThanOrEqual(MAX_PER_RESTAURANT_24H)
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'second entry to same restaurant within 24h is blocked',
    () => {
      fc.assert(
        fc.property(
          arbUuid(), // customer_id
          arbUuid(), // restaurant_id
          fc.integer({ min: 1, max: 24 * 3_600_000 - 1 }), // gap < 24h
          (customer_id, restaurant_id, gapMs) => {
            const baseMs = new Date('2025-06-01T00:00:00.000Z').getTime()
            const restaurant: SimRestaurant = {
              id: restaurant_id,
              center_lat: 0,
              center_lng: 0,
              radius_m: 2000,
            }

            let events: SimGeofenceEvent[] = []

            // First entry
            events = simProcessGpsUpdate(events, customer_id, 0, 0, [restaurant], baseMs)

            // Second entry within the 24h window
            const secondEntryMs = baseMs + gapMs
            events = simProcessGpsUpdate(
              events,
              customer_id,
              0,
              0,
              [restaurant],
              secondEntryMs,
            )

            // Only 1 event should exist (second entry was blocked)
            const totalEvents = events.filter(
              (e) => e.customer_id === customer_id && e.restaurant_id === restaurant_id,
            )
            expect(totalEvents.length).toBe(1)
          },
        ),
        { numRuns: 25 },
      )
    },
  )
})

// ── Haversine integration: geofence boundary detection ────────────────────────
//
// Verifies that haversineDistanceMeters correctly determines whether a customer
// is inside or outside a geofence, which is the prerequisite for rate limiting.

describe('GeofenceService — haversineDistanceMeters boundary detection', () => {
  it(
    'customer at geofence center is always inside the geofence',
    () => {
      fc.assert(
        fc.property(arbGeofenceConfig(), (config) => {
          const distance = haversineDistanceMeters(
            config.center_lat,
            config.center_lng,
            config.center_lat,
            config.center_lng,
          )
          expect(distance).toBe(0)
          expect(distance).toBeLessThanOrEqual(config.radius_m)
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'haversineDistanceMeters is symmetric: dist(A, B) === dist(B, A)',
    () => {
      fc.assert(
        fc.property(arbGpsCoordinate(), arbGpsCoordinate(), (a, b) => {
          const distAB = haversineDistanceMeters(a.lat, a.lng, b.lat, b.lng)
          const distBA = haversineDistanceMeters(b.lat, b.lng, a.lat, a.lng)
          // Allow tiny floating-point tolerance
          expect(Math.abs(distAB - distBA)).toBeLessThan(0.001)
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'haversineDistanceMeters always returns a non-negative value',
    () => {
      fc.assert(
        fc.property(arbGpsCoordinate(), arbGpsCoordinate(), (a, b) => {
          const dist = haversineDistanceMeters(a.lat, a.lng, b.lat, b.lng)
          expect(dist).toBeGreaterThanOrEqual(0)
        }),
        { numRuns: 25 },
      )
    },
  )
})
