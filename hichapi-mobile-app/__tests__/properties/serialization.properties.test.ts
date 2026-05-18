/**
 * Property-Based Tests: Serialization Round-Trip
 *
 * Validates: Requirements 21.7 (Property 11 — Data Serialization Round-Trip)
 *
 * For any valid data object (Order, MenuItem, Cart), serializing to JSON then
 * parsing back SHALL produce an object equivalent to the original.
 *
 * Uses fast-check to generate arbitrary valid objects and verify that:
 *   - JSON.parse(JSON.stringify(obj)) passes Zod schema validation
 *   - The parsed object has the same field values as the original
 *   - All string fields remain strings after round-trip
 *   - All number fields remain numbers after round-trip
 */

import * as fc from 'fast-check';
import {
  OrderSchema,
  MenuItemSchema,
  CartSchema,
} from '../../utils/validators';
import type { Order, MenuItem } from '../../types/models';
import type { Cart, CartItem } from '../../types/ui';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a valid Order object matching OrderSchema constraints.
 */
const orderArbitrary: fc.Arbitrary<Order> = fc.record({
  id: fc.uuid(),
  restaurant_id: fc.uuid(),
  table_id: fc.uuid(),
  status: fc.constantFrom(
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'paying',
    'paid',
    'cancelled'
  ) as fc.Arbitrary<Order['status']>,
  total: fc.nat(),
  client_name: fc.string(),
  notes: fc.string(),
  created_at: fc.date().map((d) => d.toISOString()),
  updated_at: fc.date().map((d) => d.toISOString()),
});

/**
 * Generates a valid MenuItem object matching MenuItemSchema constraints.
 * name must be non-empty (minLength: 1).
 */
const menuItemArbitrary: fc.Arbitrary<MenuItem> = fc.record({
  id: fc.uuid(),
  restaurant_id: fc.uuid(),
  name: fc.string({ minLength: 1 }),
  description: fc.string(),
  price: fc.nat(),
  category: fc.string(),
  tags: fc.array(fc.string()),
  available: fc.boolean(),
  // ingredients is optional — omit it to keep the arbitrary simple
});

/**
 * Generates a valid CartItem object (menu_item + quantity + notes).
 */
const cartItemArbitrary: fc.Arbitrary<CartItem> = fc.record({
  menu_item: menuItemArbitrary,
  quantity: fc.integer({ min: 1 }),
  notes: fc.string(),
});

/**
 * Generates a valid Cart object matching CartSchema constraints.
 */
const cartArbitrary: fc.Arbitrary<Cart> = fc.record({
  restaurant_id: fc.string(),
  table_id: fc.string(),
  items: fc.array(cartItemArbitrary),
});

// ---------------------------------------------------------------------------
// Helper: serialize → parse round-trip
// ---------------------------------------------------------------------------

