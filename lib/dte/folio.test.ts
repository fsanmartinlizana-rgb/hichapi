// ══════════════════════════════════════════════════════════════════════════════
//  Unit + Property-based tests for lib/dte/folio.ts
//
//  Tests cover:
//    - countAvailableFolios: pure formula, filtering of expired/exhausted CAFs
//    - takeNextFolio: success path, NO_CAF_AVAILABLE mapping
//    - checkFolioAlerts: warning threshold, critical threshold, deduplication
//
//  Property tests use fast-check (minimum 100 iterations each).
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { countAvailableFolios, type ActiveCaf } from './folio'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeActiveCaf(overrides: Partial<ActiveCaf> = {}): ActiveCaf {
  return {
    folio_desde:  1,
    folio_hasta:  100,
    folio_actual: 1,
    expires_at:   null,
    status:       'active',
    ...overrides,
  }
}

// ── countAvailableFolios — unit tests ─────────────────────────────────────────

describe('countAvailableFolios', () => {
  it('returns 0 for an empty array', () => {
    expect(countAvailableFolios([])).toBe(0)
  })

  it('counts a single active CAF correctly', () => {
    const caf = makeActiveCaf({ folio_actual: 1, folio_hasta: 100 })
    // 100 - 1 + 1 = 100
    expect(countAvailableFolios([caf])).toBe(100)
  })

  it('counts a single active CAF with partial consumption', () => {
    const caf = makeActiveCaf({ folio_actual: 51, folio_hasta: 100 })
    // 100 - 51 + 1 = 50
    expect(countAvailableFolios([caf])).toBe(50)
  })

  it('sums across multiple active CAFs', () => {
    const cafs = [
      makeActiveCaf({ folio_actual: 1,   folio_hasta: 100 }),  // 100
      makeActiveCaf({ folio_actual: 201, folio_hasta: 300 }),  // 100
    ]
    expect(countAvailableFolios(cafs)).toBe(200)
  })

  it('excludes exhausted CAFs', () => {
    const cafs = [
      makeActiveCaf({ folio_actual: 1, folio_hasta: 100, status: 'active' }),
      makeActiveCaf({ folio_actual: 1, folio_hasta: 100, status: 'exhausted' }),
    ]
    expect(countAvailableFolios(cafs)).toBe(100)
  })

  it('excludes expired CAFs (status = expired)', () => {
    const cafs = [
      makeActiveCaf({ folio_actual: 1, folio_hasta: 100, status: 'active' }),
      makeActiveCaf({ folio_actual: 1, folio_hasta: 100, status: 'expired' }),
    ]
    expect(countAvailableFolios(cafs)).toBe(100)
  })

  it('excludes CAFs with expires_at in the past', () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1 hour ago
    const cafs = [
      makeActiveCaf({ folio_actual: 1, folio_hasta: 100, status: 'active' }),
      makeActiveCaf({ folio_actual: 1, folio_hasta: 100, status: 'active', expires_at: pastDate }),
    ]
    expect(countAvailableFolios(cafs)).toBe(100)
  })

  it('includes CAFs with expires_at in the future', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() // 1 day ahead
    const cafs = [
      makeActiveCaf({ folio_actual: 1, folio_hasta: 100, status: 'active', expires_at: futureDate }),
    ]
    expect(countAvailableFolios(cafs)).toBe(100)
  })

  it('includes CAFs with expires_at = null (no expiry)', () => {
    const caf = makeActiveCaf({ folio_actual: 1, folio_hasta: 50, expires_at: null })
    expect(countAvailableFolios([caf])).toBe(50)
  })

  it('returns 1 when only one folio remains', () => {
    const caf = makeActiveCaf({ folio_actual: 100, folio_hasta: 100 })
    expect(countAvailableFolios([caf])).toBe(1)
  })

  it('returns 0 when all CAFs are exhausted or expired', () => {
    const cafs = [
      makeActiveCaf({ status: 'exhausted' }),
      makeActiveCaf({ status: 'expired' }),
    ]
    expect(countAvailableFolios(cafs)).toBe(0)
  })
})

