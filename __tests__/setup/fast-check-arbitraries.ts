// ══════════════════════════════════════════════════════════════════════════════
//  Fast-Check Arbitraries — __tests__/setup/fast-check-arbitraries.ts
//
//  Custom fast-check generators (arbitraries) for property-based testing.
//  These generators produce random valid test data for domain objects.
//
//  Requirements: 1.1
// ══════════════════════════════════════════════════════════════════════════════

import * as fc from 'fast-check'
import { z } from 'zod'

// ── UUID Generator ────────────────────────────────────────────────────────────

/**
 * Generates valid UUID v4 strings.
 * 
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbUuid(), (uuid) => {
 *     expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
 *   })
 * )
 * ```
 */
export function arbUuid(): fc.Arbitrary<string> {
  return fc.uuid()
}

// ── Restaurant Slug Generator ─────────────────────────────────────────────────

/**
 * Generates valid restaurant slug format (lowercase, hyphens, 3-50 chars).
 * 
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbRestaurantSlug(), (slug) => {
 *     expect(slug).toMatch(/^[a-z0-9-]{3,50}$/)
 *   })
 * )
 * ```
 */
export function arbRestaurantSlug(): fc.Arbitrary<string> {
  return fc
    .array(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
      { minLength: 3, maxLength: 50 }
    )
    .map(chars => chars.join(''))
}

// ── Menu Item Generator ───────────────────────────────────────────────────────

/**
 * Generates complete menu item objects with valid constraints.
 * 
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbMenuItem(), (item) => {
 *     expect(item.price).toBeGreaterThanOrEqual(0)
 *     expect(item.name.length).toBeGreaterThan(0)
 *     expect(item.name.length).toBeLessThanOrEqual(100)
 *   })
 * )
 * ```
 */
export function arbMenuItem(): fc.Arbitrary<{
  id: string
  restaurant_id: string
  name: string
  description?: string
  price: number
  category: string
  tags: string[]
  available: boolean
  cost_price?: number
  photo_url?: string
  ingredients?: Array<{ stock_item_id: string; qty: number }>
}> {
  return fc.record({
    id: arbUuid(),
    restaurant_id: arbUuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.option(fc.string({ maxLength: 300 }), { nil: undefined }),
    price: fc.integer({ min: 0, max: 1_000_000 }),
    category: fc.constantFrom('Principal', 'Entrada', 'Postre', 'Bebida', 'Acompañamiento'),
    tags: fc.array(fc.string({ maxLength: 30 }), { maxLength: 10 }),
    available: fc.boolean(),
    cost_price: fc.option(fc.integer({ min: 0, max: 1_000_000 }), { nil: undefined }),
    photo_url: fc.option(fc.webUrl(), { nil: undefined }),
    ingredients: fc.option(
      fc.array(
        fc.record({
          stock_item_id: arbUuid(),
          qty: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
        }),
        { maxLength: 20 }
      ),
      { nil: undefined }
    ),
  })
}

// ── Stock Item Generator ──────────────────────────────────────────────────────

/**
 * Generates stock item objects with positive quantities.
 * 
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbStockItem(), (item) => {
 *     expect(item.current_qty).toBeGreaterThanOrEqual(0)
 *     expect(item.cost_per_unit).toBeGreaterThanOrEqual(0)
 *   })
 * )
 * ```
 */
export function arbStockItem(): fc.Arbitrary<{
  id: string
  restaurant_id: string
  name: string
  unit: 'kg' | 'g' | 'l' | 'ml' | 'unidad' | 'porcion' | 'caja' | 'onza'
  current_qty: number
  min_qty: number
  cost_per_unit: number
  supplier?: string
  category?: string
  active: boolean
}> {
  return fc.record({
    id: arbUuid(),
    restaurant_id: arbUuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    unit: fc.constantFrom('kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja', 'onza'),
    current_qty: fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true }),
    min_qty: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
    cost_per_unit: fc.integer({ min: 0, max: 100_000 }),
    supplier: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
    category: fc.option(fc.constantFrom('Carnes', 'Verduras', 'Lácteos', 'Bebidas', 'Otros'), { nil: undefined }),
    active: fc.boolean(),
  })
}

// ── Order Generator ───────────────────────────────────────────────────────────

/**
 * Generates order objects with items and valid totals.
 * The total is calculated from the items to ensure consistency.
 * 
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbOrder(), (order) => {
 *     const calculatedTotal = order.items.reduce(
 *       (sum, item) => sum + item.quantity * item.unit_price,
 *       0
 *     )
 *     expect(order.total).toBe(calculatedTotal)
 *   })
 * )
 * ```
 */
