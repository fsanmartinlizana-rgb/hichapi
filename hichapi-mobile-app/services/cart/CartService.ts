/**
 * Cart service for HiChapi Mobile App.
 * Manages cart state with AsyncStorage persistence.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../utils/constants';
import { CartCalculator } from './CartCalculator';
import type { Cart, CartItem } from '../../types/ui';
import type { MenuItem } from '../../types/models';

const EMPTY_CART: Cart = { items: [], restaurant_id: '', restaurant_slug: '', table_id: '' };

class CartService {
  private cart: Cart = { ...EMPTY_CART };

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private async persist(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(this.cart));
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Loads the cart from AsyncStorage. Call on app start.
   */
  async loadCart(): Promise<Cart> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.CART);
      if (raw) {
        this.cart = JSON.parse(raw) as Cart;
      } else {
        this.cart = { ...EMPTY_CART };
      }
    } catch {
      this.cart = { ...EMPTY_CART };
    }
    return { ...this.cart };
  }

  /**
   * Adds a menu item to the cart. If the item already exists, increments quantity.
   */
  async addItem(item: MenuItem, quantity: number, notes = ''): Promise<Cart> {
    const existing = this.cart.items.find((ci) => ci.menu_item.id === item.id);
    if (existing) {
      this.cart = {
        ...this.cart,
        items: this.cart.items.map((ci) =>
          ci.menu_item.id === item.id
            ? { ...ci, quantity: ci.quantity + quantity }
            : ci
        ),
      };
    } else {
      const newItem: CartItem = { menu_item: item, quantity, notes };
      this.cart = { ...this.cart, items: [...this.cart.items, newItem] };
    }
    await this.persist();
    return { ...this.cart };
  }

  /**
   * Updates the quantity of a cart item. Removes the item if quantity <= 0.
   */
  async updateQuantity(itemId: string, quantity: number): Promise<Cart> {
    if (quantity <= 0) {
      return this.removeItem(itemId);
    }
    this.cart = {
      ...this.cart,
      items: this.cart.items.map((ci) =>
        ci.menu_item.id === itemId ? { ...ci, quantity } : ci
      ),
    };
    await this.persist();
    return { ...this.cart };
  }

  /**
   * Removes an item from the cart by menu_item.id.
   */
  async removeItem(itemId: string): Promise<Cart> {
    this.cart = {
      ...this.cart,
      items: this.cart.items.filter((ci) => ci.menu_item.id !== itemId),
    };
    await this.persist();
    return { ...this.cart };
  }

  /**
   * Clears all items from the cart, preserving restaurant/table info.
   */
  async clearCart(): Promise<Cart> {
    this.cart = {
      items: [],
      restaurant_id: this.cart.restaurant_id,
      restaurant_slug: this.cart.restaurant_slug,
      table_id: this.cart.table_id,
    };
    await this.persist();
    return { ...this.cart };
  }

  /**
   * Sets the restaurant and table context for the cart.
   */
  async setTableInfo(restaurantId: string, tableId: string, slug?: string): Promise<void> {
    this.cart = { 
      ...this.cart, 
      restaurant_id: restaurantId, 
      table_id: tableId,
      restaurant_slug: slug || this.cart.restaurant_slug 
    };
    await this.persist();
  }

  /**
   * Calculates the total price of the current cart (or a provided cart).
   */
  calculateTotal(cart?: Cart): number {
    return CartCalculator.calculateTotal(cart ?? this.cart);
  }

  /**
   * Returns the current cart state (read-only copy).
   */
  getCart(): Cart {
    return { ...this.cart };
  }
}

/** Singleton instance of the cart service. */
export const cartService = new CartService();
