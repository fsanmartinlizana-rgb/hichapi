/**
 * Unit tests for CartService and CartCalculator.
 */

import { CartCalculator } from '../../services/cart/CartCalculator';
import type { Cart, CartItem } from '../../types/ui';
import type { MenuItem } from '../../types/models';

// AsyncStorage is mocked in jest.setup.ts

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMenuItem(overrides?: Partial<MenuItem>): MenuItem {
  return {
    id: 'item-uuid-1',
    restaurant_id: 'restaurant-uuid-1',
    name: 'Empanada de pino',
    description: 'Empanada tradicional',
    price: 2500,
    category: 'Entradas',
    tags: [],
    available: true,
    ...overrides,
  };
}

function buildCart(items: CartItem[] = []): Cart {
  return { items, restaurant_id: 'r1', table_id: 't1' };
}

function buildCartItem(price: number, quantity: number): CartItem {
  return {
    menu_item: buildMenuItem({ price }),
    quantity,
    notes: '',
  };
}

// ---------------------------------------------------------------------------
// CartCalculator tests
// ---------------------------------------------------------------------------

describe('CartCalculator.calculateTotal()', () => {
  it('returns 0 for empty cart', () => {
    expect(CartCalculator.calculateTotal(buildCart())).toBe(0);
  });

  it('returns price × quantity for single item', () => {
    const cart = buildCart([buildCartItem(2500, 2)]);
    expect(CartCalculator.calculateTotal(cart)).toBe(5000);
  });

  it('returns sum of price × quantity for multiple items', () => {
    const cart = buildCart([
      buildCartItem(2500, 2), // 5000
      buildCartItem(3000, 1), // 3000
      buildCartItem(1000, 3), // 3000
    ]);
    expect(CartCalculator.calculateTotal(cart)).toBe(11000);
  });
});

describe('CartCalculator.calculateSubtotal()', () => {
  it('returns price × quantity for a single item', () => {
    const item = buildCartItem(2500, 3);
    expect(CartCalculator.calculateSubtotal(item)).toBe(7500);
  });

  it('returns 0 when price is 0', () => {
    const item = buildCartItem(0, 5);
    expect(CartCalculator.calculateSubtotal(item)).toBe(0);
  });
});

describe('CartCalculator.calculateItemCount()', () => {
  it('returns 0 for empty cart', () => {
    expect(CartCalculator.calculateItemCount(buildCart())).toBe(0);
  });

  it('returns sum of all quantities', () => {
    const cart = buildCart([
      buildCartItem(1000, 2),
      buildCartItem(2000, 3),
    ]);
    expect(CartCalculator.calculateItemCount(cart)).toBe(5);
  });
});

describe('CartCalculator.isEmpty()', () => {
  it('returns true for empty cart', () => {
    expect(CartCalculator.isEmpty(buildCart())).toBe(true);
  });

  it('returns false for cart with items', () => {
    const cart = buildCart([buildCartItem(1000, 1)]);
    expect(CartCalculator.isEmpty(cart)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CartService tests
// ---------------------------------------------------------------------------

describe('CartService', () => {
  let cartService: typeof import('../../services/cart/CartService').cartService;
  const AsyncStorage = require('@react-native-async-storage/async-storage');

  beforeEach(async () => {
    jest.clearAllMocks();
    // Re-import to get a fresh singleton state
    jest.resetModules();
    const module = await import('../../services/cart/CartService');
    cartService = module.cartService;
  });

  describe('loadCart()', () => {
    it('returns empty cart when AsyncStorage is empty', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      const cart = await cartService.loadCart();
      expect(cart.items).toHaveLength(0);
    });

    it('returns stored cart when AsyncStorage has data', async () => {
      const stored: Cart = {
        items: [{ menu_item: buildMenuItem(), quantity: 2, notes: '' }],
        restaurant_id: 'r1',
        table_id: 't1',
      };
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));
      const cart = await cartService.loadCart();
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(2);
    });
  });

  describe('addItem()', () => {
    it('adds a new item to the cart', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      await cartService.loadCart();
      const item = buildMenuItem({ id: 'item-1' });
      const cart = await cartService.addItem(item, 1);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].menu_item.id).toBe('item-1');
      expect(cart.items[0].quantity).toBe(1);
    });

    it('increments quantity when item already exists', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      await cartService.loadCart();
      const item = buildMenuItem({ id: 'item-1' });
      await cartService.addItem(item, 2);
      const cart = await cartService.addItem(item, 3);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(5);
    });
  });

  describe('removeItem()', () => {
    it('removes item from cart', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      await cartService.loadCart();
      const item = buildMenuItem({ id: 'item-1' });
      await cartService.addItem(item, 2);
      const cart = await cartService.removeItem('item-1');
      expect(cart.items).toHaveLength(0);
    });
  });

  describe('updateQuantity()', () => {
    it('updates item quantity', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      await cartService.loadCart();
      const item = buildMenuItem({ id: 'item-1' });
      await cartService.addItem(item, 2);
      const cart = await cartService.updateQuantity('item-1', 5);
      expect(cart.items[0].quantity).toBe(5);
    });

    it('removes item when quantity is 0', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      await cartService.loadCart();
      const item = buildMenuItem({ id: 'item-1' });
      await cartService.addItem(item, 2);
      const cart = await cartService.updateQuantity('item-1', 0);
      expect(cart.items).toHaveLength(0);
    });
  });

  describe('clearCart()', () => {
    it('empties the cart', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      await cartService.loadCart();
      const item = buildMenuItem({ id: 'item-1' });
      await cartService.addItem(item, 3);
      const cart = await cartService.clearCart();
      expect(cart.items).toHaveLength(0);
    });
  });
});
