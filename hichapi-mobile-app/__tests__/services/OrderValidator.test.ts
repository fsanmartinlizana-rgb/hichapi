/**
 * Unit Tests: OrderValidator
 *
 * Tests isValidTransition, isTerminal, and getNextStatus covering all
 * valid and invalid transitions defined in VALID_TRANSITIONS.
 */

import { OrderValidator } from '../../services/orders/OrderValidator';
import type { OrderStatus } from '../../types/models';

// ---------------------------------------------------------------------------
// isValidTransition — valid transitions
// ---------------------------------------------------------------------------

describe('OrderValidator.isValidTransition() — valid transitions', () => {
  const validCases: [OrderStatus, OrderStatus][] = [
    ['pending', 'confirmed'],
    ['pending', 'cancelled'],
    ['confirmed', 'preparing'],
    ['confirmed', 'cancelled'],
    ['preparing', 'ready'],
    ['preparing', 'cancelled'],
    ['ready', 'paying'],
    ['ready', 'cancelled'],
    ['paying', 'paid'],
    ['paying', 'cancelled'],
  ];

  it.each(validCases)(
    '%s → %s should be valid',
    (from, to) => {
      expect(OrderValidator.isValidTransition(from, to)).toBe(true);
    }
  );
});

// ---------------------------------------------------------------------------
// isValidTransition — invalid transitions
// ---------------------------------------------------------------------------

describe('OrderValidator.isValidTransition() — invalid transitions', () => {
  const invalidCases: [OrderStatus, OrderStatus][] = [
    // Skipping steps forward
    ['pending', 'preparing'],
    ['pending', 'ready'],
    ['pending', 'paying'],
    ['pending', 'paid'],
    // Going backwards
    ['confirmed', 'pending'],
    ['confirmed', 'ready'],
    ['preparing', 'pending'],
    ['preparing', 'confirmed'],
    ['ready', 'pending'],
    ['ready', 'confirmed'],
  ];

  it.each(invalidCases)(
    '%s → %s should be invalid',
    (from, to) => {
      expect(OrderValidator.isValidTransition(from, to)).toBe(false);
    }
  );

  // Terminal statuses — paid
  const allStatuses: OrderStatus[] = [
    'pending', 'confirmed', 'preparing', 'ready', 'paying', 'paid', 'cancelled',
  ];

  it.each(allStatuses)(
    'paid → %s should be invalid (paid is terminal)',
    (to) => {
      expect(OrderValidator.isValidTransition('paid', to)).toBe(false);
    }
  );

  it.each(allStatuses)(
    'cancelled → %s should be invalid (cancelled is terminal)',
    (to) => {
      expect(OrderValidator.isValidTransition('cancelled', to)).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------
// isTerminal
// ---------------------------------------------------------------------------

describe('OrderValidator.isTerminal()', () => {
  it('returns true for paid', () => {
    expect(OrderValidator.isTerminal('paid')).toBe(true);
  });

  it('returns true for cancelled', () => {
    expect(OrderValidator.isTerminal('cancelled')).toBe(true);
  });

  const nonTerminalStatuses: OrderStatus[] = [
    'pending', 'confirmed', 'preparing', 'ready', 'paying',
  ];

  it.each(nonTerminalStatuses)(
    'returns false for %s',
    (status) => {
      expect(OrderValidator.isTerminal(status)).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------
// getNextStatus
// ---------------------------------------------------------------------------

describe('OrderValidator.getNextStatus()', () => {
  const progressionCases: [OrderStatus, OrderStatus][] = [
    ['pending', 'confirmed'],
    ['confirmed', 'preparing'],
    ['preparing', 'ready'],
    ['ready', 'paying'],
    ['paying', 'paid'],
  ];

  it.each(progressionCases)(
    'getNextStatus(%s) returns %s',
    (current, expected) => {
      expect(OrderValidator.getNextStatus(current)).toBe(expected);
    }
  );

  it('returns null for paid (terminal)', () => {
    expect(OrderValidator.getNextStatus('paid')).toBeNull();
  });

  it('returns null for cancelled (terminal)', () => {
    expect(OrderValidator.getNextStatus('cancelled')).toBeNull();
  });
});
