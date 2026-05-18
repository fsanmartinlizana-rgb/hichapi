/**
 * Unit tests for type guard functions defined in `types/guards.ts`.
 *
 * These tests verify that the runtime type guards correctly identify
 * valid and invalid instances of the core domain models.
 */

import { isOrderStatus, isValidOrder, isValidCart } from '../../types/guards';
import type { Order } from '../../types/models';
import type { Cart, CartItem } from '../../types/ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal valid Order object for use in tests. */
function buildValidOrder(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'order-uuid-1',
    restaurant_id: 'restaurant-uuid-1',
    table_id: 'table-uuid-1',
    status: 'pending',
    total: 15000,
    client_name: 'Juan Pérez',
    notes: '',
    created_at: '2025-01-01T12:00:00Z',
    updated_at: '2025-01-01T12:00:00Z',
    ...overrides,
  };
}

/** Builds a minimal valid Cart object for use in tests. */
function buildValidCart(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    restaurant_id: 'restaurant-uuid-1',
    table_id: 'table-uuid-1',
    items: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isOrderStatus
// ---------------------------------------------------------------------------

describe('isOrderStatus', () => {
  describe('returns true for all 7 valid statuses', () => {
    const validStatuses = [
      'pending',
      'confirmed',
      'preparing',
      'ready',
      'paying',
      'paid',
      'cancelled',
    ] as const;

    validStatuses.forEach((status) => {
      it(`returns true for '${status}'`, () => {
        expect(isOrderStatus(status)).toBe(true);
      });
    });
  });

  describe('returns false for invalid values', () => {
    it("returns false for 'unknown'", () => {
      expect(isOrderStatus('unknown')).toBe(false);
    });

    it("returns false for 'PENDING' (uppercase)", () => {
      expect(isOrderStatus('PENDING')).toBe(false);
    });

    it("returns false for empty string ''", () => {
      expect(isOrderStatus('')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isOrderStatus(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isOrderStatus(undefined)).toBe(false);
    });

    it('returns false for a number (123)', () => {
      expect(isOrderStatus(123)).toBe(false);
    });

    it("returns false for 'Pending' (mixed case)", () => {
      expect(isOrderStatus('Pending')).toBe(false);
    });

    it('returns false for an object', () => {
      expect(isOrderStatus({ status: 'pending' })).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// isValidOrder
// ---------------------------------------------------------------------------

describe('isValidOrder', () => {
  describe('returns true for valid Order objects', () => {
    it('returns true for a complete valid Order', () => {
      const order = buildValidOrder();
      expect(isValidOrder(order)).toBe(true);
    });

    it('returns true for an Order with all optional fields present', () => {
      const order = buildValidOrder({
        status: 'confirmed',
        total: 0,
        client_name: 'María',
        notes: 'Sin sal',
      });
      expect(isValidOrder(order)).toBe(true);
    });

    it('returns true for each valid OrderStatus value', () => {
      const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'paying', 'paid', 'cancelled'];
      statuses.forEach((status) => {
        expect(isValidOrder(buildValidOrder({ status }))).toBe(true);
      });
    });
  });

  describe('returns false when required fields are missing', () => {
    it("returns false when 'id' is missing", () => {
      const { id, ...order } = buildValidOrder() as { id: string } & Record<string, unknown>;
      expect(isValidOrder(order)).toBe(false);
    });

    it("returns false when 'restaurant_id' is missing", () => {
      const { restaurant_id, ...order } = buildValidOrder() as { restaurant_id: string } & Record<string, unknown>;
      expect(isValidOrder(order)).toBe(false);
    });

    it("returns false when 'table_id' is missing", () => {
      const { table_id, ...order } = buildValidOrder() as { table_id: string } & Record<string, unknown>;
      expect(isValidOrder(order)).toBe(false);
    });

    it("returns false when 'status' is missing", () => {
      const { status, ...order } = buildValidOrder() as { status: string } & Record<string, unknown>;
      expect(isValidOrder(order)).toBe(false);
    });

    it("returns false when 'total' is missing", () => {
      const { total, ...order } = buildValidOrder() as { total: number } & Record<string, unknown>;
      expect(isValidOrder(order)).toBe(false);
    });
  });

  describe('returns false when fields have wrong types', () => {
    it("returns false when 'id' is a number instead of string", () => {
      expect(isValidOrder(buildValidOrder({ id: 42 }))).toBe(false);
    });

    it("returns false when 'restaurant_id' is null", () => {
      expect(isValidOrder(buildValidOrder({ restaurant_id: null }))).toBe(false);
    });

    it("returns false when 'table_id' is an object", () => {
      expect(isValidOrder(buildValidOrder({ table_id: {} }))).toBe(false);
    });

    it("returns false when 'total' is a string", () => {
      expect(isValidOrder(buildValidOrder({ total: '15000' }))).toBe(false);
    });
  });

  describe('returns false when status is not a valid OrderStatus', () => {
    it("returns false for status 'unknown'", () => {
      expect(isValidOrder(buildValidOrder({ status: 'unknown' }))).toBe(false);
    });

    it("returns false for status 'PENDING' (uppercase)", () => {
      expect(isValidOrder(buildValidOrder({ status: 'PENDING' }))).toBe(false);
    });

    it("returns false for status '' (empty string)", () => {
      expect(isValidOrder(buildValidOrder({ status: '' }))).toBe(false);
    });

    it('returns false for numeric status', () => {
      expect(isValidOrder(buildValidOrder({ status: 1 }))).toBe(false);
    });
  });

  describe('returns false for null/undefined/primitives', () => {
    it('returns false for null', () => {
      expect(isValidOrder(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isValidOrder(undefined)).toBe(false);
    });

    it('returns false for a string', () => {
      expect(isValidOrder('order')).toBe(false);
    });

    it('returns false for a number', () => {
      expect(isValidOrder(42)).toBe(false);
    });

    it('returns false for an empty object', () => {
      expect(isValidOrder({})).toBe(false);
    });

    it('returns false for an array', () => {
      expect(isValidOrder([])).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// isValidCart
// ---------------------------------------------------------------------------

describe('isValidCart', () => {
  describe('returns true for valid Cart objects', () => {
    it('returns true for a valid Cart with empty items array', () => {
      const cart = buildValidCart();
      expect(isValidCart(cart)).toBe(true);
    });

    it('returns true for a valid Cart with items', () => {
      const cartItem: CartItem = {
        menu_item: {
          id: 'item-1',
          restaurant_id: 'restaurant-uuid-1',
          name: 'Empanada',
          description: 'Empanada de pino',
          price: 2500,
          category: 'Entradas',
          tags: ['tradicional'],
          available: true,
        },
        quantity: 2,
        notes: 'Sin ají',
      };

      const cart = buildValidCart({ items: [cartItem] });
      expect(isValidCart(cart)).toBe(true);
    });

    it('returns true for a Cart with multiple items', () => {
      const cart = buildValidCart({
        items: [
          { menu_item: { id: 'a', price: 1000 }, quantity: 1, notes: '' },
          { menu_item: { id: 'b', price: 2000 }, quantity: 3, notes: 'extra' },
        ],
      });
      expect(isValidCart(cart)).toBe(true);
    });
  });

  describe('returns false when required fields are missing', () => {
    it("returns false when 'restaurant_id' is missing", () => {
      const { restaurant_id, ...cart } = buildValidCart() as { restaurant_id: string } & Record<string, unknown>;
      expect(isValidCart(cart)).toBe(false);
    });

    it("returns false when 'table_id' is missing", () => {
      const { table_id, ...cart } = buildValidCart() as { table_id: string } & Record<string, unknown>;
      expect(isValidCart(cart)).toBe(false);
    });

    it("returns false when 'items' is missing", () => {
      const { items, ...cart } = buildValidCart() as { items: unknown[] } & Record<string, unknown>;
      expect(isValidCart(cart)).toBe(false);
    });
  });

  describe('returns false when items is not an array', () => {
    it("returns false when 'items' is null", () => {
      expect(isValidCart(buildValidCart({ items: null }))).toBe(false);
    });

    it("returns false when 'items' is a string", () => {
      expect(isValidCart(buildValidCart({ items: 'item1,item2' }))).toBe(false);
    });

    it("returns false when 'items' is an object (not array)", () => {
      expect(isValidCart(buildValidCart({ items: { 0: 'item' } }))).toBe(false);
    });

    it("returns false when 'items' is a number", () => {
      expect(isValidCart(buildValidCart({ items: 3 }))).toBe(false);
    });
  });

  describe('returns false when restaurant_id or table_id have wrong types', () => {
    it("returns false when 'restaurant_id' is a number", () => {
      expect(isValidCart(buildValidCart({ restaurant_id: 123 }))).toBe(false);
    });

    it("returns false when 'table_id' is null", () => {
      expect(isValidCart(buildValidCart({ table_id: null }))).toBe(false);
    });

    it("returns false when 'restaurant_id' is undefined", () => {
      expect(isValidCart(buildValidCart({ restaurant_id: undefined }))).toBe(false);
    });
  });

  describe('returns false for null/undefined/primitives', () => {
    it('returns false for null', () => {
      expect(isValidCart(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isValidCart(undefined)).toBe(false);
    });

    it('returns false for a string', () => {
      expect(isValidCart('cart')).toBe(false);
    });

    it('returns false for an empty object', () => {
      expect(isValidCart({})).toBe(false);
    });

    it('returns false for an array', () => {
      expect(isValidCart([])).toBe(false);
    });
  });
});
