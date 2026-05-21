// ══════════════════════════════════════════════════════════════════════════════
//  Fast-Check Arbitraries — __tests__/setup/fast-check-arbitraries.ts
//
//  Custom fast-check generators (arbitraries) for property-based testing.
//  These generators produce random valid test data for domain objects.
//
//  Requirements: 1.1, 9.7
// ══════════════════════════════════════════════════════════════════════════════

import * as fc from 'fast-check'
import { z } from 'zod'
import type {
  CustomerProfile,
  SavedAddress,
  CustomerRating,
  LoyaltyTransaction,
} from '../../lib/customer/types'

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
  const minMs = new Date('2020-01-01T00:00:00.000Z').getTime()
  const maxMs = new Date('2030-12-31T23:59:59.999Z').getTime()

  return fc
    .record({
      id: arbUuid(),
      restaurant_id: arbUuid(),
      opening_amount: fc.integer({ min: 0, max: 10_000_000 }),
      status: fc.constantFrom('open', 'closed'),
      openedAtMs: fc.integer({ min: minMs, max: maxMs }),
    })
    .chain(base => {
      const openedAtStr = new Date(base.openedAtMs).toISOString()

      if (base.status === 'closed') {
        return fc
          .record({
            closedAtMs: fc.integer({ min: base.openedAtMs, max: maxMs }),
            actual_cash: fc.integer({ min: 0, max: 20_000_000 }),
            expected_cash: fc.integer({ min: 0, max: 20_000_000 }),
          })
          .map(extras => ({
            id: base.id,
            restaurant_id: base.restaurant_id,
            opening_amount: base.opening_amount,
            status: base.status,
            opened_at: openedAtStr,
            closed_at: new Date(extras.closedAtMs).toISOString(),
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

// ── Customer Module Arbitraries ───────────────────────────────────────────────
// Requirements: 9.7

/**
 * Generates valid ISO 8601 timestamp strings (UTC).
 * Internal helper used by customer module arbitraries.
 * Uses integer epoch ms to avoid invalid date issues during shrinking.
 */
function arbIsoTimestamp(): fc.Arbitrary<string> {
  const minMs = new Date('2020-01-01T00:00:00.000Z').getTime()
  const maxMs = new Date('2030-12-31T23:59:59.999Z').getTime()
  return fc
    .integer({ min: minMs, max: maxMs })
    .map(ms => new Date(ms).toISOString())
}

/**
 * Generates valid `CustomerProfile` objects matching the `customer_profiles` table.
 *
 * Constraints:
 * - `loyalty_points` ≥ 0 (CHECK constraint in DB)
 * - `display_name` is non-empty
 *
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbCustomerProfile(), (profile) => {
 *     expect(profile.loyalty_points).toBeGreaterThanOrEqual(0)
 *     expect(profile.display_name.length).toBeGreaterThan(0)
 *   })
 * )
 * ```
 */
export function arbCustomerProfile(): fc.Arbitrary<CustomerProfile> {
  return fc.record({
    id: arbUuid(),
    user_id: arbUuid(),
    display_name: fc.string({ minLength: 1, maxLength: 100 }),
    phone: fc.option(
      fc.array(
        fc.constantFrom('+', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ' ', '(', ')', '-'),
        { minLength: 8, maxLength: 20 }
      ).map(chars => chars.join('')),
      { nil: null }
    ),
    photo_url: fc.option(fc.webUrl(), { nil: null }),
    loyalty_points: fc.integer({ min: 0, max: 1_000_000 }),
    push_token: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
    created_at: arbIsoTimestamp(),
    updated_at: arbIsoTimestamp(),
  })
}

/**
 * Generates valid `SavedAddress` objects matching the `saved_addresses` table.
 *
 * Constraints:
 * - `label` 1–50 chars
 * - `street` 5–300 chars
 * - `city` 1–100 chars
 * - `notes` ≤ 300 chars (optional)
 *
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbSavedAddress(), (addr) => {
 *     expect(addr.label.length).toBeGreaterThanOrEqual(1)
 *     expect(addr.street.length).toBeGreaterThanOrEqual(5)
 *   })
 * )
 * ```
 */
export function arbSavedAddress(): fc.Arbitrary<SavedAddress> {
  return fc.record({
    id: arbUuid(),
    customer_id: arbUuid(),
    label: fc.string({ minLength: 1, maxLength: 50 }),
    street: fc.string({ minLength: 5, maxLength: 300 }),
    city: fc.string({ minLength: 1, maxLength: 100 }),
    notes: fc.option(fc.string({ maxLength: 300 }), { nil: null }),
    is_default: fc.boolean(),
    created_at: arbIsoTimestamp(),
    updated_at: arbIsoTimestamp(),
  })
}

/**
 * Generates valid `CustomerRating` objects matching the `customer_ratings` table.
 *
 * Constraints:
 * - `stars` ∈ [1, 5]
 * - `entity_type` ∈ ['rider', 'restaurant']
 * - `order_type` ∈ ['delivery', 'presencial']
 * - `comment` ≤ 500 chars (optional)
 *
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbCustomerRating(), (rating) => {
 *     expect(rating.stars).toBeGreaterThanOrEqual(1)
 *     expect(rating.stars).toBeLessThanOrEqual(5)
 *   })
 * )
 * ```
 */
export function arbCustomerRating(): fc.Arbitrary<CustomerRating> {
  return fc.record({
    id: arbUuid(),
    customer_id: arbUuid(),
    entity_type: fc.constantFrom('rider', 'restaurant') as fc.Arbitrary<'rider' | 'restaurant'>,
    entity_id: arbUuid(),
    order_id: arbUuid(),
    order_type: fc.constantFrom('delivery', 'presencial') as fc.Arbitrary<'delivery' | 'presencial'>,
    stars: fc.integer({ min: 1, max: 5 }),
    comment: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
    created_at: arbIsoTimestamp(),
  })
}

/**
 * Generates valid `LoyaltyTransaction` objects matching the `loyalty_transactions` table.
 *
 * Constraints:
 * - `balance_after` ≥ 0 (CHECK constraint in DB)
 * - `points_delta` can be positive (earn) or negative (redeem)
 * - `description` is non-empty
 *
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbLoyaltyTransaction(), (tx) => {
 *     expect(tx.balance_after).toBeGreaterThanOrEqual(0)
 *   })
 * )
 * ```
 */
export function arbLoyaltyTransaction(): fc.Arbitrary<LoyaltyTransaction> {
  return fc.record({
    id: arbUuid(),
    customer_id: arbUuid(),
    order_id: fc.option(arbUuid(), { nil: null }),
    order_type: fc.option(
      fc.constantFrom('delivery', 'presencial') as fc.Arbitrary<'delivery' | 'presencial'>,
      { nil: null }
    ),
    points_delta: fc.integer({ min: -100_000, max: 100_000 }),
    balance_after: fc.integer({ min: 0, max: 1_000_000 }),
    description: fc.string({ minLength: 1, maxLength: 200 }),
    created_at: arbIsoTimestamp(),
  })
}

/**
 * Generates valid order totals in CLP (Chilean Peso).
 * Produces non-negative integers representing the total amount in CLP.
 *
 * Used for testing loyalty points calculation: `floor(total_clp / 100) * multiplier`.
 *
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbOrderTotal(), (total) => {
 *     expect(total).toBeGreaterThanOrEqual(0)
 *     expect(Number.isInteger(total)).toBe(true)
 *   })
 * )
 * ```
 */
export function arbOrderTotal(): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max: 10_000_000 })
}

/**
 * Generates valid loyalty points multipliers in the range [0.5, 5.0].
 * Matches the `points_multiplier` column constraint in the `restaurants` table.
 *
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbPointsMultiplier(), (m) => {
 *     expect(m).toBeGreaterThanOrEqual(0.5)
 *     expect(m).toBeLessThanOrEqual(5.0)
 *   })
 * )
 * ```
 */
export function arbPointsMultiplier(): fc.Arbitrary<number> {
  // Generate multiples of 0.5 in [0.5, 5.0] to match the numeric(3,1) DB column
  return fc.integer({ min: 1, max: 10 }).map(n => n * 0.5)
}

/**
 * Generates valid GPS coordinates with latitude ∈ [-90, 90] and longitude ∈ [-180, 180].
 *
 * Used for Property 7: Delivery tracking GPS coordinate invariants.
 *
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbGpsCoordinate(), ({ lat, lng }) => {
 *     expect(lat).toBeGreaterThanOrEqual(-90)
 *     expect(lat).toBeLessThanOrEqual(90)
 *     expect(lng).toBeGreaterThanOrEqual(-180)
 *     expect(lng).toBeLessThanOrEqual(180)
 *   })
 * )
 * ```
 */
export function arbGpsCoordinate(): fc.Arbitrary<{ lat: number; lng: number }> {
  return fc.record({
    lat: fc.float({ min: -90, max: 90, noNaN: true }),
    lng: fc.float({ min: -180, max: 180, noNaN: true }),
  })
}

/**
 * Generates valid geofence configurations for a restaurant.
 *
 * Constraints:
 * - `radius_m` ∈ [100, 2000] (matches `geofence_radius_m` CHECK constraint)
 * - `center_lat` ∈ [-90, 90]
 * - `center_lng` ∈ [-180, 180]
 *
 * @example
 * ```typescript
 * fc.assert(
 *   fc.property(arbGeofenceConfig(), (cfg) => {
 *     expect(cfg.radius_m).toBeGreaterThanOrEqual(100)
 *     expect(cfg.radius_m).toBeLessThanOrEqual(2000)
 *   })
 * )
 * ```
 */
export function arbGeofenceConfig(): fc.Arbitrary<{
  radius_m: number
  center_lat: number
  center_lng: number
}> {
  return fc.record({
    radius_m: fc.integer({ min: 100, max: 2000 }),
    center_lat: fc.float({ min: -90, max: 90, noNaN: true }),
    center_lng: fc.float({ min: -180, max: 180, noNaN: true }),
  })
}
