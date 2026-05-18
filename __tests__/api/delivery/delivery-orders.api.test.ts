/**
 * __tests__/api/delivery/delivery-orders.api.test.ts
 *
 * Property 11: API payload validation — any invalid payload returns HTTP 400.
 * Requirements: 8.7
 */
import * as fc from 'fast-check'
import {
  CreateDeliveryOrderSchema,
  UpdateDeliveryOrderSchema,
  CreateRiderRatingSchema,
  UpdateRiderStatusSchema,
  AnalyticsQuerySchema,
} from '../../../lib/delivery/types'

// ── Property 11: API payload validation ──────────────────────────────────────

describe('Property 11 — API payload validation (Zod schemas)', () => {
  // CreateDeliveryOrderSchema
  describe('CreateDeliveryOrderSchema', () => {
    it('accepts valid payloads', () => {
      const valid = {
        pickup_address:   'Av. Providencia 1234, Santiago',
        delivery_address: 'Av. Las Condes 5678, Santiago',
        client_name:      'Juan Pérez',
        client_phone:     '+56912345678',
        total_clp:        15000,
      }
      expect(() => CreateDeliveryOrderSchema.parse(valid)).not.toThrow()
    })

    it('rejects missing required fields', () => {
      expect(CreateDeliveryOrderSchema.safeParse({}).success).toBe(false)
      expect(CreateDeliveryOrderSchema.safeParse({ pickup_address: 'x' }).success).toBe(false)
    })

    it('rejects pickup_address shorter than 5 chars', () => {
      const result = CreateDeliveryOrderSchema.safeParse({
        pickup_address:   'abc',
        delivery_address: 'Av. Las Condes 5678, Santiago',
        client_name:      'Juan',
        client_phone:     '+56912345678',
        total_clp:        1000,
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative total_clp', () => {
      const result = CreateDeliveryOrderSchema.safeParse({
        pickup_address:   'Av. Providencia 1234',
        delivery_address: 'Av. Las Condes 5678',
        client_name:      'Juan',
        client_phone:     '+56912345678',
        total_clp:        -100,
      })
      expect(result.success).toBe(false)
    })
  })

  // UpdateDeliveryOrderSchema
  describe('UpdateDeliveryOrderSchema', () => {
    it('rejects failed status without failure_reason', () => {
      const result = UpdateDeliveryOrderSchema.safeParse({ status: 'failed' })
      expect(result.success).toBe(false)
    })

    it('accepts failed status with failure_reason', () => {
      const result = UpdateDeliveryOrderSchema.safeParse({
        status:         'failed',
        failure_reason: 'customer_not_found',
      })
      expect(result.success).toBe(true)
    })

    it('accepts delivered status without failure_reason', () => {
      const result = UpdateDeliveryOrderSchema.safeParse({ status: 'delivered' })
      expect(result.success).toBe(true)
    })

    it('rejects invalid status values', () => {
      const result = UpdateDeliveryOrderSchema.safeParse({ status: 'invalid_status' })
      expect(result.success).toBe(false)
    })
  })

  // CreateRiderRatingSchema
  describe('CreateRiderRatingSchema', () => {
    it('rejects stars = 0', () => {
      const result = CreateRiderRatingSchema.safeParse({
        delivery_order_id: '550e8400-e29b-41d4-a716-446655440000',
        stars: 0,
      })
      expect(result.success).toBe(false)
    })

    it('rejects stars = 6', () => {
      const result = CreateRiderRatingSchema.safeParse({
        delivery_order_id: '550e8400-e29b-41d4-a716-446655440000',
        stars: 6,
      })
      expect(result.success).toBe(false)
    })

    it('accepts stars 1-5', () => {
      for (const stars of [1, 2, 3, 4, 5]) {
        const result = CreateRiderRatingSchema.safeParse({
          delivery_order_id: '550e8400-e29b-41d4-a716-446655440000',
          stars,
        })
        expect(result.success).toBe(true)
      }
    })

    it('rejects invalid UUID for delivery_order_id', () => {
      const result = CreateRiderRatingSchema.safeParse({
        delivery_order_id: 'not-a-uuid',
        stars: 4,
      })
      expect(result.success).toBe(false)
    })
  })

  // UpdateRiderStatusSchema
  describe('UpdateRiderStatusSchema', () => {
    it('accepts available and offline', () => {
      expect(UpdateRiderStatusSchema.safeParse({ status: 'available' }).success).toBe(true)
      expect(UpdateRiderStatusSchema.safeParse({ status: 'offline' }).success).toBe(true)
    })

    it('rejects busy and suspended (not toggleable)', () => {
      expect(UpdateRiderStatusSchema.safeParse({ status: 'busy' }).success).toBe(false)
      expect(UpdateRiderStatusSchema.safeParse({ status: 'suspended' }).success).toBe(false)
    })
  })

  // AnalyticsQuerySchema
  describe('AnalyticsQuerySchema', () => {
    it('rejects date range > 90 days', () => {
      const from = '2025-01-01'
      const to   = '2025-04-15' // 104 days
      const result = AnalyticsQuerySchema.safeParse({ from, to })
      expect(result.success).toBe(false)
    })

    it('accepts date range of exactly 30 days', () => {
      const from = '2025-01-01'
      const to   = '2025-01-31'
      const result = AnalyticsQuerySchema.safeParse({ from, to })
      expect(result.success).toBe(true)
    })

    it('rejects date range of 0 days (same date)', () => {
      const result = AnalyticsQuerySchema.safeParse({ from: '2025-01-01', to: '2025-01-01' })
      expect(result.success).toBe(false)
    })
  })

  // Property-based: any object missing required fields fails
  it('any payload missing required fields fails CreateDeliveryOrderSchema', () => {
    fc.assert(
      fc.property(
        fc.record({
          pickup_address:   fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: undefined }),
          delivery_address: fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: undefined }),
          client_name:      fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          client_phone:     fc.option(fc.string({ minLength: 8, maxLength: 20 }), { nil: undefined }),
          total_clp:        fc.option(fc.integer({ min: 0, max: 1000000 }), { nil: undefined }),
        }),
        payload => {
          const hasAll = payload.pickup_address !== undefined &&
                         payload.delivery_address !== undefined &&
                         payload.client_name !== undefined &&
                         payload.client_phone !== undefined &&
                         payload.total_clp !== undefined
          const result = CreateDeliveryOrderSchema.safeParse(payload)
          if (!hasAll) {
            expect(result.success).toBe(false)
          }
          // If all fields present, it may or may not pass depending on length constraints
        },
      ),
      { numRuns: 100 },
    )
  })
})
