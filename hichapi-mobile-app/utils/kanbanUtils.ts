/**
 * Utility functions for the Kanban board (ComandasScreen).
 */

import type { Order } from '../types/models';

/**
 * Filters an array of orders for display on the Kanban board.
 * Removes any orders with status 'cancelled' — they should not appear
 * in any column.
 *
 * @param orders - The full list of orders to filter.
 * @returns A new array containing only non-cancelled orders.
 */
export function filterOrdersForKanban(orders: Order[]): Order[] {
  return orders.filter((order) => order.status !== 'cancelled');
}
