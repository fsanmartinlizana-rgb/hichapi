/**
 * Type guard functions for HiChapi Mobile App domain models.
 * These pure functions provide runtime type checking for data received
 * from the API, AsyncStorage, or other external sources.
 */

import type { Order, OrderStatus } from './models';
import type { Cart } from './ui';

/**
 * The set of all valid OrderStatus values.
 */
const VALID_ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'paying',
  'paid',
  'cancelled',
] as const;

/**
 * Type guard that checks whether a value is a valid `OrderStatus`.
 *
 * @param value - The value to check
 * @returns `true` if `value` is one of the 7 valid order statuses
 *
 * @example
 * isOrderStatus('pending')   // true
 * isOrderStatus('PENDING')   // false
 * isOrderStatus(null)        // false
 */
export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (VALID_ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Type guard that checks whether an unknown value is a valid `Order` object.
 * Validates that all required fields exist and have the correct types.
 *
 * Required fields: `id`, `restaurant_id`, `table_id`, `status`, `total`
 *
 * @param obj - The value to check
 * @returns `true` if `obj` satisfies the `Order` interface's required fields
 *
 * @example
 * isValidOrder({ id: 'abc', restaurant_id: 'r1', table_id: 't1', status: 'pending', total: 5000, ... }) // true
 * isValidOrder({ id: 'abc' })  // false — missing required fields
 * isValidOrder(null)           // false
 */
export function isValidOrder(obj: unknown): obj is Order {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return false;
  }

  const record = obj as Record<string, unknown>;

  // Check required string fields
  if (typeof record['id'] !== 'string') return false;
  if (typeof record['restaurant_id'] !== 'string') return false;
  if (typeof record['table_id'] !== 'string') return false;
  if (typeof record['total'] !== 'number') return false;

  // Status must be a valid OrderStatus
  if (!isOrderStatus(record['status'])) return false;

  return true;
}

/**
 * Type guard that checks whether an unknown value is a valid `Cart` object.
 * Validates that `restaurant_id`, `table_id`, and `items` (as an array) are present.
 *
 * @param obj - The value to check
 * @returns `true` if `obj` satisfies the `Cart` interface's required fields
 *
 * @example
 * isValidCart({ restaurant_id: 'r1', table_id: 't1', items: [] })  // true
 * isValidCart({ restaurant_id: 'r1', table_id: 't1' })             // false — missing items
 * isValidCart(null)                                                  // false
 */
export function isValidCart(obj: unknown): obj is Cart {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return false;
  }

  const record = obj as Record<string, unknown>;

  if (typeof record['restaurant_id'] !== 'string') return false;
  if (typeof record['table_id'] !== 'string') return false;
  if (!Array.isArray(record['items'])) return false;

  return true;
}