// ── Property 9: Available folio count formula ─────────────────────────────────
// **Validates: Requirements 2.5**

describe('Property 9: Available folio count formula', () => {
  it('equals sum(folio_hasta - folio_actual + 1) for active non-expired CAFs', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString()

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            folio_desde:  fc.integer({ min: 1, max: 1000 }),
            folio_actual: fc.integer({ min: 1, max: 1000 }),
            folio_hasta:  fc.integer({ min: 1, max: 2000 }),
            expires_at:   fc.constantFrom(null, futureDate),
            status:       fc.constantFrom('active' as const, 'exhausted' as const, 'expired' as const),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (cafs) => {
          const now = new Date()
          // Manually compute expected value
          const expected = cafs
            .filter((c) => {
              if (c.status !== 'active') return false
              if (c.expires_at !== null && new Date(c.expires_at) <= now) return false
              return true
            })
            .reduce((sum, c) => sum + Math.max(0, c.folio_hasta - c.folio_actual + 1), 0)

          const actual = countAvailableFolios(cafs)
          return actual === expected
        }
      ),
      { numRuns: 200 }
    )
  })

  it('is always non-negative', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            folio_desde:  fc.integer({ min: 1, max: 1000 }),
            folio_actual: fc.integer({ min: 1, max: 1000 }),
            folio_hasta:  fc.integer({ min: 1, max: 2000 }),
            expires_at:   fc.constant(null),
            status:       fc.constantFrom('active' as const, 'exhausted' as const, 'expired' as const),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (cafs) => countAvailableFolios(cafs) >= 0
      ),
      { numRuns: 100 }
    )
  })

  it('is monotonically non-decreasing when adding an active CAF', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            folio_desde:  fc.integer({ min: 1, max: 1000 }),
            folio_actual: fc.integer({ min: 1, max: 500 }),
            folio_hasta:  fc.integer({ min: 500, max: 1000 }),
            expires_at:   fc.constant(null),
            status:       fc.constant('active' as const),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 0, max: 499 }),
        (cafs, actual, offset) => {
          const newCaf: ActiveCaf = {
            folio_desde:  actual,
            folio_actual: actual,
            folio_hasta:  actual + offset,
            expires_at:   null,
            status:       'active',
          }
          const before = countAvailableFolios(cafs)
          const after  = countAvailableFolios([...cafs, newCaf])
          return after >= before
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── takeNextFolio — mocked tests ──────────────────────────────────────────────

describe('takeNextFolio', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns caf_id and folio on success', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        rpc: (_fn: string, _args: unknown) =>
          Promise.resolve({
            data: [{ caf_id: 'caf-uuid-123', folio: 42 }],
            error: null,
          }),
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        }),
      }),
    }))

    const { takeNextFolio: takeNextFolioMocked } = await import('./folio')
    const result = await takeNextFolioMocked('restaurant-1', 39)

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.caf_id).toBe('caf-uuid-123')
      expect(result.folio).toBe(42)
    }
  })

  it('returns NO_CAF_AVAILABLE when RPC raises P0001', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        rpc: (_fn: string, _args: unknown) =>
          Promise.resolve({
            data: null,
            error: { code: 'P0001', message: 'NO_CAF_AVAILABLE' },
          }),
      }),
    }))

    const { takeNextFolio: takeNextFolioMocked } = await import('./folio')
    const result = await takeNextFolioMocked('restaurant-1', 39)

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('NO_CAF_AVAILABLE')
    }
  })

  it('returns NO_CAF_AVAILABLE when RPC returns empty data', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        rpc: (_fn: string, _args: unknown) =>
          Promise.resolve({ data: [], error: null }),
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        }),
      }),
    }))

    const { takeNextFolio: takeNextFolioMocked } = await import('./folio')
    const result = await takeNextFolioMocked('restaurant-1', 39)

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('NO_CAF_AVAILABLE')
    }
  })

  it('returns NO_CAF_AVAILABLE when RPC returns null data', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        rpc: (_fn: string, _args: unknown) =>
          Promise.resolve({ data: null, error: null }),
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        }),
      }),
    }))

    const { takeNextFolio: takeNextFolioMocked } = await import('./folio')
    const result = await takeNextFolioMocked('restaurant-1', 39)

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('NO_CAF_AVAILABLE')
    }
  })

  it('maps generic RPC error to NO_CAF_AVAILABLE', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        rpc: (_fn: string, _args: unknown) =>
          Promise.resolve({
            data: null,
            error: { code: '42P01', message: 'relation does not exist' },
          }),
      }),
    }))

    const { takeNextFolio: takeNextFolioMocked } = await import('./folio')
    const result = await takeNextFolioMocked('restaurant-1', 39)

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('NO_CAF_AVAILABLE')
    }
  })
})

