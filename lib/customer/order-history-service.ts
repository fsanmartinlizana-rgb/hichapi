/**
 * lib/customer/order-history-service.ts
 *
 * Historial unificado de pedidos presenciales (orders) y delivery (delivery_orders).
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
import { createAdminClient } from '@/lib/supabase/server'
import type { OrderHistoryQueryInput } from './schemas'
import type { OrderItem, UnifiedOrder } from './types'

interface OrderRow {
  id: string
  restaurant_id: string
  status: string
  total: number
  notes: string | null
  created_at: string
  restaurants: { name: string } | { name: string }[] | null
}

interface DeliveryOrderRow {
  id: string
  restaurant_id: string
  order_id: string | null
  rider_id: string | null
  status: string
  total_clp: number
  delivery_address: string
  created_at: string
  restaurants: { name: string } | { name: string }[] | null
}

function restaurantName(
  row: { restaurants: { name: string } | { name: string }[] | null },
): string {
  const r = row.restaurants
  if (!r) return 'Restaurante'
  if (Array.isArray(r)) return r[0]?.name ?? 'Restaurante'
  return r.name
}

function inDateRange(iso: string, from?: string, to?: string): boolean {
  const d = iso.slice(0, 10)
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

function mapPresencial(row: OrderRow): UnifiedOrder {
  return {
    id: row.id,
    order_type: 'presencial',
    restaurant_id: row.restaurant_id,
    restaurant_name: restaurantName(row),
    status: row.status,
    total_clp: row.total,
    created_at: row.created_at,
    notes: row.notes ?? undefined,
  }
}

function mapDelivery(row: DeliveryOrderRow): UnifiedOrder {
  return {
    id: row.id,
    order_type: 'delivery',
    restaurant_id: row.restaurant_id,
    restaurant_name: restaurantName(row),
    status: row.status,
    total_clp: row.total_clp,
    created_at: row.created_at,
    delivery_address: row.delivery_address,
    rider_id: row.rider_id,
  }
}

/**
 * Returns paginated unified order history for a customer.
 */
export async function listOrders(
  customerId: string,
  query: OrderHistoryQueryInput,
): Promise<{ orders: UnifiedOrder[]; total: number; page: number; page_size: number }> {
  const supabase = createAdminClient()
  const unified: UnifiedOrder[] = []

  if (query.type === 'all' || query.type === 'presencial') {
    const { data, error } = await supabase
      .from('orders')
      .select('id, restaurant_id, status, total, notes, created_at, restaurants(name)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    for (const row of (data ?? []) as OrderRow[]) {
      if (inDateRange(row.created_at, query.from, query.to)) {
        unified.push(mapPresencial(row))
      }
    }
  }

  if (query.type === 'all' || query.type === 'delivery') {
    const { data, error } = await supabase
      .from('delivery_orders')
      .select('id, restaurant_id, order_id, rider_id, status, total_clp, delivery_address, created_at, restaurants(name)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    for (const row of (data ?? []) as DeliveryOrderRow[]) {
      if (inDateRange(row.created_at, query.from, query.to)) {
        unified.push(mapDelivery(row))
      }
    }
  }

  unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const total = unified.length
  const start = (query.page - 1) * query.page_size
  const orders = unified.slice(start, start + query.page_size)

  return { orders, total, page: query.page, page_size: query.page_size }
}

/**
 * Returns full order detail (items, address, notes) for a presencial or delivery order.
 */
export async function getOrderById(
  customerId: string,
  orderId: string,
): Promise<UnifiedOrder | null> {
  const supabase = createAdminClient()

  const { data: delivery, error: dErr } = await supabase
    .from('delivery_orders')
    .select('id, restaurant_id, order_id, rider_id, status, total_clp, delivery_address, created_at, restaurants(name)')
    .eq('id', orderId)
    .eq('customer_id', customerId)
    .maybeSingle()

  if (dErr) throw new Error(dErr.message)

  if (delivery) {
    const row = delivery as DeliveryOrderRow
    const items = await fetchOrderItems(supabase, row.order_id)
    return { ...mapDelivery(row), items }
  }

  const { data: presencial, error: pErr } = await supabase
    .from('orders')
    .select('id, restaurant_id, status, total, notes, created_at, restaurants(name)')
    .eq('id', orderId)
    .eq('customer_id', customerId)
    .maybeSingle()

  if (pErr) throw new Error(pErr.message)
  if (!presencial) return null

  const row = presencial as OrderRow
  const items = await fetchOrderItems(supabase, row.id)
  return { ...mapPresencial(row), items }
}

async function fetchOrderItems(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string | null,
): Promise<OrderItem[]> {
  if (!orderId) return []

  const { data, error } = await supabase
    .from('order_items')
    .select('name, quantity, unit_price')
    .eq('order_id', orderId)

  if (error) throw new Error(error.message)
  return (data ?? []).map((i: { name: string; quantity: number; unit_price: number }) => ({
    name: i.name,
    quantity: i.quantity,
    unit_price: i.unit_price,
  }))
}
