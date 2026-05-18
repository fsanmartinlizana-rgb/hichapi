/**
 * API request and response types for HiChapi Mobile App.
 * These types define the shape of data exchanged with the Next.js API routes.
 */

import type { OrderStatus } from './models';

/**
 * Generic wrapper for all API responses.
 * @template T - The type of the response data payload
 */
export interface ApiResponse<T> {
  /** The response payload on success */
  data?: T;
  /** Error message on failure */
  error?: string;
  /** Optional informational message */
  message?: string;
}

/**
 * Request body for creating a new order.
 */
export interface OrderCreateRequest {
  /** ID of the restaurant where the order is placed */
  restaurant_id: string;
  /** ID of the table placing the order */
  table_id: string;
  /** Name provided by the customer */
  client_name: string;
  /** Optional notes for the entire order */
  notes: string;
  /** List of items being ordered */
  items: {
    /** ID of the menu item */
    menu_item_id: string;
    /** Number of units */
    quantity: number;
    /** Optional notes for this specific item */
    notes: string;
  }[];
}

/**
 * Request body for updating an existing order.
 * All fields are optional — only provided fields will be updated.
 */
export interface OrderUpdateRequest {
  /** New status to transition the order to */
  status?: OrderStatus;
  /** Updated notes for the order */
  notes?: string;
}

/**
 * Request body for adjusting stock inventory levels.
 */
export interface StockAdjustRequest {
  /** ID of the stock item to adjust */
  stock_item_id: string;
  /** Quantity change (positive = increase, negative = decrease) */
  delta: number;
  /** Reason for the adjustment */
  reason: 'compra' | 'ajuste_manual' | 'devolucion';
  /** Optional notes explaining the adjustment */
  notes?: string;
}

/**
 * Generic paginated response wrapper for list endpoints.
 * @template T - The type of items in the paginated list
 */
export interface PaginatedResponse<T> {
  /** Array of items for the current page */
  data: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  pageSize: number;
}