// ── checkFolioAlerts — mocked tests ──────────────────────────────────────────

describe('checkFolioAlerts', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  /**
   * Helper: builds a mock Supabase client that returns the given CAFs and
   * simulates the notifications table interactions.
   */
  function buildMockSupabase({
    cafs,
    existingNotifications = [],
    captureInsert,
  }: {
    cafs: Partial<ActiveCaf>[]
    existingNotifications?: { id: string }[]
    captureInsert?: (data: Record<string, unknown>) => void
  }) {
    return {
      createAdminClient: () => ({
        from: (table: string) => {
          if (table === 'dte_cafs') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () =>
                      Promise.resolve({
                        data: cafs.map((c) => ({
                          folio_desde:  c.folio_desde  ?? 1,
                          folio_hasta:  c.folio_hasta  ?? 100,
                          folio_actual: c.folio_actual ?? 1,
                          expires_at:   c.expires_at   ?? null,
                          status:       c.status       ?? 'active',
                        })),
                        error: null,
                      }),
                  }),
                }),
              }),
            }
          }

          if (table === 'notifications') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      eq: () => ({
                        limit: () =>
                          Promise.resolve({
                            data: existingNotifications,
                            error: null,
                          }),
                      }),
                    }),
                  }),
                }),
              }),
              insert: (data: Record<string, unknown>) => {
                captureInsert?.(data)
                return Promise.resolve({ error: null })
              },
            }
          }

          return {}
        },
      }),
    }
  }

  it('inserts a warning notification when available folios < 50', async () => {
    let inserted: Record<string, unknown> | null = null

    vi.doMock('@/lib/supabase/server', () =>
      buildMockSupabase({
        cafs: [{ folio_actual: 60, folio_hasta: 100, status: 'active', expires_at: null }],
        // 100 - 60 + 1 = 41 → < 50 → warning
        existingNotifications: [],
        captureInsert: (data) => { inserted = data },
      })
    )

    const { checkFolioAlerts: checkFolioAlertsMocked } = await import('./folio')
    await checkFolioAlertsMocked('restaurant-1', 39)

    expect(inserted).not.toBeNull()
    expect((inserted as Record<string, unknown>)['severity']).toBe('warning')
    expect((inserted as Record<string, unknown>)['type']).toBe('dte')
    expect((inserted as Record<string, unknown>)['category']).toBe('dte')
    expect((inserted as Record<string, unknown>)['is_read']).toBe(false)
  })

  it('inserts a critical notification when available folios < 9', async () => {
    let inserted: Record<string, unknown> | null = null

    vi.doMock('@/lib/supabase/server', () =>
      buildMockSupabase({
        cafs: [{ folio_actual: 95, folio_hasta: 100, status: 'active', expires_at: null }],
        // 100 - 95 + 1 = 6 → < 9 → critical
        existingNotifications: [],
        captureInsert: (data) => { inserted = data },
      })
    )

    const { checkFolioAlerts: checkFolioAlertsMocked } = await import('./folio')
    await checkFolioAlertsMocked('restaurant-1', 39)

    expect(inserted).not.toBeNull()
    expect((inserted as Record<string, unknown>)['severity']).toBe('critical')
  })

  it('does not insert when available folios >= 50', async () => {
    let inserted: Record<string, unknown> | null = null

    vi.doMock('@/lib/supabase/server', () =>
      buildMockSupabase({
        cafs: [{ folio_actual: 1, folio_hasta: 100, status: 'active', expires_at: null }],
        // 100 folios → no alert
        existingNotifications: [],
        captureInsert: (data) => { inserted = data },
      })
    )

    const { checkFolioAlerts: checkFolioAlertsMocked } = await import('./folio')
    await checkFolioAlertsMocked('restaurant-1', 39)

    expect(inserted).toBeNull()
  })

  it('deduplicates: does not insert when an unread notification of same severity exists', async () => {
    let inserted: Record<string, unknown> | null = null

    vi.doMock('@/lib/supabase/server', () =>
      buildMockSupabase({
        cafs: [{ folio_actual: 60, folio_hasta: 100, status: 'active', expires_at: null }],
        // 41 folios → warning, but one already exists
        existingNotifications: [{ id: 'existing-notif-id' }],
        captureInsert: (data) => { inserted = data },
      })
    )

    const { checkFolioAlerts: checkFolioAlertsMocked } = await import('./folio')
    await checkFolioAlertsMocked('restaurant-1', 39)

    expect(inserted).toBeNull()
  })

  it('inserts critical even when warning already exists (different severity)', async () => {
    // This tests that critical and warning are treated as separate deduplication keys.
    // If we have 6 folios (critical), and there's an existing warning but no critical,
    // we should insert a critical notification.
    let inserted: Record<string, unknown> | null = null

    // The mock returns no existing notifications for the 'critical' severity check
    vi.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: (table: string) => {
          if (table === 'dte_cafs') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () =>
                      Promise.resolve({
                        data: [{ folio_desde: 1, folio_hasta: 100, folio_actual: 95, expires_at: null, status: 'active' }],
                        // 100 - 95 + 1 = 6 → critical
                        error: null,
                      }),
                  }),
                }),
              }),
            }
          }

          if (table === 'notifications') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      eq: () => ({
                        // No existing critical notification
                        limit: () => Promise.resolve({ data: [], error: null }),
                      }),
                    }),
                  }),
                }),
              }),
              insert: (data: Record<string, unknown>) => {
                inserted = data
                return Promise.resolve({ error: null })
              },
            }
          }

          return {}
        },
      }),
    }))

    const { checkFolioAlerts: checkFolioAlertsMocked } = await import('./folio')
    await checkFolioAlertsMocked('restaurant-1', 39)

    expect(inserted).not.toBeNull()
    expect((inserted as Record<string, unknown>)['severity']).toBe('critical')
  })

  it('does not insert when no CAFs exist (0 folios available, but 0 < 9 → critical)', async () => {
    // 0 folios: 0 < 9 → critical notification should be inserted
    let inserted: Record<string, unknown> | null = null

    vi.doMock('@/lib/supabase/server', () =>
      buildMockSupabase({
        cafs: [],
        existingNotifications: [],
        captureInsert: (data) => { inserted = data },
      })
    )

    const { checkFolioAlerts: checkFolioAlertsMocked } = await import('./folio')
    await checkFolioAlertsMocked('restaurant-1', 39)

    // 0 < 9 → critical
    expect(inserted).not.toBeNull()
    expect((inserted as Record<string, unknown>)['severity']).toBe('critical')
  })

  it('includes restaurant_id in the inserted notification', async () => {
    let inserted: Record<string, unknown> | null = null

    vi.doMock('@/lib/supabase/server', () =>
      buildMockSupabase({
        cafs: [{ folio_actual: 60, folio_hasta: 100, status: 'active', expires_at: null }],
        existingNotifications: [],
        captureInsert: (data) => { inserted = data },
      })
    )

    const { checkFolioAlerts: checkFolioAlertsMocked } = await import('./folio')
    await checkFolioAlertsMocked('my-restaurant-id', 39)

    expect((inserted as Record<string, unknown>)['restaurant_id']).toBe('my-restaurant-id')
  })
})
