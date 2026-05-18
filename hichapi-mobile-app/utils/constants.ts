/**
 * Application-wide constants for HiChapi Mobile App.
 * Includes order status labels, colors, and valid transition maps.
 */

import type { OrderStatus } from '../types/models';

// ---------------------------------------------------------------------------
// Order Status Labels (Spanish)
// ---------------------------------------------------------------------------

/** Human-readable Spanish labels for each order status. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  preparing: 'En preparación',
  ready: 'Lista',
  paying: 'Pagando',
  paid: 'Pagada',
  cancelled: 'Cancelada',
};

// ---------------------------------------------------------------------------
// Order Status Colors
// ---------------------------------------------------------------------------

/** Hex color codes for each order status badge. */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#6B7280',   // gray-500
  confirmed: '#3B82F6', // blue-500
  preparing: '#F59E0B', // amber-500
  ready: '#10B981',     // emerald-500
  paying: '#F97316',    // orange-500
  paid: '#8B5CF6',      // violet-500
  cancelled: '#EF4444', // red-500
};

/** Background (light) color variants for status badges. */
export const ORDER_STATUS_BG_COLORS: Record<OrderStatus, string> = {
  pending: '#F3F4F6',   // gray-100
  confirmed: '#EFF6FF', // blue-50
  preparing: '#FFFBEB', // amber-50
  ready: '#ECFDF5',     // emerald-50
  paying: '#FFF7ED',    // orange-50
  paid: '#F5F3FF',      // violet-50
  cancelled: '#FEF2F2', // red-50
};

// ---------------------------------------------------------------------------
// Valid Order Status Transitions
// ---------------------------------------------------------------------------

/**
 * Maps each order status to the set of statuses it can legally transition to.
 * An empty array means the status is terminal (no further transitions allowed).
 *
 * Valid flow: pending → confirmed → preparing → ready → paying → paid
 * Cancellation is allowed from any non-terminal status.
 */
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'paying', 'cancelled'],
  preparing: ['ready', 'paying', 'cancelled'],
  ready: ['paying', 'cancelled'],
  paying: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

// ---------------------------------------------------------------------------
// Kanban Column Configuration
// ---------------------------------------------------------------------------

/** Maps Kanban column names to the order statuses they display. */
export const KANBAN_COLUMNS: { label: string; statuses: OrderStatus[] }[] = [
  { label: 'Recibida', statuses: ['pending', 'confirmed'] },
  { label: 'En Cocina', statuses: ['preparing'] },
  { label: 'Lista', statuses: ['ready'] },
  { label: 'Entregada', statuses: ['paying', 'paid'] },
];

// ---------------------------------------------------------------------------
// AsyncStorage Keys
// ---------------------------------------------------------------------------

export const STORAGE_KEYS = {
  CART: '@hichapi:cart',
  ONBOARDING_COMPLETED: '@hichapi:onboarding_completed',
  PUSH_TOKEN: '@hichapi:push_token',
  OFFLINE_QUEUE: '@hichapi:offline_queue',
} as const;

// ---------------------------------------------------------------------------
// Alert Badge Types
// ---------------------------------------------------------------------------

export const ALERT_BADGE_TYPES = {
  BELL: 'bell',
  BANKNOTE: 'banknote',
} as const;

export type AlertBadgeType = (typeof ALERT_BADGE_TYPES)[keyof typeof ALERT_BADGE_TYPES];

// ---------------------------------------------------------------------------
// Timing Constants
// ---------------------------------------------------------------------------

/** Debounce delay for search inputs in milliseconds. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Interval for checking OTA updates in milliseconds (4 hours). */
export const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

/** Session timeout after inactivity in milliseconds (24 hours). */
export const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;
