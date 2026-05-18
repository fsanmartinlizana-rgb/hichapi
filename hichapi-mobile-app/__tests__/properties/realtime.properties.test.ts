/**
 * Property-Based Tests: Realtime Update Idempotence
 *
 * **Validates: Requirements 7.8**
 *
 * Property: receiving the same realtime update twice produces the same UI state
 * as receiving it once.
 *
 * Formally: applyRealtimeUpdate(applyRealtimeUpdate(state, payload), payload)
 *           === applyRealtimeUpdate(state, payload)
 *
 * This is tested for all three event types: INSERT, UPDATE, and DELETE.
 *
 * Uses fast-check to generate arbitrary Order objects and payloads.
 */

import * as fc from 'fast-check';
import { applyRealtimeUpdate } from '../../utils/realtimeReducer';
import type { Order, OrderStatus } from '../../types/models';
import type { RealtimePayload } from '../../services/realtime/RealtimeService';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a valid OrderStatus value. */
const orderStatusArbitrary: fc.Arbitrary<OrderStatus> = fc.constantFrom(
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'paying',
  'paid',
  'cancelled'
);

/** Generates a valid Order object. */
const orderArbitrary: fc.Arbitrary<Order> = fc.record({
  id: fc.uuid(),
  restaurant_id: fc.uuid(),
  table_id: fc.uuid(),
  status: orderStatusArbitrary,
  total: fc.nat(),
  client_name: fc.string(),
  notes: fc.string(),
  created_at: fc.date().map((d) => d.toISOString()),
  updated_at: fc.date().map((d) => d.toISOString()),
});

/** Generates an array of 0–10 distinct orders. */
const orderArrayArbitrary: fc.Arbitrary<Order[]> = fc
  .array(orderArbitrary, { minLength: 0, maxLength: 10 })
  .map((orders) => {
    // Deduplicate by id to keep the state consistent
    const seen = new Set<string>();
    return orders.filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
  });

/** Generates an INSERT payload for a given order. */
function insertPayload(order: Order): RealtimePayload<Order> {
  return { eventType: 'INSERT', new: order, old: {} };
}

/** Generates an UPDATE payload for a given order. */
function updatePayload(order: Order): RealtimePayload<Order> {
  return { eventType: 'UPDATE', new: order, old: { id: order.id } };
}