function roundTrip<T>(obj: T): unknown {
  return JSON.parse(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// Tests: Order
// ---------------------------------------------------------------------------

describe('Serialization round-trip — Order', () => {
  /**
   * **Validates: Requirements 21.7**
   *
   * Property: parse(serialize(order)) produces an equivalent object (deep equal).
   */
  it('round-tripped Order is deep-equal to the original', () => {
    fc.assert(
      fc.property(orderArbitrary, (order) => {
        const parsed = roundTrip(order);
        expect(parsed).toEqual(order);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 21.7**
   *
   * Property: round-tripped Order passes Zod schema validation.
   */
  it('round-tripped Order passes Zod schema validation', () => {
    fc.assert(
      fc.property(orderArbitrary, (order) => {
        const parsed = roundTrip(order);
        const result = OrderSchema.safeParse(parsed);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 21.7**
   *
   * Property: all string fields remain strings after round-trip.
   */
  it('all Order string fields remain strings after round-trip', () => {
    fc.assert(
      fc.property(orderArbitrary, (order) => {
        const parsed = roundTrip(order) as Record<string, unknown>;
        const stringFields: (keyof Order)[] = [
          'id',
          'restaurant_id',
          'table_id',
          'status',
          'client_name',
          'notes',
          'created_at',
          'updated_at',
        ];
        for (const field of stringFields) {
          expect(typeof parsed[field]).toBe('string');
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 21.7**
   *
   * Property: all number fields remain numbers after round-trip.
   */
  it('all Order number fields remain numbers after round-trip', () => {
    fc.assert(
      fc.property(orderArbitrary, (order) => {
        const parsed = roundTrip(order) as Record<string, unknown>;
        const numberFields: (keyof Order)[] = ['total'];
        for (const field of numberFields) {
          expect(typeof parsed[field]).toBe('number');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: MenuItem
// ---------------------------------------------------------------------------

describe('Serialization round-trip — MenuItem', () => {
  /**
   * **Validates: Requirements 21.7**
   *
   * Property: parse(serialize(menuItem)) produces an equivalent object (deep equal).
   */
  it('round-tripped MenuItem is deep-equal to the original', () => {
    fc.assert(
      fc.property(menuItemArbitrary, (item) => {
        const parsed = roundTrip(item);
        expect(parsed).toEqual(item);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 21.7**
   *
   * Property: round-tripped MenuItem passes Zod schema validation.
   */
  it('round-tripped MenuItem passes Zod schema validation', () => {
    fc.assert(
      fc.property(menuItemArbitrary, (item) => {
        const parsed = roundTrip(item);
        const result = MenuItemSchema.safeParse(parsed);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 21.7**
   *
   * Property: all string fields remain strings after round-trip.
   */
  it('all MenuItem string fields remain strings after round-trip', () => {
    fc.assert(
      fc.property(menuItemArbitrary, (item) => {
        const parsed = roundTrip(item) as Record<string, unknown>;
        const stringFields: (keyof MenuItem)[] = [
          'id',
          'restaurant_id',
          'name',
          'description',
          'category',
        ];
        for (const field of stringFields) {
          expect(typeof parsed[field]).toBe('string');
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 21.7**
   *
   * Property: all number fields remain numbers after round-trip.
   */
  it('all MenuItem number fields remain numbers after round-trip', () => {
    fc.assert(
      fc.property(menuItemArbitrary, (item) => {
        const parsed = roundTrip(item) as Record<string, unknown>;
        const numberFields: (keyof MenuItem)[] = ['price'];
        for (const field of numberFields) {
          expect(typeof parsed[field]).toBe('number');
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 21.7**
   *
   * Property: tags array remains an array of strings after round-trip.
   */
  it('MenuItem tags remain an array of strings after round-trip', () => {
    fc.assert(
      fc.property(menuItemArbitrary, (item) => {
        const parsed = roundTrip(item) as Record<string, unknown>;
        expect(Array.isArray(parsed['tags'])).toBe(true);
        const tags = parsed['tags'] as unknown[];
        for (const tag of tags) {
          expect(typeof tag).toBe('string');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: Cart
// ---------------------------------------------------------------------------

describe('Serialization round-trip — Cart', () => {
  /**
   * **Validates: Requirements 21.7**
   *
   * Property: parse(serialize(cart)) produces an equivalent object (deep equal).
   */
  it('round-tripped Cart is deep-equal to the original', () => {
    fc.assert(
      fc.property(cartArbitrary, (cart) => {
        const parsed = roundTrip(cart);
        expect(parsed).toEqual(cart);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 21.7**
   *
   * Property: round-tripped Cart passes Zod schema validation.
   */
  it('round-tripped Cart passes Zod schema validation', () => {
    fc.assert(
      fc.property(cartArbitrary, (cart) => {
        const parsed = roundTrip(cart);
        const result = CartSchema.safeParse(parsed);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 21.7**
   *
   * Property: all Cart string fields remain strings after round-trip.
   */
  it('all Cart string fields remain strings after round-trip', () => {
    fc.assert(
      fc.property(cartArbitrary, (cart) => {
        const parsed = roundTrip(cart) as Record<string, unknown>;
        const stringFields: (keyof Cart)[] = ['restaurant_id', 'table_id'];
        for (const field of stringFields) {
          expect(typeof parsed[field]).toBe('string');
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 21.7**
   *
   * Property: Cart items array is preserved after round-trip — same length and
   * each CartItem has the correct types for quantity (number) and notes (string).
   */
  it('Cart items array is preserved with correct types after round-trip', () => {
    fc.assert(
      fc.property(cartArbitrary, (cart) => {
        const parsed = roundTrip(cart) as Record<string, unknown>;
        const items = parsed['items'] as Array<Record<string, unknown>>;
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(cart.items.length);
        for (const item of items) {
          expect(typeof item['quantity']).toBe('number');
          expect(typeof item['notes']).toBe('string');
          expect(typeof item['menu_item']).toBe('object');
          expect(item['menu_item']).not.toBeNull();
        }
      }),
      { numRuns: 100 }
    );
  });
});
