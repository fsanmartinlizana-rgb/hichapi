/**
 * API endpoint constants for HiChapi Mobile App.
 * All paths correspond to Next.js API routes on the backend.
 */

export const ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/auth/logout',

  // Orders
  ORDERS: '/api/orders',
  ORDER_BY_ID: (id: string) => `/api/orders/${id}`,

  // Tables
  TABLES: '/api/tables',
  TABLE_BY_ID: (id: string) => `/api/tables/${id}`,

  // Menu Items
  MENU_ITEMS: '/api/menu-items',
  MENU_ITEM_BY_ID: (id: string) => `/api/menu-items/${id}`,

  // Stock
  STOCK: '/api/stock',
  STOCK_ADJUST: '/api/stock/adjust',

  // Notifications
  PUSH_TOKENS: '/api/push-tokens',

  // Chat
  CHAT: '/api/chat',

  // Stripe
  STRIPE_PAYMENT_INTENT: '/api/stripe/create-payment-intent',

  // Shifts
  SHIFTS: '/api/shifts',

  // Waste
  WASTE: '/api/waste',

  // Bills
  BILLS: '/api/bills',
} as const;
