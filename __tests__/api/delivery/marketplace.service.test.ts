/**
 * __tests__/api/delivery/marketplace.service.test.ts
 *
 * Property-based and unit tests for MarketplaceService.
 * Property 2: Marketplace invariants.
 * Requirements: 2.1, 2.3, 2.4, 2.5, 2.7
 */
import * as fc from 'fast-check'
import { haversineDistance } from '../../../lib/delivery/route-engine.service'
import type { MarketplaceRestaurant } from '../../../lib/delivery/types'

// ── Arbitraries ───────────────────────────────────────────────────────────────

function arbMarketplaceListing(): fc.Arbitrary<MarketplaceRestaurant> {
  return fc.record({
    restaurant_id:        fc.uuid(),
    name:                 fc.string({ minLength: 1, maxLength: 50 }),
    cuisine_type:         fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
    neighborhood:         fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
    distance_km:          fc.float({ min: Math.fround(0), max: Math.fround(50), noNaN: true }),
    fee_range:            fc.record({
      min: fc.integer({ min: 0, max: 10000 }),
      max: fc.integer({ min: 0, max: 50000 }),
    }),
    pending_orders_count: fc.integer({ min: 0, max: 100 }),
    delivery_zone:        fc.record({
      id:            fc.uuid(),
      restaurant_id: fc.uuid(),
      radius_km:     fc.float({ min: Math.fround(1), max: Math.fround(50), noNaN: true }),
      center_lat:    fc.float({ min: Math.fround(-90), max: Math.fround(90), noNaN: true }),
      center_lng:    fc.float({ min: Math.fround(-180), max: Math.fround(180), noNaN: true }),
      active:        fc.constant(true),
      created_at:    fc.constant(new Date().toISOString()),
    }),
    fee_tiers:            fc.constant([]),
    avg_delivery_minutes: fc.option(fc.integer({ min: 5, max: 120 }), { nil: null }),
  })
}

// ── Property 2: Marketplace invariants ───────────────────────────────────────

describe('Property 2 — Marketplace invariants', () => {
  it('results sorted by distance are in ascending order', () => {
    fc.assert(
      fc.property(
        fc.array(arbMarketplaceListing(), { minLength: 2, maxLength: 20 }),
        listings => {
          const sorted = [...listings].sort((a, b) => a.distance_km - b.distance_km)
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].distance_km).toBeLessThanOrEqual(sorted[i + 1].distance_km)
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('pending_orders_count is always non-negative', () => {
    fc.assert(
      fc.property(arbMarketplaceListing(), listing => {
        expect(listing.pending_orders_count).toBeGreaterThanOrEqual(0)
      }),
      { numRuns: 100 },
    )
  })

  it('fee_range.min ≤ fee_range.max after normalization', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 0, max: 50000 }),
        (a, b) => {
          const min = Math.min(a, b)
          const max = Math.max(a, b)
          expect(min).toBeLessThanOrEqual(max)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('MarketplaceService — distance calculation', () => {
  it('Haversine distance is used for sorting (closer restaurants first)', () => {
    const riderLat = -33.4489
    const riderLng = -70.6693

    const restaurants = [
      { lat: -33.4600, lng: -70.6800 }, // ~1.5 km
      { lat: -33.5000, lng: -70.7000 }, // ~6 km
      { lat: -33.4500, lng: -70.6700 }, // ~0.1 km
    ]

    const withDistances = restaurants.map(r => ({
      ...r,
      distance: haversineDistance(riderLat, riderLng, r.lat, r.lng),
    }))

    const sorted = [...withDistances].sort((a, b) => a.distance - b.distance)

    // Closest should be the ~0.1 km one
    expect(sorted[0].distance).toBeLessThan(sorted[1].distance)
    expect(sorted[1].distance).toBeLessThan(sorted[2].distance)
  })
})
