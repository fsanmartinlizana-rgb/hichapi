/**
 * UI-specific types for HiChapi Mobile App.
 * These types represent client-side state and UI constructs
 * that don't map directly to database entities.
 */

import type { MenuItem, Order, OrderItem } from './models';
import type { OrderStatus } from './models';

/**
 * A single item in the customer's shopping cart.
 */
export interface CartItem {
  /** The full menu item data (snapshot at time of adding to cart) */
  menu_item: MenuItem;
  /** Number of units the customer wants to order */
  quantity: number;
  /** Optional special instructions for this item */
  notes: string;
}

/**
 * The customer's current shopping cart.
 * Persisted to AsyncStorage between sessions.
 */
export interface Cart {
  /** List of items in the cart */
  items: CartItem[];
  /** ID of the restaurant this cart belongs to */
  restaurant_id: string;
  /** Slug of the restaurant for API routing */
  restaurant_slug: string;
  /** ID of the table the customer is seated at */
  table_id: string;
}

/**
 * Configuration for splitting a bill between multiple people.
 */
export interface SplitPayment {
  /** How the bill should be divided */
  type: 'equal' | 'by_item';
  /** Number of people splitting equally (used when type is 'equal') */
  person_count?: number;
  /**
   * Maps order item IDs to person identifiers (used when type is 'by_item').
   * Key: order item ID, Value: person identifier (e.g. "A", "B", "C")
   */
  assignments?: Record<string, string>;
}

/**
 * A single message in the Chapi AI chat conversation.
 */
export interface ChatMessage {
  /** Unique identifier for this message */
  id: string;
  /** Whether this message was sent by the user or the AI assistant */
  role: 'user' | 'assistant';
  /** Text content of the message */
  content: string;
  /** ISO 8601 timestamp when the message was sent */
  timestamp: string;
}

/**
 * Configuration for a Supabase Realtime subscription.
 */
export interface RealtimeSubscription {
  /** Supabase Realtime channel name */
  channel: string;
  /** Database table to listen for changes on */
  table: string;
  /** Optional filter expression (e.g. "restaurant_id=eq.abc123") */
  filter?: string;
  /** Callback invoked when a change event is received */
  callback: (payload: unknown) => void;
}

/**
 * A record of a stock inventory movement (increase or decrease).
 */
export interface StockMovement {
  /** Unique identifier (UUID) */
  id: string;
  /** ID of the stock item this movement applies to */
  stock_item_id: string;
  /** Quantity change (positive = increase, negative = decrease) */
  delta: number;
  /** Reason for the movement */
  reason: string;
  /** Optional notes about the movement */
  notes?: string;
  /** ISO 8601 timestamp when the movement was recorded */
  created_at: string;
}

/**
 * Filter criteria for querying orders.
 * All fields are optional — omitted fields are not filtered.
 */
export interface OrderFilters {
  /** Filter by one or more order statuses */
  status?: OrderStatus | OrderStatus[];
  /** Filter by table ID */
  table_id?: string;
  /** Filter orders created on or after this ISO 8601 date */
  date_from?: string;
  /** Filter orders created on or before this ISO 8601 date */
  date_to?: string;
}
