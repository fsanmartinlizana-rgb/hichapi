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
  arbCustomerProfile,
  arbSavedAddress,
  arbCustomerRating,
  arbLoyaltyTransaction,
  arbOrderTotal,
  arbPointsMultiplier,
  arbGpsCoordinate,
  arbGeofenceConfig,
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

  // ── Customer Module Arbitraries ─────────────────────────────────────────────
  // Requirements: 9.7

  describe('arbCustomerProfile', () => {
    it('generates valid CustomerProfile objects', () => {
      fc.assert(
        fc.property(arbCustomerProfile(), (profile) => {
          expect(profile.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(profile.user_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(profile.display_name.length).toBeGreaterThanOrEqual(1)
          expect(profile.display_name.length).toBeLessThanOrEqual(100)
          expect(profile.loyalty_points).toBeGreaterThanOrEqual(0)
          expect(profile.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
          expect(profile.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
          if (profile.phone !== null) {
            expect(profile.phone.length).toBeGreaterThanOrEqual(8)
            expect(profile.phone.length).toBeLessThanOrEqual(20)
          }
          if (profile.push_token !== null) {
            expect(profile.push_token.length).toBeGreaterThanOrEqual(1)
            expect(profile.push_token.length).toBeLessThanOrEqual(500)
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('arbSavedAddress', () => {
    it('generates valid SavedAddress objects', () => {
      fc.assert(
        fc.property(arbSavedAddress(), (addr) => {
          expect(addr.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(addr.customer_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(addr.label.length).toBeGreaterThanOrEqual(1)
          expect(addr.label.length).toBeLessThanOrEqual(50)
          expect(addr.street.length).toBeGreaterThanOrEqual(5)
          expect(addr.street.length).toBeLessThanOrEqual(300)
          expect(addr.city.length).toBeGreaterThanOrEqual(1)
          expect(addr.city.length).toBeLessThanOrEqual(100)
          expect(typeof addr.is_default).toBe('boolean')
          if (addr.notes !== null) {
            expect(addr.notes.length).toBeLessThanOrEqual(300)
          }
          expect(addr.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
          expect(addr.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('arbCustomerRating', () => {
    it('generates valid CustomerRating objects', () => {
      fc.assert(
        fc.property(arbCustomerRating(), (rating) => {
          expect(rating.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(rating.customer_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(['rider', 'restaurant']).toContain(rating.entity_type)
          expect(['delivery', 'presencial']).toContain(rating.order_type)
          expect(rating.stars).toBeGreaterThanOrEqual(1)
          expect(rating.stars).toBeLessThanOrEqual(5)
          expect(Number.isInteger(rating.stars)).toBe(true)
          if (rating.comment !== null) {
            expect(rating.comment.length).toBeLessThanOrEqual(500)
          }
          expect(rating.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('arbLoyaltyTransaction', () => {
    it('generates valid LoyaltyTransaction objects', () => {
      fc.assert(
        fc.property(arbLoyaltyTransaction(), (tx) => {
          expect(tx.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(tx.customer_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          expect(tx.balance_after).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(tx.balance_after)).toBe(true)
          expect(Number.isInteger(tx.points_delta)).toBe(true)
          expect(tx.description.length).toBeGreaterThanOrEqual(1)
          if (tx.order_id !== null) {
            expect(tx.order_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
          }
          if (tx.order_type !== null) {
            expect(['delivery', 'presencial']).toContain(tx.order_type)
          }
          expect(tx.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('arbOrderTotal', () => {
    it('generates non-negative integer order totals in CLP', () => {
      fc.assert(
        fc.property(arbOrderTotal(), (total) => {
          expect(total).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(total)).toBe(true)
          expect(total).toBeLessThanOrEqual(10_000_000)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('arbPointsMultiplier', () => {
    it('generates multipliers in [0.5, 5.0]', () => {
      fc.assert(
        fc.property(arbPointsMultiplier(), (m) => {
          expect(m).toBeGreaterThanOrEqual(0.5)
          expect(m).toBeLessThanOrEqual(5.0)
          // Should be a multiple of 0.5
          expect((m * 10) % 5).toBe(0)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('arbGpsCoordinate', () => {
    it('generates GPS coordinates with valid lat/lng ranges', () => {
      fc.assert(
        fc.property(arbGpsCoordinate(), ({ lat, lng }) => {
          expect(lat).toBeGreaterThanOrEqual(-90)
          expect(lat).toBeLessThanOrEqual(90)
          expect(lng).toBeGreaterThanOrEqual(-180)
          expect(lng).toBeLessThanOrEqual(180)
          expect(typeof lat).toBe('number')
          expect(typeof lng).toBe('number')
          expect(isNaN(lat)).toBe(false)
          expect(isNaN(lng)).toBe(false)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('arbGeofenceConfig', () => {
    it('generates valid geofence configurations', () => {
      fc.assert(
        fc.property(arbGeofenceConfig(), (cfg) => {
          expect(cfg.radius_m).toBeGreaterThanOrEqual(100)
          expect(cfg.radius_m).toBeLessThanOrEqual(2000)
          expect(Number.isInteger(cfg.radius_m)).toBe(true)
          expect(cfg.center_lat).toBeGreaterThanOrEqual(-90)
          expect(cfg.center_lat).toBeLessThanOrEqual(90)
          expect(cfg.center_lng).toBeGreaterThanOrEqual(-180)
          expect(cfg.center_lng).toBeLessThanOrEqual(180)
          expect(isNaN(cfg.center_lat)).toBe(false)
          expect(isNaN(cfg.center_lng)).toBe(false)
        }),
        { numRuns: 100 }
      )
    })
  })
})
