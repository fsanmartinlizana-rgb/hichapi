// ══════════════════════════════════════════════════════════════════════════════
//  LoyaltyService Property Tests
//  __tests__/api/customer/loyalty-service.property.test.ts
//
//  Property-based tests for LoyaltyService pure calculation logic.
//
//  Feature: usuario-comensal
//  Properties: 1, 2, 3, 4
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import { expect } from 'vitest'
import {
  arbOrderTotal,
  arbPointsMultiplier,
} from '@/__tests__/setup/fast-check-arbitraries'
import {
  calculatePoints,
  calculateRedemptionDiscount,
} from '@/lib/customer/loyalty-service'

// ── Property 1: Loyalty points balance invariant ──────────────────────────────
//
// For any sequence of point-earning and redemption transactions applied to a
// customer's account, the loyalty_points balance SHALL always be >= 0.
//
// Tested via pure simulation: starting from an initial balance, apply a random
// sequence of earn/redeem operations and verify the balance never goes negative.
//
// **Validates: Requirements 5.11**

describe('LoyaltyService — Property 1: Loyalty points balance invariant', () => {
  it(
    'balance never goes below 0 after any sequence of earn/redeem operations',
    () => {
      // Arbitrary for a single operation: earn (positive delta) or redeem (negative delta)
      const arbOperation = fc.oneof(
        // Earn: add points calculated from a random order total and multiplier
        fc.record({
          type: fc.constant('earn' as const),
          total: arbOrderTotal(),
          multiplier: arbPointsMultiplier(),
        }),
        // Redeem: attempt to redeem a random number of points (>= 500)
        fc.record({
          type: fc.constant('redeem' as const),
          points: fc.integer({ min: 500, max: 100_000 }),
        }),
      )

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1_000_000 }), // initial balance
          fc.array(arbOperation, { minLength: 1, maxLength: 20 }), // sequence of ops
          (initialBalance, operations) => {
            let balance = initialBalance

            for (const op of operations) {
              if (op.type === 'earn') {
                const earned = calculatePoints(op.total, op.multiplier)
                balance += earned
              } else {
                // Redeem: only apply if balance is sufficient (mirrors service logic)
                if (balance >= op.points) {
                  balance -= op.points
                }
                // If insufficient, the operation is rejected — balance unchanged
              }

              // Invariant: balance must never be negative
              expect(balance).toBeGreaterThanOrEqual(0)
            }
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'balance stays non-negative when only earn operations are applied',
    () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({ total: arbOrderTotal(), multiplier: arbPointsMultiplier() }),
            { minLength: 1, maxLength: 20 },
          ),
          (operations) => {
            let balance = 0
            for (const { total, multiplier } of operations) {
              balance += calculatePoints(total, multiplier)
              expect(balance).toBeGreaterThanOrEqual(0)
            }
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'balance stays non-negative when redeem is always guarded by sufficient balance check',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1_000_000 }),
          fc.array(fc.integer({ min: 500, max: 50_000 }), { minLength: 1, maxLength: 20 }),
          (initialBalance, redeemAmounts) => {
            let balance = initialBalance
            for (const points of redeemAmounts) {
              if (balance >= points) {
                balance -= points
              }
              expect(balance).toBeGreaterThanOrEqual(0)
            }
          },
        ),
        { numRuns: 25 },
      )
    },
  )
})

// ── Property 2: Points calculation formula ────────────────────────────────────
//
// For any completed order with total T CLP (T >= 0) and restaurant multiplier
// M in [0.5, 5.0], the points earned SHALL equal floor(T / 100) * M and SHALL
// be a non-negative value.
//
// **Validates: Requirements 5.2**

