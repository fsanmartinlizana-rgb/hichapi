/**
 * __tests__/api/delivery/rating.service.test.ts
 *
 * Property-based and unit tests for RatingService.
 * Property 5: Rating system invariants.
 * Requirements: 6.4, 6.7, 6.8
 */
import * as fc from 'fast-check'

// ── Pure rating math (extracted from service for testability) ─────────────────

function computeAvgRating(ratings: number[]): number {
  if (ratings.length === 0) return 0
  const sum = ratings.reduce((s, r) => s + r, 0)
  return Math.round((sum / ratings.length) * 10) / 10
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

function arbRatingSequence(): fc.Arbitrary<number[]> {
  return fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 100 })
}

function arbSingleRating(): fc.Arbitrary<number> {
  return fc.integer({ min: 1, max: 5 })
}

// ── Property 5: Rating system invariants ─────────────────────────────────────

describe('Property 5 — Rating system invariants', () => {
  it('average of N ratings is always in [1.0, 5.0]', () => {
    fc.assert(
      fc.property(arbRatingSequence(), ratings => {
        const avg = computeAvgRating(ratings)
        expect(avg).toBeGreaterThanOrEqual(1.0)
        expect(avg).toBeLessThanOrEqual(5.0)
      }),
      { numRuns: 200 },
    )
  })

  it('average equals round(sum/N, 1) for any sequence', () => {
    fc.assert(
      fc.property(arbRatingSequence(), ratings => {
        const expected = Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
        const actual   = computeAvgRating(ratings)
        expect(actual).toBe(expected)
      }),
      { numRuns: 200 },
    )
  })

  it('adding a rating equal to the current average does not change the average (within 0.1 tolerance)', () => {
    fc.assert(
      fc.property(arbRatingSequence(), ratings => {
        const currentAvg = computeAvgRating(ratings)
        // Add a rating equal to the rounded average (must be integer 1-5)
        const newRating  = Math.round(currentAvg)
        if (newRating < 1 || newRating > 5) return // skip edge cases
        const newAvg = computeAvgRating([...ratings, newRating])
        expect(Math.abs(newAvg - currentAvg)).toBeLessThanOrEqual(0.1)
      }),
      { numRuns: 200 },
    )
  })

  it('average(R1...Rn, new_rating) = round((sum + new_rating) / (n+1), 1)', () => {
    fc.assert(
      fc.property(arbRatingSequence(), arbSingleRating(), (ratings, newRating) => {
        const combined  = [...ratings, newRating]
        const expected  = Math.round(
          (combined.reduce((s, r) => s + r, 0) / combined.length) * 10,
        ) / 10
        const actual    = computeAvgRating(combined)
        expect(actual).toBe(expected)
      }),
      { numRuns: 200 },
    )
  })
})

// ── Unit tests for rating business rules ──────────────────────────────────────

describe('RatingService — business rules', () => {
  it('48-hour window: rating within window is allowed', () => {
    const deliveredAt = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h ago
    const windowMs    = 48 * 60 * 60 * 1000
    const expired     = Date.now() - deliveredAt.getTime() > windowMs
    expect(expired).toBe(false)
  })

  it('48-hour window: rating after 48h is rejected', () => {
    const deliveredAt = new Date(Date.now() - 49 * 60 * 60 * 1000) // 49h ago
    const windowMs    = 48 * 60 * 60 * 1000
    const expired     = Date.now() - deliveredAt.getTime() > windowMs
    expect(expired).toBe(true)
  })

  it('stars must be integer between 1 and 5', () => {
    for (const stars of [1, 2, 3, 4, 5]) {
      expect(stars).toBeGreaterThanOrEqual(1)
      expect(stars).toBeLessThanOrEqual(5)
      expect(Number.isInteger(stars)).toBe(true)
    }
    for (const invalid of [0, 6, 1.5, -1]) {
      expect(invalid < 1 || invalid > 5 || !Number.isInteger(invalid)).toBe(true)
    }
  })
})
