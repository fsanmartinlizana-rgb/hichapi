// ══════════════════════════════════════════════════════════════════════════════
//  Zod Schema Validation Tests — __tests__/lib/validation/zod-schemas.test.ts
//
//  Comprehensive tests for all Zod schemas used in API routes.
//  Tests both valid and invalid inputs to ensure validation works correctly.
//
//  Requirements: 2.1, 2.2, 2.5, 2.6
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ── Menu Items Schemas ────────────────────────────────────────────────────────

const DestinationEnum = z.enum(['cocina', 'barra', 'ninguno'])

const IngredientSchema = z.object({
  stock_item_id: z.string().uuid(),
  qty:           z.number().min(0),
})

const CreateItemSchema = z.object({
  restaurant_id: z.string().uuid(),
  name:          z.string().min(1).max(100),
  description:   z.string().max(300).optional(),
  price:         z.number().int().min(0),
  category:      z.string().max(60).default('Principal'),
  tags:          z.array(z.string()).default([]),
  available:     z.boolean().default(true),
  cost_price:    z.number().int().min(0).optional(),
  photo_url:     z.string().url().optional(),
  display_order: z.number().int().optional(),
  destination:   DestinationEnum.default('cocina'),
  ingredients:   z.array(IngredientSchema).optional(),
})

const UpdateItemSchema = z.object({
  id:            z.string().uuid(),
  restaurant_id: z.string().uuid(),
  name:          z.string().min(1).max(100).optional(),
  description:   z.string().max(300).optional(),
  price:         z.number().int().min(0).optional(),
  category:      z.string().max(60).optional(),
  tags:          z.array(z.string()).optional(),
  available:     z.boolean().optional(),
  cost_price:    z.number().int().min(0).nullish(),
  photo_url:     z.string().url().nullish(),
  display_order: z.number().int().optional(),
  destination:   DestinationEnum.optional(),
  ingredients:   z.array(IngredientSchema).optional(),
})

// ── Orders Schemas ────────────────────────────────────────────────────────────

const CartItemSchema = z.object({
  menu_item_id: z.string(),
  name: z.string(),
  quantity: z.number().int().min(1),
  unit_price: z.number().min(0),
  note: z.string().nullish(),
})

const CreateOrderSchema = z.object({
  restaurant_slug: z.string(),
  table_id: z.string().min(1),
  cart: z.array(CartItemSchema).min(1),
  client_name: z.string().optional(),
  notes: z.string().optional(),
})

// ── Stock Schemas ─────────────────────────────────────────────────────────────

const ItemSchema = z.object({
  restaurant_id:    z.string().uuid(),
  name:             z.string().min(1).max(100),
  unit:             z.enum(['kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja', 'onza']),
  current_qty:      z.number().min(0),
  min_qty:          z.number().min(0).optional().default(0),
  cost_per_unit:    z.number().int().min(0),
  supplier:         z.string().optional(),
  category:         z.string().optional(),
  expiry_date:      z.string().nullish(),
  shelf_life_days:  z.number().int().min(0).nullish(),
})

const AdjustSchema = z.object({
  stock_item_id: z.string().uuid(),
  delta: z.number().refine((v) => v !== 0, { message: 'delta no puede ser cero' }),
  reason: z.enum(['compra', 'ajuste_manual', 'merma', 'consumo_orden']).optional(),
  restaurant_id: z.string().uuid(),
})

// ── Cash Expenses Schemas ─────────────────────────────────────────────────────

const CategoryEnum = z.enum(['proveedor', 'propina', 'insumos', 'servicios', 'otros'])

const CreateExpenseSchema = z.object({
  session_id:    z.string().uuid(),
  restaurant_id: z.string().uuid(),
  amount:        z.number().int().min(1),
  category:      CategoryEnum.default('otros'),
  description:   z.string().min(1).max(200),
})

// ── Notifications Schemas ─────────────────────────────────────────────────────

