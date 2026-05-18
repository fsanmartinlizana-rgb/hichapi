/**
 * Property-Based Tests: Kanban order filtering
 *
 * **Validates: Requirements 10.4**
 *
 * Properties verified:
 * 1. For any list of orders with mixed statuses, filterOrdersForKanban never
 *    returns an order with status 'cancelled'.
 * 2. For any list of orders, the count of non-cancelled orders equals the
 *    length of filterOrdersForKanban(orders).
 *
 * Uses fast-check for property generation.
 */

import * as fc from 'fast-check';
import { filterOrdersForKanban } from '../../utils/kanbanUtils';
import type { Order, OrderStatus } from '../../types/models';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const ALL_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'paying',
  'paid',
  'cancelled',
];

/** Generates any valid OrderStatus. */
const anyStatus: fc.Arbitrary<OrderStatus> = fc.constantFrom(...ALL_STATUSES);

/** Generates a minimal Order object with an arbitrary status. */
const anyOrder: fc.Arbitrary<Order> = fc.record({
  id: fc.uuid(),
  restaurant_id: fc.uuid(),
  table_id: fc.uuid(),
  status: anyStatus,
  total: fc.integer({ min: 0, max: 1_000_000 }),
  client_name: fc.string({ minLength: 1, maxLength: 50 }),
  notes: fc.string({ maxLength: 100 }),
  created_at: fc.constant('2025-01-15T12:00:00Z'),
  updated_at: fc.constant('2025-01-15T12:00:00Z'),
});

/** Generates an array of 0–20 orders with arbitrary statuses. */
const anyOrderList: fc.Arbitrary<Order[]> = fc.array(anyOrder, {
  minLength: 0,
  maxLength: 20,
});

// ---------------------------------------------------------------------------
// Property 1: filterOrdersForKanban never contains a cancelled order
// ---------------------------------------------------------------------------

describe('Property: filterOrdersForKanban never contains a cancelled order', () => {
  /**
   * **Validates: Requirements 10.4**
   *
   * For any array of orders with arbitrary statuses,
   * filterOrdersForKanban(orders) must not contain any order whose
   * status is 'cancelled'.
   */
  it('result contains no cancelled orders for any input', () => {
    fc.assert(
      fc.property(anyOrderList, (orders) => {
        const result = filterOrdersForKanban(orders);
        const hasCancelled = result.some((o) => o.status === 'cancelled');
        expect(hasCancelled).toBe(false);
      }),
      { numRuns: 500 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: count of non-cancelled orders equals length of filtered result
// ---------------------------------------------------------------------------

describe('Property: non-cancelled count equals filtered result length', () => {
  /**
   * **Validates: Requirements 10.4**
   *
   * For any array of orders, the number of orders whose status is NOT
   * 'cancelled' must equal the length of filterOrdersForKanban(orders).
   */
  it('filtered length equals count of non-cancelled orders in input', () => {
    fc.assert(
      fc.property(anyOrderList, (orders) => {
        const nonCancelledCount = orders.filter(
          (o) => o.status !== 'cancelled'
        ).length;
        const result = filterOrdersForKanban(orders);
        expect(result.length).toBe(nonCancelledCount);
      }),
      { numRuns: 500 }
    );
  });
});
