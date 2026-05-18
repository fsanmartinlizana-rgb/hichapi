/**
 * Stock management service — queries Supabase directly.
 */

import { supabase } from '../../config/supabase';
import type { StockItem } from '../../types/models';
import type { StockAdjustRequest, StockMovement } from '../../types/ui';

class StockService {
  async getStockItems(restaurantId: string): Promise<StockItem[]> {
    if (!restaurantId) return [];
    const { data, error } = await supabase
      .from('stock_items')
      .select('id, restaurant_id, name, unit, current_qty, min_qty, cost_per_unit, supplier, category, active, updated_at')
      .eq('restaurant_id', restaurantId)
      .eq('active', true)
      .order('name');
    if (error) throw new Error(error.message);
    return (data ?? []) as StockItem[];
  }

  async adjustStock(request: StockAdjustRequest): Promise<void> {
    // Get current qty first
    const { data: item, error: fetchErr } = await supabase
      .from('stock_items')
      .select('current_qty')
      .eq('id', request.stock_item_id)
      .single();
    if (fetchErr || !item) throw new Error('Item not found');

    const newQty = (item.current_qty as number) + request.delta;
    const { error } = await supabase
      .from('stock_items')
      .update({ current_qty: newQty, updated_at: new Date().toISOString() })
      .eq('id', request.stock_item_id);
    if (error) throw new Error(error.message);

    // Log movement
    await supabase.from('stock_movements').insert({
      stock_item_id: request.stock_item_id,
      delta: request.delta,
      reason: request.reason,
      notes: request.notes ?? '',
      created_at: new Date().toISOString(),
    });
  }

  async getLowStockItems(restaurantId: string): Promise<StockItem[]> {
    const items = await this.getStockItems(restaurantId);
    return items.filter((item) => item.current_qty < item.min_qty);
  }

  async getStockMovements(stockItemId: string): Promise<StockMovement[]> {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('id, stock_item_id, delta, reason, notes, created_at')
      .eq('stock_item_id', stockItemId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []) as StockMovement[];
  }
}

export const stockService = new StockService();
