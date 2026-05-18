/**
 * Core domain model interfaces for HiChapi Mobile App.
 * These types mirror the Supabase database schema.
 */

/**
 * Possible states an order can be in throughout its lifecycle.
 * - pending: Order created, awaiting confirmation
 * - confirmed: Order acknowledged by staff
 * - preparing: Kitchen is preparing the order
 * - ready: Order is ready to be served
 * - paying: Customer has requested the bill
 * - paid: Payment completed
 * - cancelled: Order was cancelled
 */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'paying'
  | 'paid'
  | 'cancelled';

/**
 * A restaurant registered in the HiChapi platform.
 */
export interface Restaurant {
  /** Unique identifier (UUID) */
  id: string;
  /** ID of the user who owns this restaurant */
  owner_id: string;
  /** Display name of the restaurant */
  name: string;
  /** URL-friendly unique identifier */
  slug: string;
  /** Physical address */
  address: string;
  /** Neighborhood or district */
  neighborhood: string;
  /** Type of cuisine served */
  cuisine_type: string;
  /** Price range indicator */
  price_range: '$' | '$$' | '$$$' | '$$$$';
  /** Whether the restaurant is currently active on the platform */
  active: boolean;
  /** ISO 8601 timestamp of creation */
  created_at: string;
}

/**
 * A table within a restaurant.
 */
export interface Table {
  /** Unique identifier (UUID) */
  id: string;
  /** ID of the restaurant this table belongs to */
  restaurant_id: string;
  /** Human-readable label (e.g. "Mesa 5", "Terraza 2") */
  label: string;
  /** Number of seats at this table */
  seats: number;
  /** Current occupancy status */
  status: 'libre' | 'ocupada' | 'reservada' | 'bloqueada';
  /** Zone or section within the restaurant */
  zone: string;
  /** Whether this is a smoking-allowed table */
  smoking: boolean;
  /** Minimum number of guests */
  min_pax: number;
  /** Maximum number of guests */
  max_pax: number;
  /** Token embedded in the QR code for this table */
  qr_token: string;
}

/**
 * An item available on the restaurant's menu.
 */
export interface MenuItem {
  /** Unique identifier (UUID) */
  id: string;
  /** ID of the restaurant this item belongs to */
  restaurant_id: string;
  /** Display name of the menu item */
  name: string;
  /** Detailed description */
  description: string;
  /** Price in Chilean Pesos (CLP) */
  price: number;
  /** Category grouping (e.g. "Entradas", "Postres") */
  category: string;
  /** Searchable tags (e.g. ["vegetariano", "sin gluten"]) */
  tags: string[];
  /** Whether this item is currently available to order */
  available: boolean;
  /** Optional list of stock ingredients used by this item */
  ingredients?: Ingredient[];
}

/**
 * A stock ingredient used in a menu item recipe.
 */
export interface Ingredient {
  /** ID of the StockItem this ingredient references */
  stock_item_id: string;
  /** Quantity of the stock item used per menu item */
  qty: number;
}

/**
 * A customer order placed at a table.
 */
export interface Order {
  /** Unique identifier (UUID) */
  id: string;
  /** ID of the restaurant this order belongs to */
  restaurant_id: string;
  /** ID of the table where the order was placed */
  table_id: string;
  /** Human-readable table label (e.g. "Mesa 1") — joined from tables table */
  table_label?: string | null;
  /** Current status in the order lifecycle */
  status: OrderStatus;
  /** Total amount in Chilean Pesos (CLP) */
  total: number;
  /** Name provided by the customer */
  client_name: string;
  /** Optional notes for the order */
  notes: string;
  /** ISO 8601 timestamp of order creation */
  created_at: string;
  /** ISO 8601 timestamp of last update */
  updated_at: string;
}

/**
 * An individual line item within an order.
 */
