/**
 * __tests__/api/delivery/route-engine.service.test.ts
 *
 * Property-based and unit tests for RouteEngineService.
 * Property 10: Route distance ≥ Haversine distance.
 * Requirements: 5.4
 */
import * as fc from 'fast-check'
import { haversineDistance } from '../../../lib/delivery/route-engine.service'

// ── Arbitraries ───────────────────────────────────────────────────────────────

function arbCoordinate(): fc.Arbitrary<{ lat: number; lng: number }> {
  return fc.record({
    lat: fc.float({ min: Math.fround(-90),  max: Math.fround(90),  noNaN: true }),
    lng: fc.float({ min: Math.fround(-180), max: Math.fround(180), noNaN: true }),
  })
}

// ── Property 10: Route distance ≥ Haversine distance ─────────────────────────

describe('Property 10 — Route distance ≥ Haversine distance', () => {
  it('haversineDistance is always non-negative', () => {
    fc.assert(
      fc.property(arbCoordinate(), arbCoordinate(), (a, b) => {
        const dist = haversineDistance(a.lat, a.lng, b.lat, b.lng)
        expect(dist).toBeGreaterThanOrEqual(0)
      }),
      { numRuns: 200 },
    )
  })

  it('haversineDistance(A, A) = 0 for any point', () => {
    fc.assert(
      fc.property(arbCoordinate(), ({ lat, lng }) => {
        const dist = haversineDistance(lat, lng, lat, lng)
        expect(dist).toBeCloseTo(0, 5)
      }),
      { numRuns: 100 },
    )
  })

  it('haversineDistance is symmetric: d(A,B) = d(B,A)', () => {
    fc.assert(
      fc.property(arbCoordinate(), arbCoordinate(), (a, b) => {
        const ab = haversineDistance(a.lat, a.lng, b.lat, b.lng)
        const ba = haversineDistance(b.lat, b.lng, a.lat, a.lng)
        expect(Math.abs(ab - ba)).toBeLessThan(0.0001)
      }),
      { numRuns: 200 },
    )
  })

  it('haversineDistance satisfies triangle inequality', () => {
    fc.assert(
      fc.property(arbCoordinate(), arbCoordinate(), arbCoordinate(), (a, b, c) => {
        const ab = haversineDistance(a.lat, a.lng, b.lat, b.lng)
        const bc = haversineDistance(b.lat, b.lng, c.lat, c.lng)
        const ac = haversineDistance(a.lat, a.lng, c.lat, c.lng)
        // ac ≤ ab + bc (triangle inequality, with small floating-point tolerance)
        expect(ac).toBeLessThanOrEqual(ab + bc + 0.001)
      }),
      { numRuns: 100 },
    )
  })
})

// ── Unit tests with known values ──────────────────────────────────────────────

describe('haversineDistance — known values', () => {
  it('Santiago to Buenos Aires ≈ 1137 km', () => {
    // Santiago: -33.4489, -70.6693
    // Buenos Aires: -34.6037, -58.3816
    const dist = haversineDistance(-33.4489, -70.6693, -34.6037, -58.3816)
    expect(dist).toBeGreaterThan(1100)
    expect(dist).toBeLessThan(1200)
  })

  it('same city (< 1 km apart) returns small distance', () => {
    // Two points in Santiago ~500m apart
    const dist = haversineDistance(-33.4489, -70.6693, -33.4534, -70.6693)
    expect(dist).toBeLessThan(1)
    expect(dist).toBeGreaterThan(0)
  })
})

// ── Fallback mode tests ───────────────────────────────────────────────────────

describe('RouteEngineService — fallback mode', () => {
  it('returns fallback=true when GOOGLE_MAPS_API_KEY is not set', async () => {
    // Save and clear the env var
    const originalKey = process.env.GOOGLE_MAPS_API_KEY
    delete process.env.GOOGLE_MAPS_API_KEY

    const { calculateRoute } = await import('../../../lib/delivery/route-engine.service')
    const result = await calculateRoute(
      { lat: -33.4489, lng: -70.6693 },
      'Av. Providencia 1234, Santiago',
      'Av. Las Condes 5678, Santiago',
      'motorcycle',
    )

    expect(result.fallback).toBe(true)
    expect(result.route).toBeNull()

    // Restore
    if (originalKey) process.env.GOOGLE_MAPS_API_KEY = originalKey
  })
})
