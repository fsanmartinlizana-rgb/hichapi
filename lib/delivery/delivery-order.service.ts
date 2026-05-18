/**
 * lib/delivery/delivery-order.service.ts
 *
 * DeliveryOrderService — state machine, atomic accept, fee calculation.
 * Requirements: 3.3, 3.5, 3.6, 3.9, 3.10, 7.5
 */
import { createAdminClient } from '@/lib/supabase/server'
import type {
  DeliveryOrder,
  DeliveryStatus,
  DeliveryFeeTier,
  FailureReason,
  CreateDeliveryOrderInput,
} from './types'

// ── State machine ─────────────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending_assignment: ['assigned', 'cancelled'],
  assigned:           ['picked_up', 'cancelled'],
  picked_up:          ['in_transit', 'delivered', 'failed'],
  in_transit:         ['delivered', 'failed'],
  delivered:          [],
  cancelled:          [],
  failed:             [],
}

export function canTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// ── Fee calculation ───────────────────────────────────────────────────────────

/**
 * Returns the delivery fee in CLP for a given distance and fee tier config.
 * Always returns a non-negative value. Returns 0 if no tier matches.
 */
export function calculateDeliveryFee(
  tiers: DeliveryFeeTier[],
  distanceKm: number,
): number {
  const sorted = [...tiers].sort((a, b) => a.min_km - b.min_km)
  for (const tier of sorted) {
    const withinMin = distanceKm >= tier.min_km
    const withinMax = tier.max_km === null || distanceKm < tier.max_km
    if (withinMin && withinMax) {
      return Math.max(0, tier.fee_clp)
    }
  }
  // Fallback: use the last tier (highest distance bracket)
  const last = sorted[sorted.length - 1]
  return last ? Math.max(0, last.fee_clp) : 0
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export interface OrderFilters {
  status?: DeliveryStatus | DeliveryStatus[]
  from?: string   // ISO date
  to?: string     // ISO date
  rider_id?: string
}

export async function createDeliveryOrder(
  restaurantId: string,
  input: CreateDeliveryOrderInput,
): Promise<DeliveryOrder> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('delivery_orders')
    .insert({
      restaurant_id:    restaurantId,
      order_id:         input.order_id ?? null,
      status:           'pending_assignment',
      pickup_address:   input.pickup_address,
      delivery_address: input.delivery_address,
      client_name:      input.client_name,
      client_phone:     input.client_phone,
      total_clp:        input.total_clp,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as DeliveryOrder
}

export async function listOrdersForRestaurant(
  restaurantId: string,
  filters: OrderFilters = {},
): Promise<DeliveryOrder[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('delivery_orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    query = query.in('status', statuses)
  }
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to)   query = query.lte('created_at', filters.to)
  if (filters.rider_id) query = query.eq('rider_id', filters.rider_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as DeliveryOrder[]
}

export async function getDeliveryOrderById(orderId: string): Promise<DeliveryOrder | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('delivery_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()
  return data as DeliveryOrder | null
}

// ── State transitions ─────────────────────────────────────────────────────────

export interface TransitionOptions {
  riderId?: string
  failureReason?: FailureReason
}

export async function transitionDeliveryOrder(
  orderId: string,
  newStatus: DeliveryStatus,
  options: TransitionOptions = {},
): Promise<DeliveryOrder> {
  const supabase = createAdminClient()

  const { data: order } = await supabase
    .from('delivery_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) throw new Error('Pedido no encontrado')

  const currentStatus = order.status as DeliveryStatus
  if (!canTransition(currentStatus, newStatus)) {
    throw new Error(`Transición inválida: ${currentStatus} → ${newStatus}`)
  }
  if (newStatus === 'failed' && !options.failureReason) {
    throw new Error('failure_reason es requerido para marcar como fallido')
  }

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { status: newStatus, updated_at: now }

  if (newStatus === 'picked_up')  updates.picked_up_at = now
  if (newStatus === 'delivered')  updates.delivered_at = now
  if (newStatus === 'failed')     updates.failure_reason = options.failureReason

  // Atomic accept: only succeeds if still pending_assignment
  if (newStatus === 'assigned') {
    if (!options.riderId) throw new Error('riderId es requerido para asignar un pedido')

    // Calculate delivery fee
    const { data: tiers } = await supabase
      .from('delivery_fee_tiers')
      .select('*')
      .eq('restaurant_id', order.restaurant_id)

    let fee = 0
    if (tiers && tiers.length > 0) {
      fee = calculateDeliveryFee(tiers as any, 0)
    }

    const { data: updated, error } = await supabase
      .from('delivery_orders')
      .update({ ...updates, rider_id: options.riderId, delivery_fee_clp: fee })
      .eq('id', orderId)
      .eq('status', 'pending_assignment')   // atomic guard
      .select()
      .maybeSingle()

    if (error || !updated) {
      throw new Error('El pedido ya fue aceptado por otro rider o no existe')
    }

    // Mark rider as busy
    await supabase
      .from('rider_profiles')
      .update({ status: 'busy', updated_at: now })
      .eq('id', options.riderId)

    return updated as DeliveryOrder
  }

  const { data: updated, error } = await supabase
    .from('delivery_orders')
    .update(updates)
    .eq('id', orderId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  // On delivery: free the rider and record fee
  if (newStatus === 'delivered' && order.rider_id) {
    await supabase
      .from('rider_profiles')
      .update({ status: 'available', updated_at: now })
      .eq('id', order.rider_id)

    // Calculate and persist delivery fee if not already set
    if (!order.delivery_fee_clp) {
      const { data: tiers } = await supabase
        .from('delivery_fee_tiers')
        .select('*')
        .eq('restaurant_id', order.restaurant_id)

      if (tiers && tiers.length > 0) {
        // Use a default distance of 0 if no GPS track available
        const fee = calculateDeliveryFee(tiers as DeliveryFeeTier[], 0)
        await supabase
          .from('delivery_orders')
          .update({ delivery_fee_clp: fee })
          .eq('id', orderId)
      }
    }
  }

  // On failed: also free the rider
  if (newStatus === 'failed' && order.rider_id) {
    await supabase
      .from('rider_profiles')
      .update({ status: 'available', updated_at: now })
      .eq('id', order.rider_id)
  }

  return updated as DeliveryOrder
}