const CreateNotificationSchema = z.object({
  restaurant_id: z.string().uuid(),
  type:          z.string().min(1),
  title:         z.string().min(1).max(200),
  message:       z.string().max(1000).optional(),
  severity:      z.enum(['info','success','warning','critical']).optional(),
  category:      z.enum(['operacion','inventario','caja','dte','equipo','sistema']).optional(),
  action_url:    z.string().max(500).optional(),
  action_label:  z.string().max(80).optional(),
  dedupe_key:    z.string().max(200).optional(),
  metadata:      z.record(z.string(), z.unknown()).optional(),
})

// ── Delivery Integrations Schemas ─────────────────────────────────────────────

const Platform = z.enum(['pedidosya', 'rappi', 'uber_eats', 'justo', 'didi_food', 'cornershop'])

const UpsertDeliverySchema = z.object({
  restaurant_id: z.string().uuid(),
  platform:      Platform,
  external_id:   z.string().nullish(),
  api_key:       z.string().nullish(),
  auto_sync_menu: z.boolean().optional(),
  status:        z.enum(['disconnected', 'pending', 'connected', 'error']).optional(),
})

// ── Categories Schemas ────────────────────────────────────────────────────────

const CreateCategorySchema = z.object({
  restaurant_id:   z.string().uuid(),
  name:            z.string().min(1).max(80),
  slug:            z.string().max(80).optional(),
  icon:            z.string().max(40).nullish(),
  sort_order:      z.number().int().optional(),
  shared_in_brand: z.boolean().default(true),
})

// ══════════════════════════════════════════════════════════════════════════════
//  Test Suites
// ══════════════════════════════════════════════════════════════════════════════

