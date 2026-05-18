/**
 * Property-Based Tests: Order Status Transitions
 *
 * **Validates: Requirements 8.2**
 *
 * Properties verified:
 * 1. Order status can only follow valid sequence — any status NOT in
 *    VALID_TRANSITIONS[from] must be rejected by isValidTransition.
 * 2. Cancelled orders cannot transition to any other status.
 * 3. Paid orders cannot transition to any other status.
 * 4. All valid transitions in VALID_TRANSITIONS map return true.
 *
 * Uses fast-check with fc.constantFrom for OrderStatus generation.
 */

import * as fc from 'fast-check';
import { OrderValidator } from '../../services/orders/OrderValidator';
import { VALID_TRANSITIONS } from '../../utils/constants';
import type { OrderStatus } from '../../types/models';

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

// ---------------------------------------------------------------------------
// Property 1: order status can only follow valid sequence
// ---------------------------------------------------------------------------

describe('Property: order status can only follow valid sequence', () => {
  /**
   * **Validates: Requirements 8.2**
   *
   * For any status `from`, any status `to` that is NOT in
   * VALID_TRANSITIONS[from] must be rejected by isValidTransition.
   */
  it('isValidTransition returns false for any status not in VALID_TRANSITIONS[from]', () => {
    fc.assert(
      fc.property(anyStatus, (from) => {
        const validNext = new Set<OrderStatus>(VALID_TRANSITIONS[from]);
        const invalidTargets = ALL_STATUSES.filter((s) => !validNext.has(s));

        for (const invalidTo of invalidTargets) {
          expect(OrderValidator.isValidTransition(from, invalidTo)).toBe(false);
        }
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: cancelled orders cannot transition to any other status
// ---------------------------------------------------------------------------

describe('Property: cancelled orders cannot transition to any other status', () => {
  /**
   * **Validates: Requirements 8.2**
   *
   * For any OrderStatus `to`, isValidTransition('cancelled', to) must be false.
   */
  it('isValidTransition("cancelled", to) is always false', () => {
    fc.assert(
      fc.property(anyStatus, (to) => {
        expect(OrderValidator.isValidTransition('cancelled', to)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: paid orders cannot transition to any other status
// ---------------------------------------------------------------------------

describe('Property: paid orders cannot transition to any other status', () => {
  /**
   * **Validates: Requirements 8.2**
   *
   * For any OrderStatus `to`, isValidTransition('paid', to) must be false.
   */
  it('isValidTransition("paid", to) is always false', () => {
    fc.assert(
      fc.property(anyStatus, (to) => {
        expect(OrderValidator.isValidTransition('paid', to)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: all valid transitions in VALID_TRANSITIONS map return true
// ---------------------------------------------------------------------------

describe('Property: all valid transitions in VALID_TRANSITIONS map return true', () => {
  /**
   * **Validates: Requirements 8.2**
   *
   * For each entry in VALID_TRANSITIONS, for each valid next status,
   * isValidTransition(from, to) must return true.
   */
  it('isValidTransition returns true for every entry in VALID_TRANSITIONS', () => {
    const entries = Object.entries(VALID_TRANSITIONS) as [
      OrderStatus,
      OrderStatus[],
    ][];

    // Build a flat list of all (from, to) valid pairs
    const validPairs: [OrderStatus, OrderStatus][] = entries.flatMap(
      ([from, tos]) => tos.map((to): [OrderStatus, OrderStatus] => [from, to])
    );

    // Only run the property if there are valid pairs to test
    if (validPairs.length === 0) return;

    fc.assert(
      fc.property(fc.constantFrom(...validPairs), ([from, to]) => {
        expect(OrderValidator.isValidTransition(from, to)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });
});
