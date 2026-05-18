/**
 * lib/delivery/rating.service.ts
 *
 * RatingService — 48h window validation, duplicate prevention, history.
 * Requirements: 6.3, 6.4, 6.7, 6.8, 6.9
 */
import { createAdminClient } from '@/lib/supabase/server'
import type { RiderRating, CreateRiderRatingInput } from './types'

const RATING_WINDOW_MS = 48 * 60 * 60 * 1000 // 48 hours

// ── Submit rating ─────────────────────────────────────────────────────────────

export async function submitRating(
  restaurantId: string,
  ratedBy: string,
  input: CreateRiderRatingInput,
): Promise<RiderRating> {
  const supabase = createAdminClient()

  // Fetch the delivery order
  const { data: order } = await supabase
    .from('delivery_orders')
    .select('rider_id, restaurant_id, status, delivered_at')
    .eq('id', input.delivery_order_id)
    .maybeSingle()

  if (!order) throw new Error('Pedido no encontrado')
  if (order.restaurant_id !== restaurantId) throw new Error('Acceso denegado')
  if (order.status !== 'delivered') {
    throw new Error('Solo se pueden calificar pedidos entregados')
  }
  if (!order.delivered_at) throw new Error('El pedido no tiene fecha de entrega registrada')

  // Enforce 48-hour window
  const deliveredAt = new Date(order.delivered_at).getTime()
  if (Date.now() - deliveredAt > RATING_WINDOW_MS) {
    throw new Error('La ventana de calificación de 48 horas ha expirado')
  }

  const { data, error } = await supabase
    .from('rider_ratings')
    .insert({
      delivery_order_id: input.delivery_order_id,
      rider_id:          order.rider_id,
      restaurant_id:     restaurantId,
      rated_by:          ratedBy,
      stars:             input.stars,
      comment:           input.comment ?? null,
    })
    .select()
    .single()

  // Handle unique constraint violation (duplicate rating)
  if (error?.code === '23505') {
    throw new Error('Este pedido ya fue calificado')
  }
  if (error) throw new Error(error.message)

  return data as RiderRating
}

// ── Rating history ────────────────────────────────────────────────────────────

export interface RatingFilters {
  from?:  string   // ISO date
  to?:    string   // ISO date
  stars?: number   // exact star value filter
}

export async function getRatingsForRestaurant(
  restaurantId: string,
  filters: RatingFilters = {},
): Promise<RiderRating[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('rider_ratings')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  if (filters.from)  query = query.gte('created_at', filters.from)
  if (filters.to)    query = query.lte('created_at', filters.to)
  if (filters.stars) query = query.eq('stars', filters.stars)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as RiderRating[]
}

export async function getRatingsForRider(riderId: string): Promise<RiderRating[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('rider_ratings')
    .select('*')
    .eq('rider_id', riderId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as RiderRating[]
}