export function arbOrder(): fc.Arbitrary<{
  id: string
  restaurant_id: string
  table_id: string | null
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'paying' | 'paid' | 'cancelled'
  total: number
  client_name?: string
  notes?: string
  items: Array<{
    id: string
    order_id: string
    menu_item_id: string
    name: string
    quantity: number
    unit_price: number
    notes?: string
    status: 'pending' | 'preparing' | 'ready' | 'cancelled'
  }>
}> {
  return fc
    .record({
      id: arbUuid(),
      restaurant_id: arbUuid(),
      table_id: fc.option(arbUuid(), { nil: null }),
      status: fc.constantFrom('pending', 'confirmed', 'preparing', 'ready', 'paying', 'paid', 'cancelled'),
      client_name: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
      notes: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
      items: fc.array(
        fc.record({
          id: arbUuid(),
          menu_item_id: arbUuid(),
          name: fc.string({ minLength: 1, maxLength: 100 }),
          quantity: fc.integer({ min: 1, max: 20 }),
          unit_price: fc.integer({ min: 0, max: 100_000 }),
          notes: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
          status: fc.constantFrom('pending', 'preparing', 'ready', 'cancelled'),
        }),
        { minLength: 1, maxLength: 20 }
      ),
    })
    .map(order => {
      // Calculate total from items to ensure consistency
      const total = order.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
      
      // Set order_id for all items
      const items = order.items.map(item => ({
        ...item,
        order_id: order.id,
      }))
      
      return {
        ...order,
        total,
        items,
      }
    })
}

// ── Cash Session Generator ────────────────────────────────────────────────────

/**
 * Generates cash session objects with opening amounts.
 * 
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbCashSession(), (session) => {
 *     expect(session.opening_amount).toBeGreaterThanOrEqual(0)
 *     if (session.status === 'closed') {
 *       expect(session.closed_at).toBeDefined()
 *     }
 *   })
 * )
 * ```
 */
export function arbCashSession(): fc.Arbitrary<{
  id: string
  restaurant_id: string
  opening_amount: number
  status: 'open' | 'closed'
  opened_at: string
  closed_at: string | null
  actual_cash?: number
  expected_cash?: number
  difference?: number
}> {
  return fc
    .record({
      id: arbUuid(),
      restaurant_id: arbUuid(),
      opening_amount: fc.integer({ min: 0, max: 10_000_000 }),
      status: fc.constantFrom('open', 'closed'),
      opened_at: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    })
    .chain(base => {
      const openedAtStr = base.opened_at.toISOString()
      
      if (base.status === 'closed') {
        return fc
          .record({
            closed_at: fc.date({ min: base.opened_at, max: new Date() }),
            actual_cash: fc.integer({ min: 0, max: 20_000_000 }),
            expected_cash: fc.integer({ min: 0, max: 20_000_000 }),
          })
          .map(extras => ({
            id: base.id,
            restaurant_id: base.restaurant_id,
            opening_amount: base.opening_amount,
            status: base.status,
            opened_at: openedAtStr,
            closed_at: extras.closed_at.toISOString(),
            actual_cash: extras.actual_cash,
            expected_cash: extras.expected_cash,
            difference: extras.actual_cash - extras.expected_cash,
          }))
      } else {
        return fc.constant({
          id: base.id,
          restaurant_id: base.restaurant_id,
          opening_amount: base.opening_amount,
          status: base.status,
          opened_at: openedAtStr,
          closed_at: null,
        })
      }
    })
}

// ── Generic Zod Schema Generator ──────────────────────────────────────────────

/**
 * Generic generator that produces values passing a Zod schema.
 * 
 * **IMPORTANT LIMITATIONS:**
 * This is a best-effort implementation for Zod v4 schemas. It works well for:
 * - Simple string/number/boolean schemas with basic constraints
 * - Enums and literals
 * - Optional and nullable types
 * 
 * For complex schemas with:
 * - Custom refinements
 * - Transforms
 * - Complex nested structures
 * - Union types
 * 
 * **We recommend creating custom arbitraries** using the domain-specific generators
 * (arbMenuItem, arbStockItem, arbOrder, etc.) as examples.
 * 
 * @example
 * ```typescript
 * // Simple schemas work well:
 * const NameSchema = z.string().min(1).max(50)
 * fc.assert(
 *   fc.property(arbZodSchema(NameSchema), (name) => {
 *     expect(() => NameSchema.parse(name)).not.toThrow()
 *   })
 * )
 * 
 * // For complex schemas, create custom arbitraries:
 * const MenuItemSchema = z.object({ ... })
 * // Use arbMenuItem() instead of arbZodSchema(MenuItemSchema)
 * ```
 */
