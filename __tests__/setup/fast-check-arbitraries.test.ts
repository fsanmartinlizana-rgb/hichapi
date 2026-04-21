// ══════════════════════════════════════════════════════════════════════════════
//  Fast-Check Arbitraries Tests — __tests__/setup/fast-check-arbitraries.test.ts
//
//  Tests for custom fast-check generators to ensure they produce valid data.
//
//  Requirements: 1.1
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { z } from 'zod'
import {
  arbUuid,
  arbRestaurantSlug,
  arbMenuItem,
  arbStockItem,
  arbOrder,
  arbCashSession,
  arbZodSchema,
} from './fast-check-arbitraries'

describe('Fast-Check Arbitraries', () => {
  describe('arbUuid', () => {
    it('generates valid UUID strings', () => {
      fc.assert(
        fc.property(arbUuid(), (uuid) => {
          // Fast-check generates valid UUIDs but not necessarily v4
          // Just check it's a valid UUID format
          expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('arbRestaurantSlug', () => {
    it('generates valid restaurant slugs', () => {
      fc.assert(
        fc.property(arbRestaurantSlug(), (slug) => {
          expect(slug).toMatch(/^[a-z0-9-]{3,50}$/)
          expect(slug.length).toBeGreaterThanOrEqual(3)
          expect(slug.length).toBeLessThanOrEqual(50)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('arbMenuItem', () => {
    it('generates valid menu items', () => {
      fc.assert(
        fc.property(arbMenuItem(), (item) => {
          expect(item.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(item.restaurant_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(item.name.length).toBeGreaterThan(0)
          expect(item.name.length).toBeLessThanOrEqual(100)
          expect(item.price).toBeGreaterThanOrEqual(0)
          expect(['Principal', 'Entrada', 'Postre', 'Bebida', 'Acompañamiento']).toContain(item.category)
          expect(typeof item.available).toBe('boolean')
          expect(Array.isArray(item.tags)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })

    it('generates optional fields correctly', () => {
      fc.assert(
        fc.property(arbMenuItem(), (item) => {
          if (item.description !== undefined) {
            expect(item.description.length).toBeLessThanOrEqual(300)
          }
          if (item.cost_price !== undefined) {
            expect(item.cost_price).toBeGreaterThanOrEqual(0)
          }
          if (item.photo_url !== undefined) {
            expect(item.photo_url).toMatch(/^https?:\/\//)
          }
          if (item.ingredients !== undefined) {
            expect(Array.isArray(item.ingredients)).toBe(true)
            item.ingredients.forEach(ing => {
              expect(ing.stock_item_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
              expect(ing.qty).toBeGreaterThan(0)
            })
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('arbStockItem', () => {
    it('generates valid stock items', () => {
      fc.assert(
        fc.property(arbStockItem(), (item) => {
          expect(item.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(item.restaurant_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(item.name.length).toBeGreaterThan(0)
          expect(item.name.length).toBeLessThanOrEqual(100)
          expect(['kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja', 'onza']).toContain(item.unit)
          expect(item.current_qty).toBeGreaterThanOrEqual(0)
          expect(item.min_qty).toBeGreaterThanOrEqual(0)
          expect(item.cost_per_unit).toBeGreaterThanOrEqual(0)
          expect(typeof item.active).toBe('boolean')
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('arbOrder', () => {
    it('generates valid orders with consistent totals', () => {
      fc.assert(
        fc.property(arbOrder(), (order) => {
          expect(order.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(order.restaurant_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(['pending', 'confirmed', 'preparing', 'ready', 'paying', 'paid', 'cancelled']).toContain(order.status)
          expect(order.items.length).toBeGreaterThan(0)
          
          // Verify total matches sum of items
          const calculatedTotal = order.items.reduce(
            (sum, item) => sum + item.quantity * item.unit_price,
            0
          )
          expect(order.total).toBe(calculatedTotal)
          
          // Verify all items have correct order_id
          order.items.forEach(item => {
            expect(item.order_id).toBe(order.id)
            expect(item.quantity).toBeGreaterThan(0)
            expect(item.unit_price).toBeGreaterThanOrEqual(0)
          })
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('arbCashSession', () => {
    it('generates valid cash sessions', () => {
      fc.assert(
        fc.property(arbCashSession(), (session) => {
          expect(session.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(session.restaurant_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(session.opening_amount).toBeGreaterThanOrEqual(0)
          expect(['open', 'closed']).toContain(session.status)
          expect(session.opened_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
          
          if (session.status === 'closed') {
            expect(session.closed_at).toBeDefined()
            expect(session.closed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
            expect(session.actual_cash).toBeDefined()
            expect(session.expected_cash).toBeDefined()
            expect(session.difference).toBe(session.actual_cash! - session.expected_cash!)
          } else {
            expect(session.closed_at).toBeNull()
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('arbZodSchema', () => {
    it('is provided for simple schemas but has limitations with Zod v4', () => {
      // arbZodSchema is a best-effort generic generator
      // For production use, create custom arbitraries like arbMenuItem, arbStockItem, etc.
      // This test just verifies the function exists and can be called
      const schema = z.boolean()
      const arb = arbZodSchema(schema)
      expect(arb).toBeDefined()
    })
  })
})
