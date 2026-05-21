// ══════════════════════════════════════════════════════════════════════════════
//  TrackingService Property Tests
//  __tests__/api/customer/tracking-service.property.test.ts
//
//  Property-based tests for GPS coordinate validation invariants.
//
//  Feature: usuario-comensal
//  Property: 7
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { arbGpsCoordinate } from '@/__tests__/setup/fast-check-arbitraries'
import { validateGpsCoordinates } from '@/lib/customer/tracking-service'

// ── Property 7: Delivery tracking GPS coordinate invariants ─────────────────
//
// For any GPS coordinate processed by TrackingService, latitude SHALL be in
// [-90, 90] and longitude SHALL be in [-180, 180].
//
// **Validates: Requirements 6.3**

describe('TrackingService — Property 7: Delivery tracking GPS coordinate invariants', () => {
  it('validateGpsCoordinates accepts any coordinate from arbGpsCoordinate()', () => {
    fc.assert(
      fc.property(arbGpsCoordinate(), ({ lat, lng }) => {
        expect(() => validateGpsCoordinates(lat, lng)).not.toThrow()
        expect(lat).toBeGreaterThanOrEqual(-90)
        expect(lat).toBeLessThanOrEqual(90)
        expect(lng).toBeGreaterThanOrEqual(-180)
        expect(lng).toBeLessThanOrEqual(180)
      }),
      { numRuns: 25 },
    )
  })

  it('rejects latitude outside [-90, 90] for any longitude in range', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.float({ min: Math.fround(-180), max: Math.fround(-90.0001), noNaN: true }),
          fc.float({ min: Math.fround(90.0001), max: Math.fround(180), noNaN: true }),
        ),
        arbGpsCoordinate().map((c) => c.lng),
        (invalidLat, lng) => {
          expect(() => validateGpsCoordinates(invalidLat, lng)).toThrow('Latitud inválida')
        },
      ),
      { numRuns: 25 },
    )
  })

  it('rejects longitude outside [-180, 180] for any latitude in range', () => {
    fc.assert(
      fc.property(
        arbGpsCoordinate().map((c) => c.lat),
        fc.oneof(
          fc.float({ min: Math.fround(-360), max: Math.fround(-180.0001), noNaN: true }),
          fc.float({ min: Math.fround(180.0001), max: Math.fround(360), noNaN: true }),
        ),
        (lat, invalidLng) => {
          expect(() => validateGpsCoordinates(lat, invalidLng)).toThrow('Longitud inválida')
        },
      ),
      { numRuns: 25 },
    )
  })

  it('boundary values at lat=±90 and lng=±180 are accepted', () => {
    const boundaries = [
      { lat: 90, lng: 180 },
      { lat: 90, lng: -180 },
      { lat: -90, lng: 180 },
      { lat: -90, lng: -180 },
      { lat: 0, lng: 0 },
    ]
    for (const { lat, lng } of boundaries) {
      expect(() => validateGpsCoordinates(lat, lng)).not.toThrow()
    }
  })
})
