/**
 * Cart context for HiChapi Mobile App.
 * Provides cart state and operations to the component tree.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { cartService } from '../services/cart/CartService';
import { CartCalculator } from '../services/cart/CartCalculator';
import type { Cart } from '../types/ui';
import type { MenuItem } from '../types/models';

// ---------------------------------------------------------------------------
// Context value interface
// ---------------------------------------------------------------------------

export interface CartContextValue {
  cart: Cart;
  total: number;
  itemCount: number;
  loading: boolean;
  addItem: (item: MenuItem, quantity: number, notes?: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context creation
// ---------------------------------------------------------------------------

export const CartContext = createContext<CartContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------

interface CartProviderProps {
  children: React.ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [cart, setCart] = useState<Cart>({ items: [], restaurant_id: '', restaurant_slug: '', table_id: '' });
  const [loading, setLoading] = useState(true);

  // Load cart from AsyncStorage on mount
  useEffect(() => {
    cartService.loadCart().then((loaded) => {
      setCart(loaded);
      setLoading(false);
    });
  }, []);

  const addItem = async (item: MenuItem, quantity: number, notes?: string) => {
    const updated = await cartService.addItem(item, quantity, notes);
    setCart(updated);
  };

  const removeItem = async (itemId: string) => {
    const updated = await cartService.removeItem(itemId);
    setCart(updated);
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    const updated = await cartService.updateQuantity(itemId, quantity);
    setCart(updated);
  };

  const clearCart = async () => {
    const updated = await cartService.clearCart();
    setCart(updated);
  };

  const value: CartContextValue = {
    cart,
    total: CartCalculator.calculateTotal(cart),
    itemCount: CartCalculator.calculateItemCount(cart),
    loading,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
