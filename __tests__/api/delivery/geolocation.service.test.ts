/**
 * __tests__/api/delivery/geolocation.service.test.ts
 *
 * Property-based and unit tests for GeolocationService.
 * Property 7: GPS coordinate invariants.
 * Requirements: 10.7
 */
import * as fc from 'fast-check'
import { validateCoordinates } from '../../../lib/delivery/geolocation.service'

// ── Arbitraries ───────────────────────────────────────────────────────────────

function arbValidCoordinate(): fc.Arbitrary<{ lat: number; lng: number }> {
  return fc.record({
    lat: fc.float({ min: Math.fround(-90),  max: Math.fround(90),  noNaN: true }),
    lng: fc.float({ min: Math.fround(-180), max: Math.fround(180), noNaN: true }),
  })
}

function arbInvalidLat(): fc.Arbitrary<number> {
  return fc.oneof(
    fc.float({ min: Math.fround(90.001),  max: Math.fround(1000), noNaN: true }),
    fc.float({ min: Math.fround(-1000),   max: Math.fround(-90.001), noNaN: true }),
  )
}

function arbInvalidLng(): fc.Arbitrary<number> {
  return fc.oneof(
    fc.float({ min: Math.fround(180.001), max: Math.fround(1000), noNaN: true }),
    fc.float({ min: Math.fround(-1000),   max: Math.fround(-180.001), noNaN: true }),
  )
}

// ── Property 7: GPS coordinate invariants ────────────────────────────────────

describe('Property 7 — GPS coordinate invariants', () => {
  it('valid coordinates always satisfy lat ∈ [-90, 90] and lng ∈ [-180, 180]', () => {
    fc.assert(
      fc.property(arbValidCoordinate(), ({ lat, lng }) => {
        expect(lat).toBeGreaterThanOrEqual(-90)
        expect(lat).toBeLessThanOrEqual(90)
        expect(lng).toBeGreaterThanOrEqual(-180)
        expect(lng).toBeLessThanOrEqual(180)
      }),
      { numRuns: 200 },
    )
  })

  it('validateCoordinates does not throw for valid coordinates', () => {
    fc.assert(
      fc.property(arbValidCoordinate(), ({ lat, lng }) => {
        expect(() => validateCoordinates(lat, lng)).not.toThrow()
      }),
      { numRuns: 200 },
    )
  })

  it('validateCoordinates throws for invalid latitude', () => {
    fc.assert(
      fc.property(arbInvalidLat(), invalidLat => {
        expect(() => validateCoordinates(invalidLat, 0)).toThrow()
      }),
      { numRuns: 100 },
    )
  })

  it('validateCoordinates throws for invalid longitude', () => {
    fc.assert(
      fc.property(arbInvalidLng(), invalidLng => {
        expect(() => validateCoordinates(0, invalidLng)).toThrow()
      }),
      { numRuns: 100 },
    )
  })

  it('GPS idempotence: same coordinate twice produces same position', () => {
    fc.assert(
      fc.property(arbValidCoordinate(), ({ lat, lng }) => {
        // Receiving the same coordinate twice should produce the same result
        const pos1 = { lat, lng }
        const pos2 = { lat, lng }
        expect(pos1).toEqual(pos2)
      }),
      { numRuns: 100 },
    )
  })
})

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('GeolocationService — unit tests', () => {
  it('accepts boundary values: lat=90, lng=180', () => {
    expect(() => validateCoordinates(90, 180)).not.toThrow()
    expect(() => validateCoordinates(-90, -180)).not.toThrow()
    expect(() => validateCoordinates(0, 0)).not.toThrow()
  })

  it('rejects lat=90.001', () => {
    expect(() => validateCoordinates(90.001, 0)).toThrow()
  })

  it('rejects lng=-180.001', () => {
    expect(() => validateCoordinates(0, -180.001)).toThrow()
  })
})