/** Generates a DELETE payload for a given order. */
function deletePayload(order: Order): RealtimePayload<Order> {
  return { eventType: 'DELETE', new: {} as Order, old: { id: order.id } };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Deep-equality check using JSON serialization (sufficient for plain objects).
 */
function deepEqual(a: Order[], b: Order[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// Property: INSERT idempotence
// ---------------------------------------------------------------------------

describe('Realtime idempotence — INSERT', () => {
  /**
   * **Validates: Requirements 7.8**
   *
   * Applying the same INSERT payload twice must produce the same state as
   * applying it once.
   */
  it('applying the same INSERT twice equals applying it once', () => {
    fc.assert(
      fc.property(orderArrayArbitrary, orderArbitrary, (state, order) => {
        const payload = insertPayload(order);

        const once = applyRealtimeUpdate(state, payload);
        const twice = applyRealtimeUpdate(once, payload);

        expect(deepEqual(once, twice)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.8**
   *
   * After an INSERT the order must appear exactly once in the resulting state.
   */
  it('after INSERT the order appears exactly once', () => {
    fc.assert(
      fc.property(orderArrayArbitrary, orderArbitrary, (state, order) => {
        // Remove the order from state to guarantee a clean INSERT scenario
        const cleanState = state.filter((o) => o.id !== order.id);
        const payload = insertPayload(order);

        const result = applyRealtimeUpdate(cleanState, payload);
        const count = result.filter((o) => o.id === order.id).length;

        expect(count).toBe(1);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property: UPDATE idempotence
// ---------------------------------------------------------------------------

describe('Realtime idempotence — UPDATE', () => {
  /**
   * **Validates: Requirements 7.8**
   *
   * Applying the same UPDATE payload twice must produce the same state as
   * applying it once.
   */
  it('applying the same UPDATE twice equals applying it once', () => {
    fc.assert(
      fc.property(orderArrayArbitrary, orderArbitrary, (state, order) => {
        const payload = updatePayload(order);

        const once = applyRealtimeUpdate(state, payload);
        const twice = applyRealtimeUpdate(once, payload);

        expect(deepEqual(once, twice)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.8**
   *
   * After an UPDATE the order must appear exactly once in the resulting state.
   */
  it('after UPDATE the order appears exactly once', () => {
    fc.assert(
      fc.property(orderArrayArbitrary, orderArbitrary, (state, order) => {
        const payload = updatePayload(order);

        const result = applyRealtimeUpdate(state, payload);
        const count = result.filter((o) => o.id === order.id).length;

        expect(count).toBe(1);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.8**
   *
   * After an UPDATE the order in the state must equal the payload's `new` value.
   */
  it('after UPDATE the stored order matches the payload new value', () => {
    fc.assert(
      fc.property(orderArrayArbitrary, orderArbitrary, (state, order) => {
        const payload = updatePayload(order);

        const result = applyRealtimeUpdate(state, payload);
        const stored = result.find((o) => o.id === order.id);

        expect(stored).toEqual(order);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property: DELETE idempotence
// ---------------------------------------------------------------------------

describe('Realtime idempotence — DELETE', () => {
  /**
   * **Validates: Requirements 7.8**
   *
   * Applying the same DELETE payload twice must produce the same state as
   * applying it once.
   */
  it('applying the same DELETE twice equals applying it once', () => {
    fc.assert(
      fc.property(orderArrayArbitrary, orderArbitrary, (state, order) => {
        const payload = deletePayload(order);

        const once = applyRealtimeUpdate(state, payload);
        const twice = applyRealtimeUpdate(once, payload);

        expect(deepEqual(once, twice)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.8**
   *
   * After a DELETE the order must not appear in the resulting state.
   */
  it('after DELETE the order is absent from the state', () => {
    fc.assert(
      fc.property(orderArrayArbitrary, orderArbitrary, (state, order) => {
        const payload = deletePayload(order);

        const result = applyRealtimeUpdate(state, payload);
        const found = result.some((o) => o.id === order.id);

        expect(found).toBe(false);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property: state length invariants
// ---------------------------------------------------------------------------

describe('Realtime state length invariants', () => {
  /**
   * **Validates: Requirements 7.8**
   *
   * INSERT on a state that does not contain the order increases length by 1.
   */
  it('INSERT on absent order increases state length by 1', () => {
    fc.assert(
      fc.property(orderArrayArbitrary, orderArbitrary, (state, order) => {
        const cleanState = state.filter((o) => o.id !== order.id);
        const payload = insertPayload(order);

        const result = applyRealtimeUpdate(cleanState, payload);

        expect(result.length).toBe(cleanState.length + 1);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.8**
   *
   * DELETE on a state that contains the order decreases length by 1.
   */
  it('DELETE on present order decreases state length by 1', () => {
    fc.assert(
      fc.property(orderArrayArbitrary, orderArbitrary, (state, order) => {
        // Ensure the order is in the state
        const stateWithOrder = [
          ...state.filter((o) => o.id !== order.id),
          order,
        ];
        const payload = deletePayload(order);

        const result = applyRealtimeUpdate(stateWithOrder, payload);

        expect(result.length).toBe(stateWithOrder.length - 1);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 7.8**
   *
   * UPDATE on a state that already contains the order does not change length.
   */
  it('UPDATE on present order does not change state length', () => {
    fc.assert(
      fc.property(orderArrayArbitrary, orderArbitrary, (state, order) => {
        const stateWithOrder = [
          ...state.filter((o) => o.id !== order.id),
          order,
        ];
        const updatedOrder: Order = { ...order, status: 'confirmed' };
        const payload = updatePayload(updatedOrder);

        const result = applyRealtimeUpdate(stateWithOrder, payload);

        expect(result.length).toBe(stateWithOrder.length);
      }),
      { numRuns: 200 }
    );
  });
});
