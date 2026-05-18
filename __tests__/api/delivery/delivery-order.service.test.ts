/**
 * __tests__/api/delivery/delivery-order.service.test.ts
 *
 * Property-based and unit tests for DeliveryOrderService.
 * Properties 3, 4, 5 (state machine, fee calculation, rider initial state).
 * Requirements: 3.3, 3.5, 3.6, 7.5, 1.2, 1.6, 1.8
 */
import * as fc from 'fast-check'
import {
  canTransition,
  calculateDeliveryFee,
  VALID_TRANSITIONS,
} from '../../../lib/delivery/delivery-order.service'
import type { DeliveryStatus, DeliveryFeeTier } from '../../../lib/delivery/types'

// ── Arbitraries ───────────────────────────────────────────────────────────────

const ALL_STATUSES: DeliveryStatus[] = [
  'pending_assignment', 'assigned', 'picked_up', 'in_transit',
  'delivered', 'cancelled', 'failed',
]

const TERMINAL_STATUSES: DeliveryStatus[] = ['delivered', 'cancelled', 'failed']

function arbDeliveryStatus(): fc.Arbitrary<DeliveryStatus> {
  return fc.constantFrom(...ALL_STATUSES)
}

function arbTerminalStatus(): fc.Arbitrary<DeliveryStatus> {
  return fc.constantFrom(...TERMINAL_STATUSES)
}

/** Generates a non-overlapping, sorted fee tier configuration */
function arbDeliveryFeeTiers(): fc.Arbitrary<DeliveryFeeTier[]> {
  return fc
    .array(fc.float({ min: Math.fround(0.5), max: Math.fround(20), noNaN: true }), {
      minLength: 1,
      maxLength: 5,
    })
    .map(breakpoints => {
      const sorted = [...breakpoints].sort((a, b) => a - b)
      return sorted.map((bp, i) => ({
        id:            `tier-${i}`,
        restaurant_id: 'rest-1',
        min_km:        i === 0 ? 0 : sorted[i - 1],
        max_km:        i === sorted.length - 1 ? null : bp,
        fee_clp:       (i + 1) * 1000,
        vehicle_types: [] as any[],
        created_at:    new Date().toISOString(),
      }))
    })
}

// ── Property 3: Delivery state machine ───────────────────────────────────────

describe('Property 3 — Delivery state machine', () => {
  it('terminal states cannot transition to any other state', () => {
    fc.assert(
      fc.property(arbTerminalStatus(), arbDeliveryStatus(), (from, to) => {
        expect(canTransition(from, to)).toBe(false)
      }),
      { numRuns: 200 },
    )
  })

  it('valid transitions are only those defined in VALID_TRANSITIONS', () => {
    fc.assert(
      fc.property(arbDeliveryStatus(), arbDeliveryStatus(), (from, to) => {
        const expected = VALID_TRANSITIONS[from]?.includes(to) ?? false
        expect(canTransition(from, to)).toBe(expected)
      }),
      { numRuns: 300 },
    )
  })

  it('pending_assignment can only go to assigned or cancelled', () => {
    expect(canTransition('pending_assignment', 'assigned')).toBe(true)
    expect(canTransition('pending_assignment', 'cancelled')).toBe(true)
    expect(canTransition('pending_assignment', 'delivered')).toBe(false)
    expect(canTransition('pending_assignment', 'failed')).toBe(false)
    expect(canTransition('pending_assignment', 'in_transit')).toBe(false)
  })

  it('in_transit can only go to delivered or failed', () => {
    expect(canTransition('in_transit', 'delivered')).toBe(true)
    expect(canTransition('in_transit', 'failed')).toBe(true)
    expect(canTransition('in_transit', 'assigned')).toBe(false)
    expect(canTransition('in_transit', 'pending_assignment')).toBe(false)
  })
})

// ── Property 4: Delivery fee calculation ─────────────────────────────────────

describe('Property 4 — Delivery fee calculation', () => {
  it('fee is never negative for any distance and tier config', () => {
    fc.assert(
      fc.property(
        arbDeliveryFeeTiers(),
        fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
        (tiers, distanceKm) => {
          const fee = calculateDeliveryFee(tiers, distanceKm)
          expect(fee).toBeGreaterThanOrEqual(0)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('generated tiers are non-overlapping and sorted', () => {
    fc.assert(
      fc.property(arbDeliveryFeeTiers(), tiers => {
        for (let i = 0; i < tiers.length - 1; i++) {
          const current = tiers[i]
          const next    = tiers[i + 1]
          expect(current.max_km).not.toBeNull()
          expect(current.max_km!).toBeLessThanOrEqual(next.min_km)
        }
        // Last tier has no upper limit
        expect(tiers[tiers.length - 1].max_km).toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  it('returns the fee of the matching tier', () => {
    const tiers: DeliveryFeeTier[] = [
      { id: '1', restaurant_id: 'r', min_km: 0, max_km: 3,    fee_clp: 2000, vehicle_types: [], created_at: '' },
      { id: '2', restaurant_id: 'r', min_km: 3, max_km: 7,    fee_clp: 3500, vehicle_types: [], created_at: '' },
      { id: '3', restaurant_id: 'r', min_km: 7, max_km: null, fee_clp: 5000, vehicle_types: [], created_at: '' },
    ]
    expect(calculateDeliveryFee(tiers, 0)).toBe(2000)
    expect(calculateDeliveryFee(tiers, 1.5)).toBe(2000)
    expect(calculateDeliveryFee(tiers, 3)).toBe(3500)
    expect(calculateDeliveryFee(tiers, 5)).toBe(3500)
    expect(calculateDeliveryFee(tiers, 7)).toBe(5000)
    expect(calculateDeliveryFee(tiers, 50)).toBe(5000)
  })

  it('returns 0 for empty tier config', () => {
    expect(calculateDeliveryFee([], 5)).toBe(0)
  })
})

// ── Property 6: Model serialization round-trip ────────────────────────────────

describe('Property 6 — Model serialization round-trip', () => {
  it('DeliveryFeeTier serializes and deserializes correctly', () => {
    fc.assert(
      fc.property(arbDeliveryFeeTiers(), tiers => {
        const serialized   = JSON.stringify(tiers)
        const deserialized = JSON.parse(serialized)
        expect(deserialized).toEqual(tiers)
      }),
      { numRuns: 100 },
    )
  })
})