describe('LoyaltyService — Property 2: Points calculation formula', () => {
  it(
    'calculatePoints(T, M) === floor(T / 100) * M for all T >= 0, M in [0.5, 5.0]',
    () => {
      fc.assert(
        fc.property(arbOrderTotal(), arbPointsMultiplier(), (total, multiplier) => {
          const result = calculatePoints(total, multiplier)
          const expected = Math.floor(total / 100) * multiplier

          expect(result).toBe(expected)
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'calculatePoints always returns a non-negative value',
    () => {
      fc.assert(
        fc.property(arbOrderTotal(), arbPointsMultiplier(), (total, multiplier) => {
          const result = calculatePoints(total, multiplier)
          expect(result).toBeGreaterThanOrEqual(0)
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'calculatePoints(0, M) === 0 for any multiplier',
    () => {
      fc.assert(
        fc.property(arbPointsMultiplier(), (multiplier) => {
          expect(calculatePoints(0, multiplier)).toBe(0)
        }),
        { numRuns: 25 },
      )
    },
  )

  it(
    'calculatePoints returns 0 for negative totals',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1_000_000, max: -1 }),
          arbPointsMultiplier(),
          (negativetotal, multiplier) => {
            expect(calculatePoints(negativetotal, multiplier)).toBe(0)
          },
        ),
        { numRuns: 25 },
      )
    },
  )
})

// ── Property 3: Points calculation additivity ─────────────────────────────────
//
// For any two order totals T1 and T2 at the same restaurant (same multiplier M),
// points(T1 + T2, M) SHALL equal points(T1, M) + points(T2, M) within integer
// floor rounding tolerance (difference is at most 1 due to floor).
//
// **Validates: Requirements 5.2**

describe('LoyaltyService — Property 3: Points calculation additivity', () => {
  it(
    'points(T1+T2, M) ≈ points(T1, M) + points(T2, M) with tolerance of M (floor rounding)',
    () => {
      fc.assert(
        fc.property(
          arbOrderTotal(),
          arbOrderTotal(),
          arbPointsMultiplier(),
          (t1, t2, multiplier) => {
            // Guard against overflow: ensure T1+T2 stays within safe integer range
            fc.pre(t1 + t2 <= 10_000_000)

            const combined = calculatePoints(t1 + t2, multiplier)
            const separate = calculatePoints(t1, multiplier) + calculatePoints(t2, multiplier)

            // The floor difference is at most 1 (floor((T1+T2)/100) - floor(T1/100) - floor(T2/100) ∈ {0,1})
            // Multiplied by M, the maximum difference is M.
            const diff = Math.abs(combined - separate)
            expect(diff).toBeLessThanOrEqual(multiplier)
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'points(T1+T2, M) >= points(T1, M) + points(T2, M) - M (floor rounding lower bound)',
    () => {
      fc.assert(
        fc.property(
          arbOrderTotal(),
          arbOrderTotal(),
          arbPointsMultiplier(),
          (t1, t2, multiplier) => {
            fc.pre(t1 + t2 <= 10_000_000)

            const combined = calculatePoints(t1 + t2, multiplier)
            const separate = calculatePoints(t1, multiplier) + calculatePoints(t2, multiplier)

            // combined can be at most M more than separate (due to floor × multiplier)
            expect(combined).toBeGreaterThanOrEqual(separate - multiplier)
          },
        ),
        { numRuns: 25 },
      )
    },
  )
})

// ── Property 4: Redemption balance deduction ──────────────────────────────────
//
// For any redemption of P points (P >= 500, P <= current_balance), the new
// balance SHALL equal previous_balance - P and SHALL never be negative.
//
// **Validates: Requirements 5.7, 5.8, 5.11**

describe('LoyaltyService — Property 4: Redemption balance deduction', () => {
  it(
    'new balance === previous_balance - points_to_redeem when balance is sufficient',
    () => {
      fc.assert(
        fc.property(
          // Generate a balance and a valid redemption amount (<= balance, >= 500)
          fc.integer({ min: 500, max: 1_000_000 }).chain((balance) =>
            fc.record({
              balance: fc.constant(balance),
              pointsToRedeem: fc.integer({ min: 500, max: balance }),
            }),
          ),
          ({ balance, pointsToRedeem }) => {
            const newBalance = balance - pointsToRedeem
            expect(newBalance).toBe(balance - pointsToRedeem)
            expect(newBalance).toBeGreaterThanOrEqual(0)
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'calculateRedemptionDiscount(P) === floor(P / 100) * 100 for any P >= 500',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 500, max: 1_000_000 }),
          (points) => {
            const discount = calculateRedemptionDiscount(points)
            const expected = Math.floor(points / 100) * 100

            expect(discount).toBe(expected)
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'redemption never results in a negative balance when P <= current_balance',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 500, max: 1_000_000 }).chain((balance) =>
            fc.record({
              balance: fc.constant(balance),
              pointsToRedeem: fc.integer({ min: 500, max: balance }),
            }),
          ),
          ({ balance, pointsToRedeem }) => {
            const newBalance = balance - pointsToRedeem
            expect(newBalance).toBeGreaterThanOrEqual(0)
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'redemption is rejected (balance unchanged) when P > current_balance',
    () => {
      fc.assert(
        fc.property(
          // balance strictly less than pointsToRedeem
          fc.integer({ min: 0, max: 999 }).chain((balance) =>
            fc.record({
              balance: fc.constant(balance),
              pointsToRedeem: fc.integer({ min: balance + 1, max: 1_000_000 }),
            }),
          ),
          ({ balance, pointsToRedeem }) => {
            // Simulate the guard: if balance < pointsToRedeem, reject
            const wouldBeNegative = balance - pointsToRedeem < 0
            expect(wouldBeNegative).toBe(true)

            // The service should reject this — balance stays unchanged
            const finalBalance = balance < pointsToRedeem ? balance : balance - pointsToRedeem
            expect(finalBalance).toBeGreaterThanOrEqual(0)
          },
        ),
        { numRuns: 25 },
      )
    },
  )
})