export function arbZodSchema<T>(schema: z.ZodType<T>): fc.Arbitrary<T> {
  return arbZodSchemaInternal(schema) as fc.Arbitrary<T>
}

// Internal implementation with type erasure for recursive calls
function arbZodSchemaInternal(schema: z.ZodTypeAny): fc.Arbitrary<any> {
  const def = schema._def
  // Zod v4 uses 'type' instead of 'typeName'
  const typeName = (def as any).type || def.typeName

  // Handle undefined typeName (shouldn't happen but let's be safe)
  if (!typeName) {
    console.warn(`arbZodSchema: Schema has no type or typeName. Returning fc.anything().`)
    return fc.anything()
  }

  switch (typeName) {
    case 'string':
    case 'ZodString': {
      let arb: fc.Arbitrary<string> = fc.string()
      
      // Apply constraints
      for (const check of (def as any).checks || []) {
        const kind = check.kind || check.type
        switch (kind) {
          case 'min':
            arb = fc.string({ minLength: check.value })
            break
          case 'max':
            arb = fc.string({ maxLength: check.value })
            break
          case 'email':
            arb = fc.emailAddress()
            break
          case 'url':
            arb = fc.webUrl()
            break
          case 'uuid':
            arb = fc.uuid()
            break
          case 'length':
            arb = fc.string({ minLength: check.value, maxLength: check.value })
            break
        }
      }
      
      return arb
    }

    case 'number':
    case 'ZodNumber': {
      let min = Number.MIN_SAFE_INTEGER
      let max = Number.MAX_SAFE_INTEGER
      let isInt = false
      
      // Apply constraints
      for (const check of (def as any).checks || []) {
        const kind = check.kind || check.type
        switch (kind) {
          case 'min':
            min = check.inclusive ? check.value : check.value + (isInt ? 1 : Number.EPSILON)
            break
          case 'max':
            max = check.inclusive ? check.value : check.value - (isInt ? 1 : Number.EPSILON)
            break
          case 'int':
            isInt = true
            break
        }
      }
      
      // Clamp to reasonable bounds for testing
      min = Math.max(min, -1_000_000_000)
      max = Math.min(max, 1_000_000_000)
      
      if (isInt) {
        return fc.integer({ min: Math.ceil(min), max: Math.floor(max) })
      } else {
        return fc.float({ min: Math.fround(min), max: Math.fround(max), noNaN: true })
      }
    }

    case 'boolean':
    case 'ZodBoolean':
      return fc.boolean()

    case 'enum':
    case 'ZodEnum':
      return fc.constantFrom(...(def as any).values)

    case 'array':
    case 'ZodArray': {
      const elementArb = arbZodSchemaInternal((def as any).type || (def as any).element)
      const minLength = (def as any).minLength?.value ?? 0
      const maxLength = (def as any).maxLength?.value ?? 10
      return fc.array(elementArb, { minLength, maxLength })
    }

    case 'object':
    case 'ZodObject': {
      const shape = (def as any).shape()
      const entries = Object.entries(shape).map(([key, valueSchema]) => {
        return [key, arbZodSchemaInternal(valueSchema as z.ZodTypeAny)] as const
      })
      
      const recordArb: Record<string, fc.Arbitrary<any>> = {}
      for (const [key, arb] of entries) {
        recordArb[key] = arb
      }
      
      return fc.record(recordArb)
    }

    case 'optional':
    case 'ZodOptional':
      return fc.option(arbZodSchemaInternal((def as any).innerType || (def as any).inner), { nil: undefined })

    case 'nullable':
    case 'ZodNullable':
      return fc.option(arbZodSchemaInternal((def as any).innerType || (def as any).inner), { nil: null })

    case 'union':
    case 'ZodUnion':
      return fc.oneof(...(def as any).options.map((opt: z.ZodTypeAny) => arbZodSchemaInternal(opt)))

    case 'literal':
    case 'ZodLiteral':
      return fc.constant((def as any).value)

    case 'default':
    case 'ZodDefault':
      // For defaults, we generate the inner type (the default will be applied by Zod if needed)
      return arbZodSchemaInternal((def as any).innerType || (def as any).inner)

    case 'effects':
    case 'ZodEffects':
      // For refinements/transforms, generate the input type
      // Note: This may generate invalid values if the refinement is strict
      return arbZodSchemaInternal((def as any).schema || (def as any).inner)

    default:
      // Fallback for unsupported types
      console.warn(`arbZodSchema: Unsupported Zod type: ${typeName}. Returning fc.anything().`)
      return fc.anything()
  }
}
