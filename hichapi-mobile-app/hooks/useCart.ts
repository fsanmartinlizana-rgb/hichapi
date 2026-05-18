/**
 * Custom hook for consuming the CartContext.
 * Must be used within a CartProvider.
 */

import { useContext } from 'react';
import { CartContext } from '../contexts/CartContext';

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