export interface OrderItem {
  /** Unique identifier (UUID) */
  id: string;
  /** ID of the parent order */
  order_id: string;
  /** ID of the menu item ordered */
  menu_item_id: string;
  /** Snapshot of the menu item name at time of order */
  name: string;
  /** Number of units ordered */
  quantity: number;
  /** Price per unit in Chilean Pesos (CLP) at time of order */
  unit_price: number;
  /** Optional notes for this specific item */
  notes: string;
  /** Preparation status of this item */
  status: string;
}

/**
 * A staff member associated with a restaurant.
 */
export interface TeamMember {
  /** Unique identifier (UUID) */
  id: string;
  /** ID of the restaurant this member belongs to */
  restaurant_id: string;
  /** ID of the Supabase Auth user */
  user_id: string;
  /** Role determining permissions within the restaurant */
  role: 'owner' | 'admin' | 'supervisor' | 'garzon' | 'waiter' | 'super_admin';
  /** ID of the team member who sent the invitation */
  invited_by: string;
  /** ISO 8601 timestamp when the member joined */
  joined_at: string;
  /** Whether this team member is currently active */
  active: boolean;
}

/**
 * An item tracked in the restaurant's inventory.
 */
export interface StockItem {
  /** Unique identifier (UUID) */
  id: string;
  /** ID of the restaurant this stock item belongs to */
  restaurant_id: string;
  /** Display name of the stock item */
  name: string;
  /** Unit of measurement (e.g. "kg", "litros", "unidades") */
  unit: string;
  /** Current quantity in stock */
  current_qty: number;
  /** Minimum quantity threshold before low-stock alert */
  min_qty: number;
  /** Cost per unit in Chilean Pesos (CLP) */
  cost_per_unit: number;
  /** Supplier name or identifier */
  supplier: string;
  /** Category grouping for this stock item */
  category: string;
  /** Whether this stock item is currently active */
  active: boolean;
  /** ISO 8601 timestamp of last update */
  updated_at: string;
}

/**
 * A record of inventory waste or loss.
 */
export interface WasteLog {
  /** Unique identifier (UUID) */
  id: string;
  /** ID of the restaurant this waste log belongs to */
  restaurant_id: string;
  /** ID of the stock item that was lost */
  stock_item_id: string;
  /** Quantity lost */
  qty_lost: number;
  /** Reason for the waste */
  reason: 'vencimiento' | 'deterioro' | 'rotura' | 'error_prep' | 'sobras' | 'otro';
  /** Optional additional notes */
  notes: string;
  /** ID of the team member who logged this waste */
  logged_by: string;
  /** Estimated cost of the loss in Chilean Pesos (CLP) */
  cost_lost: number;
  /** ISO 8601 timestamp when the waste was logged */
  logged_at: string;
}

/**
 * A scheduled work shift for a staff member.
 */
export interface Shift {
  /** Unique identifier (UUID) */
  id: string;
  /** ID of the restaurant this shift belongs to */
  restaurant_id: string;
  /** ID of the shift template used (if any) */
  template_id: string;
  /** ID of the staff member assigned to this shift */
  staff_id: string;
  /** Date of the shift (ISO 8601 date string, e.g. "2025-01-15") */
  shift_date: string;
  /** Shift start time (HH:MM format) */
  start_time: string;
  /** Shift end time (HH:MM format) */
  end_time: string;
  /** IDs of tables assigned to this staff member during the shift */
  tables_assigned: string[];
  /** Current status of the shift */
  status: 'scheduled' | 'open' | 'closed' | 'no_show';
  /** ISO 8601 timestamp when the shift was opened */
  opened_at?: string;
  /** ISO 8601 timestamp when the shift was closed */
  closed_at?: string;
  /** Optional notes about the shift */
  notes: string;
}

/**
 * A printer configuration within a restaurant.
 */
export interface Printer {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  kind: 'cocina' | 'barra' | 'caja' | 'otro';
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Group of items destined for a specific printer kind.
 */
export interface TicketGroup {
  kind: string;
  items: Array<{ nombre: string; cantidad: number; observacion: string }>;
  printers: Array<{ id: string; name: string }>;
}
