/**
 * Order service — queries Supabase directly (same as the web app).
 * Status updates go through the Next.js API for business logic (stock deduction, notifications).
 */

import { supabase } from '../../config/supabase';
import { apiClient } from '../api/APIClient';
import type { Order, OrderItem, OrderStatus } from '../../types/models';
import type { OrderFilters } from '../../types/ui';
import type { OrderCreateRequest } from '../../types/api';

class OrderService {
  /**
   * Fetch active orders for a restaurant directly from Supabase.
   */
  async getOrders(restaurantId: string, filters?: OrderFilters): Promise<Order[]> {
    if (!restaurantId) return [];

    let query = supabase
      .from('orders')
      .select('id, table_id, status, total, client_name, notes, created_at, updated_at, restaurant_id, tables(label)')
      .eq('restaurant_id', restaurantId)
      .not('status', 'in', '("paid","cancelled")')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      query = query.in('status', statuses);
    }
    if (filters?.table_id) {
      query = query.eq('table_id', filters.table_id);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Flatten table label into order object
    return ((data ?? []) as any[]).map((row) => ({
      ...row,
      table_label: row.tables?.label ?? null,
      tables: undefined,
    })) as Order[];
  }

  /**
   * Fetch a single order by ID.
   */
  async getOrderById(orderId: string): Promise<Order> {
    const { data, error } = await supabase
      .from('orders')
      .select('id, table_id, status, total, client_name, notes, created_at, updated_at, restaurant_id, tables(label)')
      .eq('id', orderId)
      .single();
    if (error) throw new Error(error.message);
    const row = data as any;
    return {
      ...row,
      table_label: row.tables?.label ?? null,
      tables: undefined,
    } as Order;
  }

  /**
   * Fetch order items for a given order.
   */
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const { data, error } = await supabase
      .from('order_items')
      .select('id, order_id, menu_item_id, name, quantity, unit_price, notes, status')
      .eq('order_id', orderId);
    if (error) throw new Error(error.message);
    return (data ?? []) as OrderItem[];
  }

  /**
   * Update order status — goes through Next.js API for business logic.
   */
  async updateOrderStatus(
    orderId: string, 
    status: OrderStatus,
    paymentData?: {
      payment_method?: 'cash' | 'digital' | 'mixed';
      cash_amount?: number;
      digital_amount?: number;
    }
  ): Promise<Order> {
    // Status updates MUST go through the Next.js API to trigger business logic 
    // (stock deduction, notifications, auto-freeing tables).
    const res = await apiClient.patch<{ ok: boolean; order_id: string; status: string }>('/api/orders', {
      order_id: orderId,
      status,
      ...paymentData,
    });

    if (!res.ok) throw new Error('No se pudo actualizar el estado');
    
    // Fetch the updated order to return it
    return this.getOrderById(orderId);
  }

  /**
   * Cancel an order.
   */
  async cancelOrder(orderId: string): Promise<void> {
    await this.updateOrderStatus(orderId, 'cancelled');
  }

  /**
   * Create a new order via the Next.js API (handles stock deduction, notifications).
   */
  async createOrder(request: OrderCreateRequest): Promise<Order> {
    return apiClient.post<Order>('/api/orders', {
      restaurant_slug: request.restaurant_id, // will be resolved by API
      table_id: request.table_id,
      cart: request.items.map(item => ({
        menu_item_id: item.menu_item_id,
        name: item.menu_item_id,
        quantity: item.quantity,
        unit_price: 0,
        note: item.notes,
      })),
      client_name: request.client_name,
      notes: request.notes,
    });
  }
}

export const orderService = new OrderService();
