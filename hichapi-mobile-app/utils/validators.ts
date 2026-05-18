/**
 * Zod validation schemas for HiChapi Mobile App domain models.
 * Used to validate API responses and local storage data at runtime.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// OrderStatus
// ---------------------------------------------------------------------------

export const OrderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'paying',
  'paid',
  'cancelled',
]);

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

export const OrderSchema = z.object({
  id: z.string().uuid(),
  restaurant_id: z.string().uuid(),
  table_id: z.string().uuid(),
  status: OrderStatusSchema,
  total: z.number().nonnegative(),
  client_name: z.string(),
  notes: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  menu_item_id: z.string().uuid(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
  notes: z.string(),
  status: z.string(),
});

// ---------------------------------------------------------------------------
// MenuItem
// ---------------------------------------------------------------------------

export const IngredientSchema = z.object({
  stock_item_id: z.string().uuid(),
  qty: z.number().positive(),
});

export const MenuItemSchema = z.object({
  id: z.string().uuid(),
  restaurant_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  price: z.number().nonnegative(),
  category: z.string(),
  tags: z.array(z.string()),
  available: z.boolean(),
  ingredients: z.array(IngredientSchema).optional(),
});

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export const CartItemSchema = z.object({
  menu_item: MenuItemSchema,
  quantity: z.number().int().positive(),
  notes: z.string(),
});

export const CartSchema = z.object({
  items: z.array(CartItemSchema),
  restaurant_id: z.string(),
  table_id: z.string(),
});

// ---------------------------------------------------------------------------
// StockItem
// ---------------------------------------------------------------------------

export const StockItemSchema = z.object({
  id: z.string().uuid(),
  restaurant_id: z.string().uuid(),
  name: z.string().min(1),
  unit: z.string(),
  current_qty: z.number(),
  min_qty: z.number().nonnegative(),
  cost_per_unit: z.number().nonnegative(),
  supplier: z.string(),
  category: z.string(),
  active: z.boolean(),
  updated_at: z.string(),
});

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const TableSchema = z.object({
  id: z.string().uuid(),
  restaurant_id: z.string().uuid(),
  label: z.string(),
  seats: z.number().int().positive(),
  status: z.enum(['libre', 'ocupada', 'reservada', 'bloqueada']),
  zone: z.string(),
  smoking: z.boolean(),
  min_pax: z.number().int().nonnegative(),
  max_pax: z.number().int().positive(),
  qr_token: z.string(),
});

// ---------------------------------------------------------------------------
// Inferred types from schemas
// ---------------------------------------------------------------------------

export type OrderSchemaType = z.infer<typeof OrderSchema>;
export type MenuItemSchemaType = z.infer<typeof MenuItemSchema>;
export type CartSchemaType = z.infer<typeof CartSchema>;
export type StockItemSchemaType = z.infer<typeof StockItemSchema>;
export type TableSchemaType = z.infer<typeof TableSchema>;

// ---------------------------------------------------------------------------
// Safe parse helpers
// ---------------------------------------------------------------------------

/**
 * Safely parses an unknown value against a Zod schema.
 * Returns the parsed data or null on failure (logs the error).
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(
      `[validators] Schema validation failed${context ? ` (${context})` : ''}:`,
      result.error.flatten()
    );
    return null;
  }
  return result.data;
}
