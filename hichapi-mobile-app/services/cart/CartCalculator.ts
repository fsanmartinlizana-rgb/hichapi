/**
 * Pure cart calculation functions for HiChapi Mobile App.
 * No side effects — safe to use in tests and property-based testing.
 */

import type { Cart, CartItem } from '../../types/ui';

export class CartCalculator {
  /**
   * Calculates the total price of all items in the cart.
   * Total = sum of (item.menu_item.price × item.quantity) for all items.
   */
  static calculateTotal(cart: Cart): number {
    return cart.items.reduce(
      (sum, item) => sum + item.menu_item.price * item.quantity,
      0
    );
  }

  /**
   * Calculates the subtotal for a single cart item.
   * Subtotal = item.menu_item.price × item.quantity
   */
  static calculateSubtotal(item: CartItem): number {
    return item.menu_item.price * item.quantity;
  }

  /**
   * Returns the total number of individual units across all cart items.
   * (Sum of all quantities, not number of distinct items.)
   */
  static calculateItemCount(cart: Cart): number {
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Returns true if the cart has no items.
   */
  static isEmpty(cart: Cart): boolean {
    return cart.items.length === 0;
  }
}
