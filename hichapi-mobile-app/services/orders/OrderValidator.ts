/**
 * Validator for order status transitions.
 * Uses the VALID_TRANSITIONS map from constants to enforce the order lifecycle.
 */

import { VALID_TRANSITIONS } from '../../utils/constants';
import type { OrderStatus } from '../../types/models';

export class OrderValidator {
  /**
   * Returns true if transitioning from `from` to `to` is a valid status change.
   * Uses the VALID_TRANSITIONS map from constants.ts.
   *
   * @param from - The current order status.
   * @param to   - The desired next status.
   * @returns `true` if the transition is allowed, `false` otherwise.
   */
  static isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
    const allowedNext = VALID_TRANSITIONS[from];
    return allowedNext.includes(to);
  }

  /**
   * Returns the next valid status for a given current status.
   * Returns null if the status is terminal (paid or cancelled).
   *
   * For non-terminal statuses the "primary" next step is the first entry in
   * VALID_TRANSITIONS (i.e. the forward progression, not cancellation).
   *
   * @param current - The current order status.
   * @returns The primary next status, or `null` if the status is terminal.
   */
  static getNextStatus(current: OrderStatus): OrderStatus | null {
    if (OrderValidator.isTerminal(current)) {
      return null;
    }

    const transitions = VALID_TRANSITIONS[current];
    if (!transitions) return null;
    
    // The first entry is always the forward progression step
    return transitions.length > 0 ? transitions[0] : null;
  }

  /**
   * Returns true if the order status is terminal (no further transitions allowed).
   *
   * @param status - The order status to check.
   * @returns `true` if the status is terminal (`paid` or `cancelled`).
   */
  static isTerminal(status: OrderStatus): boolean {
    const transitions = VALID_TRANSITIONS[status];
    return !transitions || transitions.length === 0;
  }
}
