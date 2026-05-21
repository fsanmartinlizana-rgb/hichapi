// ══════════════════════════════════════════════════════════════════════════════
//  RatingService Property Tests
//  __tests__/api/customer/rating-service.property.test.ts
//
//  Property-based tests for RatingService pure calculation logic.
//
//  Feature: usuario-comensal
//  Property 5: Customer rating average correctness
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import { expect } from 'vitest'
import { arbCustomerRating } from '@/__tests__/setup/fast-check-arbitraries'

// ── Pure helper: computeAverage ───────────────────────────────────────────────
//
// Computes the average rating after adding a new rating `newRating` to an
// existing list of ratings `existingRatings`.
//
// Formula: avg = (sum(existingRatings) + newRating) / (existingRatings.length + 1)

function computeAverage(existingRatings: number[], newRating: number): number {
  const sum = existingRatings.reduce((acc, r) => acc + r, 0)
  return (sum + newRating) / (existingRatings.length + 1)
}

// ── Property 5: Customer rating average correctness ───────────────────────────
//
// For any rider or restaurant with N existing ratings (each between 1 and 5),
// after adding a new rating r, the computed average SHALL equal
// (sum_of_existing + r) / (N + 1) and SHALL be in [1.0, 5.0].
//
// **Validates: Requirements 4.6**

describe('RatingService — Property 5: Customer rating average correctness', () => {
  it(
    'computeAverage(existingRatings, newRating) === (sum + newRating) / (N + 1)',
    () => {
      fc.assert(
        fc.property(
          // N existing ratings, each between 1 and 5
          fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 0, maxLength: 50 }),
          // New rating r between 1 and 5
          fc.integer({ min: 1, max: 5 }),
          (existingRatings, newRating) => {
            const avg = computeAverage(existingRatings, newRating)
            const expectedSum = existingRatings.reduce((acc, r) => acc + r, 0) + newRating
            const expectedAvg = expectedSum / (existingRatings.length + 1)

            expect(avg).toBeCloseTo(expectedAvg, 10)
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'computeAverage result is always in [1.0, 5.0] when all ratings are in [1, 5]',
    () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 0, maxLength: 50 }),
          fc.integer({ min: 1, max: 5 }),
          (existingRatings, newRating) => {
            const avg = computeAverage(existingRatings, newRating)

            expect(avg).toBeGreaterThanOrEqual(1.0)
            expect(avg).toBeLessThanOrEqual(5.0)
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'computeAverage with arbCustomerRating stars: result is in [1.0, 5.0]',
    () => {
      fc.assert(
        fc.property(
          // Use arbCustomerRating to generate existing ratings
          fc.array(arbCustomerRating(), { minLength: 0, maxLength: 20 }),
          // New rating also from arbCustomerRating
          arbCustomerRating(),
          (existingRatings, newRating) => {
            const existingStars = existingRatings.map(r => r.stars)
            const avg = computeAverage(existingStars, newRating.stars)

            expect(avg).toBeGreaterThanOrEqual(1.0)
            expect(avg).toBeLessThanOrEqual(5.0)
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'computeAverage with a single new rating equals that rating',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (newRating) => {
            const avg = computeAverage([], newRating)
            expect(avg).toBe(newRating)
          },
        ),
        { numRuns: 25 },
      )
    },
  )

  it(
    'adding N identical ratings r produces average r',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 0, max: 49 }),
          (r, n) => {
            const existingRatings = Array(n).fill(r)
            const avg = computeAverage(existingRatings, r)
            expect(avg).toBeCloseTo(r, 10)
          },
        ),
        { numRuns: 25 },
      )
    },
  )
})