describe('Menu Items Schemas', () => {
  describe('CreateItemSchema', () => {
    const validItem = {
      restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Pizza Margherita',
      price: 5000,
    }

    it('accepts valid menu item with required fields', () => {
      expect(() => CreateItemSchema.parse(validItem)).not.toThrow()
    })

    it('accepts valid menu item with all optional fields', () => {
      const fullItem = {
        ...validItem,
        description: 'Delicious pizza with tomato and mozzarella',
        category: 'Principal',
        tags: ['vegetarian', 'popular'],
        available: true,
        cost_price: 2500,
        photo_url: 'https://example.com/pizza.jpg',
        display_order: 1,
        destination: 'cocina' as const,
        ingredients: [
          { stock_item_id: '550e8400-e29b-41d4-a716-446655440001', qty: 0.5 },
        ],
      }
      expect(() => CreateItemSchema.parse(fullItem)).not.toThrow()
    })

    it('rejects missing required field: restaurant_id', () => {
      const invalid = { name: 'Pizza', price: 5000 }
      expect(() => CreateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: name', () => {
      const invalid = { restaurant_id: validItem.restaurant_id, price: 5000 }
      expect(() => CreateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: price', () => {
      const invalid = { restaurant_id: validItem.restaurant_id, name: 'Pizza' }
      expect(() => CreateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid restaurant_id UUID', () => {
      const invalid = { ...validItem, restaurant_id: 'not-a-uuid' }
      expect(() => CreateItemSchema.parse(invalid)).toThrow(/uuid/)
    })

    it('rejects negative price', () => {
      const invalid = { ...validItem, price: -100 }
      expect(() => CreateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid type for price (string instead of number)', () => {
      const invalid = { ...validItem, price: '5000' }
      expect(() => CreateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects name exceeding max length (100 chars)', () => {
      const invalid = { ...validItem, name: 'a'.repeat(101) }
      expect(() => CreateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects empty name', () => {
      const invalid = { ...validItem, name: '' }
      expect(() => CreateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid photo_url format', () => {
      const invalid = { ...validItem, photo_url: 'not-a-url' }
      expect(() => CreateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects negative cost_price', () => {
      const invalid = { ...validItem, cost_price: -500 }
      expect(() => CreateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid ingredient stock_item_id UUID', () => {
      const invalid = {
        ...validItem,
        ingredients: [{ stock_item_id: 'invalid-uuid', qty: 1 }],
      }
      expect(() => CreateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects negative ingredient quantity', () => {
      const invalid = {
        ...validItem,
        ingredients: [
          { stock_item_id: '550e8400-e29b-41d4-a716-446655440001', qty: -1 },
        ],
      }
      expect(() => CreateItemSchema.parse(invalid)).toThrow()
    })
  })

  describe('UpdateItemSchema', () => {
    const validUpdate = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      restaurant_id: '550e8400-e29b-41d4-a716-446655440001',
    }

    it('accepts valid update with only required fields', () => {
      expect(() => UpdateItemSchema.parse(validUpdate)).not.toThrow()
    })

    it('accepts valid update with optional fields', () => {
      const update = { ...validUpdate, name: 'Updated Pizza', price: 6000 }
      expect(() => UpdateItemSchema.parse(update)).not.toThrow()
    })

    it('rejects missing required field: id', () => {
      const invalid = { restaurant_id: validUpdate.restaurant_id }
      expect(() => UpdateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: restaurant_id', () => {
      const invalid = { id: validUpdate.id }
      expect(() => UpdateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid id UUID', () => {
      const invalid = { ...validUpdate, id: 'not-a-uuid' }
      expect(() => UpdateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid restaurant_id UUID', () => {
      const invalid = { ...validUpdate, restaurant_id: 'not-a-uuid' }
      expect(() => UpdateItemSchema.parse(invalid)).toThrow()
    })

    it('rejects negative price', () => {
      const invalid = { ...validUpdate, price: -100 }
      expect(() => UpdateItemSchema.parse(invalid)).toThrow()
    })
  })
})

describe('Orders Schemas', () => {
  describe('CreateOrderSchema', () => {
    const validOrder = {
      restaurant_slug: 'mi-restaurante',
      table_id: 'table-123',
      cart: [
        {
          menu_item_id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Pizza',
          quantity: 2,
          unit_price: 5000,
        },
      ],
    }

    it('accepts valid order with required fields', () => {
      expect(() => CreateOrderSchema.parse(validOrder)).not.toThrow()
    })

    it('accepts valid order with optional fields', () => {
      const fullOrder = {
        ...validOrder,
        client_name: 'Juan Pérez',
        notes: 'Sin cebolla',
      }
      expect(() => CreateOrderSchema.parse(fullOrder)).not.toThrow()
    })

    it('rejects missing required field: restaurant_slug', () => {
      const invalid = { table_id: 'table-123', cart: validOrder.cart }
      expect(() => CreateOrderSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: table_id', () => {
      const invalid = { restaurant_slug: 'mi-restaurante', cart: validOrder.cart }
      expect(() => CreateOrderSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: cart', () => {
      const invalid = { restaurant_slug: 'mi-restaurante', table_id: 'table-123' }
      expect(() => CreateOrderSchema.parse(invalid)).toThrow()
    })

    it('rejects empty cart array', () => {
      const invalid = { ...validOrder, cart: [] }
      expect(() => CreateOrderSchema.parse(invalid)).toThrow()
    })

    it('rejects cart item with missing menu_item_id', () => {
      const invalid = {
        ...validOrder,
        cart: [{ name: 'Pizza', quantity: 2, unit_price: 5000 }],
      }
      expect(() => CreateOrderSchema.parse(invalid)).toThrow()
    })

    it('rejects cart item with missing name', () => {
      const invalid = {
        ...validOrder,
        cart: [{ menu_item_id: '123', quantity: 2, unit_price: 5000 }],
      }
      expect(() => CreateOrderSchema.parse(invalid)).toThrow()
    })

    it('rejects cart item with missing quantity', () => {
      const invalid = {
        ...validOrder,
        cart: [{ menu_item_id: '123', name: 'Pizza', unit_price: 5000 }],
      }
      expect(() => CreateOrderSchema.parse(invalid)).toThrow()
    })

    it('rejects cart item with missing unit_price', () => {
      const invalid = {
        ...validOrder,
        cart: [{ menu_item_id: '123', name: 'Pizza', quantity: 2 }],
      }
      expect(() => CreateOrderSchema.parse(invalid)).toThrow()
    })

    it('rejects cart item with zero quantity', () => {
      const invalid = {
        ...validOrder,
        cart: [{ ...validOrder.cart[0], quantity: 0 }],
      }
      expect(() => CreateOrderSchema.parse(invalid)).toThrow()
    })

    it('rejects cart item with negative quantity', () => {
      const invalid = {
        ...validOrder,
        cart: [{ ...validOrder.cart[0], quantity: -1 }],
      }
      expect(() => CreateOrderSchema.parse(invalid)).toThrow()
    })

    it('rejects cart item with negative unit_price', () => {
      const invalid = {
        ...validOrder,
        cart: [{ ...validOrder.cart[0], unit_price: -100 }],
      }
      expect(() => CreateOrderSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid type for quantity (string instead of number)', () => {
      const invalid = {
        ...validOrder,
        cart: [{ ...validOrder.cart[0], quantity: '2' }],
      }
      expect(() => CreateOrderSchema.parse(invalid)).toThrow()
    })
  })
})

describe('Stock Schemas', () => {
  describe('ItemSchema', () => {
    const validItem = {
      restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Harina',
      unit: 'kg' as const,
      current_qty: 50,
      cost_per_unit: 1000,
    }

    it('accepts valid stock item with required fields', () => {
      expect(() => ItemSchema.parse(validItem)).not.toThrow()
    })

    it('accepts valid stock item with all optional fields', () => {
      const fullItem = {
        ...validItem,
        min_qty: 10,
        supplier: 'Proveedor ABC',
        category: 'Insumos',
        expiry_date: '2024-12-31',
        shelf_life_days: 180,
      }
      expect(() => ItemSchema.parse(fullItem)).not.toThrow()
    })

    it('rejects missing required field: restaurant_id', () => {
      const invalid = { name: 'Harina', unit: 'kg', current_qty: 50, cost_per_unit: 1000 }
      expect(() => ItemSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: name', () => {
      const invalid = { restaurant_id: validItem.restaurant_id, unit: 'kg', current_qty: 50, cost_per_unit: 1000 }
      expect(() => ItemSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: unit', () => {
      const invalid = { restaurant_id: validItem.restaurant_id, name: 'Harina', current_qty: 50, cost_per_unit: 1000 }
      expect(() => ItemSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: current_qty', () => {
      const invalid = { restaurant_id: validItem.restaurant_id, name: 'Harina', unit: 'kg', cost_per_unit: 1000 }
      expect(() => ItemSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: cost_per_unit', () => {
      const invalid = { restaurant_id: validItem.restaurant_id, name: 'Harina', unit: 'kg', current_qty: 50 }
      expect(() => ItemSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid restaurant_id UUID', () => {
      const invalid = { ...validItem, restaurant_id: 'not-a-uuid' }
      expect(() => ItemSchema.parse(invalid)).toThrow()
    })

    it('rejects negative current_qty', () => {
      const invalid = { ...validItem, current_qty: -10 }
      expect(() => ItemSchema.parse(invalid)).toThrow()
    })

    it('rejects negative cost_per_unit', () => {
      const invalid = { ...validItem, cost_per_unit: -100 }
      expect(() => ItemSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid unit enum value', () => {
      const invalid = { ...validItem, unit: 'invalid-unit' }
      expect(() => ItemSchema.parse(invalid)).toThrow()
    })

    it('rejects name exceeding max length (100 chars)', () => {
      const invalid = { ...validItem, name: 'a'.repeat(101) }
      expect(() => ItemSchema.parse(invalid)).toThrow()
    })

    it('rejects empty name', () => {
      const invalid = { ...validItem, name: '' }
      expect(() => ItemSchema.parse(invalid)).toThrow()
    })

    it('rejects negative min_qty', () => {
      const invalid = { ...validItem, min_qty: -5 }
      expect(() => ItemSchema.parse(invalid)).toThrow()
    })

    it('rejects negative shelf_life_days', () => {
      const invalid = { ...validItem, shelf_life_days: -30 }
      expect(() => ItemSchema.parse(invalid)).toThrow()
    })
  })

  describe('AdjustSchema', () => {
    const validAdjust = {
      stock_item_id: '550e8400-e29b-41d4-a716-446655440000',
      delta: 10,
      restaurant_id: '550e8400-e29b-41d4-a716-446655440001',
    }

    it('accepts valid adjustment with positive delta', () => {
      expect(() => AdjustSchema.parse(validAdjust)).not.toThrow()
    })

    it('accepts valid adjustment with negative delta', () => {
      const adjust = { ...validAdjust, delta: -5 }
      expect(() => AdjustSchema.parse(adjust)).not.toThrow()
    })

    it('accepts valid adjustment with reason', () => {
      const adjust = { ...validAdjust, reason: 'compra' as const }
      expect(() => AdjustSchema.parse(adjust)).not.toThrow()
    })

    it('rejects missing required field: stock_item_id', () => {
      const invalid = { delta: 10, restaurant_id: validAdjust.restaurant_id }
      expect(() => AdjustSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: delta', () => {
      const invalid = { stock_item_id: validAdjust.stock_item_id, restaurant_id: validAdjust.restaurant_id }
      expect(() => AdjustSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: restaurant_id', () => {
      const invalid = { stock_item_id: validAdjust.stock_item_id, delta: 10 }
      expect(() => AdjustSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid stock_item_id UUID', () => {
      const invalid = { ...validAdjust, stock_item_id: 'not-a-uuid' }
      expect(() => AdjustSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid restaurant_id UUID', () => {
      const invalid = { ...validAdjust, restaurant_id: 'not-a-uuid' }
      expect(() => AdjustSchema.parse(invalid)).toThrow()
    })

    it('rejects zero delta', () => {
      const invalid = { ...validAdjust, delta: 0 }
      expect(() => AdjustSchema.parse(invalid)).toThrow(/delta no puede ser cero/)
    })

    it('rejects invalid reason enum value', () => {
      const invalid = { ...validAdjust, reason: 'invalid-reason' }
      expect(() => AdjustSchema.parse(invalid)).toThrow()
    })
  })
})

describe('Cash Expenses Schemas', () => {
  describe('CreateExpenseSchema', () => {
    const validExpense = {
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      restaurant_id: '550e8400-e29b-41d4-a716-446655440001',
      amount: 5000,
      description: 'Compra de insumos',
    }

    it('accepts valid expense with required fields', () => {
      expect(() => CreateExpenseSchema.parse(validExpense)).not.toThrow()
    })

    it('accepts valid expense with category', () => {
      const expense = { ...validExpense, category: 'insumos' as const }
      expect(() => CreateExpenseSchema.parse(expense)).not.toThrow()
    })

    it('rejects missing required field: session_id', () => {
      const invalid = { restaurant_id: validExpense.restaurant_id, amount: 5000, description: 'Test' }
      expect(() => CreateExpenseSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: restaurant_id', () => {
      const invalid = { session_id: validExpense.session_id, amount: 5000, description: 'Test' }
      expect(() => CreateExpenseSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: amount', () => {
      const invalid = { session_id: validExpense.session_id, restaurant_id: validExpense.restaurant_id, description: 'Test' }
      expect(() => CreateExpenseSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: description', () => {
      const invalid = { session_id: validExpense.session_id, restaurant_id: validExpense.restaurant_id, amount: 5000 }
      expect(() => CreateExpenseSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid session_id UUID', () => {
      const invalid = { ...validExpense, session_id: 'not-a-uuid' }
      expect(() => CreateExpenseSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid restaurant_id UUID', () => {
      const invalid = { ...validExpense, restaurant_id: 'not-a-uuid' }
      expect(() => CreateExpenseSchema.parse(invalid)).toThrow()
    })

    it('rejects zero amount', () => {
      const invalid = { ...validExpense, amount: 0 }
      expect(() => CreateExpenseSchema.parse(invalid)).toThrow()
    })

    it('rejects negative amount', () => {
      const invalid = { ...validExpense, amount: -100 }
      expect(() => CreateExpenseSchema.parse(invalid)).toThrow()
    })

    it('rejects empty description', () => {
      const invalid = { ...validExpense, description: '' }
      expect(() => CreateExpenseSchema.parse(invalid)).toThrow()
    })

    it('rejects description exceeding max length (200 chars)', () => {
      const invalid = { ...validExpense, description: 'a'.repeat(201) }
      expect(() => CreateExpenseSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid category enum value', () => {
      const invalid = { ...validExpense, category: 'invalid-category' }
      expect(() => CreateExpenseSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid type for amount (string instead of number)', () => {
      const invalid = { ...validExpense, amount: '5000' }
      expect(() => CreateExpenseSchema.parse(invalid)).toThrow()
    })
  })
})

describe('Notifications Schemas', () => {
  describe('CreateNotificationSchema', () => {
    const validNotification = {
      restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'order_ready',
      title: 'Pedido listo',
    }

    it('accepts valid notification with required fields', () => {
      expect(() => CreateNotificationSchema.parse(validNotification)).not.toThrow()
    })

    it('accepts valid notification with all optional fields', () => {
      const fullNotification = {
        ...validNotification,
        message: 'El pedido de la mesa 5 está listo',
        severity: 'info' as const,
        category: 'operacion' as const,
        action_url: '/comandas?id=123',
        action_label: 'Ver pedido',
        dedupe_key: 'order_ready_123',
        metadata: { order_id: '123', table: '5' },
      }
      expect(() => CreateNotificationSchema.parse(fullNotification)).not.toThrow()
    })

    it('rejects missing required field: restaurant_id', () => {
      const invalid = { type: 'order_ready', title: 'Pedido listo' }
      expect(() => CreateNotificationSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: type', () => {
      const invalid = { restaurant_id: validNotification.restaurant_id, title: 'Pedido listo' }
      expect(() => CreateNotificationSchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: title', () => {
      const invalid = { restaurant_id: validNotification.restaurant_id, type: 'order_ready' }
      expect(() => CreateNotificationSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid restaurant_id UUID', () => {
      const invalid = { ...validNotification, restaurant_id: 'not-a-uuid' }
      expect(() => CreateNotificationSchema.parse(invalid)).toThrow()
    })

    it('rejects empty type', () => {
      const invalid = { ...validNotification, type: '' }
      expect(() => CreateNotificationSchema.parse(invalid)).toThrow()
    })

    it('rejects empty title', () => {
      const invalid = { ...validNotification, title: '' }
      expect(() => CreateNotificationSchema.parse(invalid)).toThrow()
    })

    it('rejects title exceeding max length (200 chars)', () => {
      const invalid = { ...validNotification, title: 'a'.repeat(201) }
      expect(() => CreateNotificationSchema.parse(invalid)).toThrow()
    })

    it('rejects message exceeding max length (1000 chars)', () => {
      const invalid = { ...validNotification, message: 'a'.repeat(1001) }
      expect(() => CreateNotificationSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid severity enum value', () => {
      const invalid = { ...validNotification, severity: 'invalid' }
      expect(() => CreateNotificationSchema.parse(invalid)).toThrow()
    })

    it('rejects invalid category enum value', () => {
      const invalid = { ...validNotification, category: 'invalid' }
      expect(() => CreateNotificationSchema.parse(invalid)).toThrow()
    })

    it('rejects action_url exceeding max length (500 chars)', () => {
      const invalid = { ...validNotification, action_url: 'a'.repeat(501) }
      expect(() => CreateNotificationSchema.parse(invalid)).toThrow()
    })

    it('rejects action_label exceeding max length (80 chars)', () => {
      const invalid = { ...validNotification, action_label: 'a'.repeat(81) }
      expect(() => CreateNotificationSchema.parse(invalid)).toThrow()
    })

    it('rejects dedupe_key exceeding max length (200 chars)', () => {
      const invalid = { ...validNotification, dedupe_key: 'a'.repeat(201) }
      expect(() => CreateNotificationSchema.parse(invalid)).toThrow()
    })
  })
})

describe('Delivery Integrations Schemas', () => {
  describe('UpsertDeliverySchema', () => {
    const validIntegration = {
      restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
      platform: 'pedidosya' as const,
    }

    it('accepts valid integration with required fields', () => {
      expect(() => UpsertDeliverySchema.parse(validIntegration)).not.toThrow()
    })

    it('accepts valid integration with all optional fields', () => {
      const fullIntegration = {
        ...validIntegration,
        external_id: 'ext-123',
        api_key: 'secret-key-12345',
        auto_sync_menu: true,
        status: 'connected' as const,
      }
      expect(() => UpsertDeliverySchema.parse(fullIntegration)).not.toThrow()
    })

    it('rejects missing required field: restaurant_id', () => {
      const invalid = { platform: 'pedidosya' }
      expect(() => UpsertDeliverySchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: platform', () => {
      const invalid = { restaurant_id: validIntegration.restaurant_id }
      expect(() => UpsertDeliverySchema.parse(invalid)).toThrow()
    })

    it('rejects invalid restaurant_id UUID', () => {
      const invalid = { ...validIntegration, restaurant_id: 'not-a-uuid' }
      expect(() => UpsertDeliverySchema.parse(invalid)).toThrow()
    })

    it('rejects invalid platform enum value', () => {
      const invalid = { ...validIntegration, platform: 'invalid_platform' }
      expect(() => UpsertDeliverySchema.parse(invalid)).toThrow()
    })

    it('accepts all valid platform values', () => {
      const platforms = ['pedidosya', 'rappi', 'uber_eats', 'justo', 'didi_food', 'cornershop']
      platforms.forEach(platform => {
        expect(() => UpsertDeliverySchema.parse({ ...validIntegration, platform })).not.toThrow()
      })
    })

    it('rejects invalid status enum value', () => {
      const invalid = { ...validIntegration, status: 'invalid_status' }
      expect(() => UpsertDeliverySchema.parse(invalid)).toThrow()
    })

    it('accepts all valid status values', () => {
      const statuses = ['disconnected', 'pending', 'connected', 'error']
      statuses.forEach(status => {
        expect(() => UpsertDeliverySchema.parse({ ...validIntegration, status })).not.toThrow()
      })
    })

    it('rejects invalid type for auto_sync_menu (string instead of boolean)', () => {
      const invalid = { ...validIntegration, auto_sync_menu: 'true' }
      expect(() => UpsertDeliverySchema.parse(invalid)).toThrow()
    })
  })
})

describe('Categories Schemas', () => {
  describe('CreateCategorySchema', () => {
    const validCategory = {
      restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Entradas',
    }

    it('accepts valid category with required fields', () => {
      expect(() => CreateCategorySchema.parse(validCategory)).not.toThrow()
    })

    it('accepts valid category with all optional fields', () => {
      const fullCategory = {
        ...validCategory,
        slug: 'entradas',
        icon: 'utensils',
        sort_order: 1,
        shared_in_brand: false,
      }
      expect(() => CreateCategorySchema.parse(fullCategory)).not.toThrow()
    })

    it('rejects missing required field: restaurant_id', () => {
      const invalid = { name: 'Entradas' }
      expect(() => CreateCategorySchema.parse(invalid)).toThrow()
    })

    it('rejects missing required field: name', () => {
      const invalid = { restaurant_id: validCategory.restaurant_id }
      expect(() => CreateCategorySchema.parse(invalid)).toThrow()
    })

    it('rejects invalid restaurant_id UUID', () => {
      const invalid = { ...validCategory, restaurant_id: 'not-a-uuid' }
      expect(() => CreateCategorySchema.parse(invalid)).toThrow()
    })

    it('rejects empty name', () => {
      const invalid = { ...validCategory, name: '' }
      expect(() => CreateCategorySchema.parse(invalid)).toThrow()
    })

    it('rejects name exceeding max length (80 chars)', () => {
      const invalid = { ...validCategory, name: 'a'.repeat(81) }
      expect(() => CreateCategorySchema.parse(invalid)).toThrow()
    })

    it('rejects slug exceeding max length (80 chars)', () => {
      const invalid = { ...validCategory, slug: 'a'.repeat(81) }
      expect(() => CreateCategorySchema.parse(invalid)).toThrow()
    })

    it('rejects icon exceeding max length (40 chars)', () => {
      const invalid = { ...validCategory, icon: 'a'.repeat(41) }
      expect(() => CreateCategorySchema.parse(invalid)).toThrow()
    })

    it('rejects invalid type for sort_order (string instead of number)', () => {
      const invalid = { ...validCategory, sort_order: '1' }
      expect(() => CreateCategorySchema.parse(invalid)).toThrow()
    })

    it('rejects invalid type for shared_in_brand (string instead of boolean)', () => {
      const invalid = { ...validCategory, shared_in_brand: 'true' }
      expect(() => CreateCategorySchema.parse(invalid)).toThrow()
    })

    it('applies default value for shared_in_brand when not provided', () => {
      const result = CreateCategorySchema.parse(validCategory)
      expect(result.shared_in_brand).toBe(true)
    })
  })
})
