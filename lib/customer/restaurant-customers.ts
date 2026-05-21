/**
 * lib/customer/restaurant-customers.ts
 *
 * Consultas del panel del restaurante sobre comensales reconocidos.
 * Requirements: 7.5, 7.6, 10.5
 */
import { createAdminClient } from '@/lib/supabase/server'

export interface RestaurantCustomerSummary {
  customer_id: string
  display_name: string
  loyalty_points: number
  visit_count: number
  last_visit_at: string | null
}

export interface TableCustomerBadge {
  customer_id: string
  display_name: string
  loyalty_points: number
  visit_count: number
}

export interface CustomerGeofenceRestaurantConfig {
  geofence_enabled: boolean
  geofence_radius_m: number | null
  geofence_message: string | null
  points_multiplier: number
  lat: number | null
  lng: number | null
}

/** Lista comensales que tienen al menos un pedido en el restaurante. */
export async function listRestaurantCustomers(
  restaurantId: string,
): Promise<RestaurantCustomerSummary[]> {
  const supabase = createAdminClient()

  const { data: presencial, error: oErr } = await supabase
    .from('orders')
    .select('customer_id, created_at')
    .eq('restaurant_id', restaurantId)
    .not('customer_id', 'is', null)

  if (oErr) throw new Error(oErr.message)

  const { data: delivery, error: dErr } = await supabase
    .from('delivery_orders')
    .select('customer_id, created_at')
    .eq('restaurant_id', restaurantId)
    .not('customer_id', 'is', null)

  if (dErr) throw new Error(dErr.message)

  const stats = new Map<string, { visits: number; last: string | null }>()

  for (const row of [...(presencial ?? []), ...(delivery ?? [])]) {
    const cid = row.customer_id as string
    const at = row.created_at as string
    const prev = stats.get(cid)
    if (!prev) {
      stats.set(cid, { visits: 1, last: at })
    } else {
      prev.visits += 1
      if (!prev.last || at > prev.last) prev.last = at
    }
  }

  if (stats.size === 0) return []

  const ids = [...stats.keys()]
  const { data: profiles, error: pErr } = await supabase
    .from('customer_profiles')
    .select('id, display_name, loyalty_points')
    .in('id', ids)

  if (pErr) throw new Error(pErr.message)

  type ProfileRow = { id: string; display_name: string; loyalty_points: number }
  const profileMap = new Map<string, ProfileRow>(
    (profiles ?? []).map((p: ProfileRow) => [p.id, p]),
  )

  return ids
    .map((customer_id) => {
      const p = profileMap.get(customer_id)
      const s = stats.get(customer_id)!
      return {
        customer_id,
        display_name: p?.display_name ?? 'Comensal',
        loyalty_points: p?.loyalty_points ?? 0,
        visit_count: s.visits,
        last_visit_at: s.last,
      }
    })
    .sort((a, b) => {
      const ta = a.last_visit_at ? new Date(a.last_visit_at).getTime() : 0
      const tb = b.last_visit_at ? new Date(b.last_visit_at).getTime() : 0
      return tb - ta
    })
}

/** Comensal reconocido en la comanda activa más reciente de cada mesa. */
export async function getActiveCustomersByTable(
  restaurantId: string,
): Promise<Record<string, TableCustomerBadge>> {
  const supabase = createAdminClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, table_id, customer_id, created_at')
    .eq('restaurant_id', restaurantId)
    .not('customer_id', 'is', null)
    .not('status', 'in', '("paid","cancelled")')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const latestByTable = new Map<string, string>()
  for (const o of orders ?? []) {
    const tid = o.table_id as string
    if (!latestByTable.has(tid)) {
      latestByTable.set(tid, o.customer_id as string)
    }
  }

  if (latestByTable.size === 0) return {}

  const customerIds = [...new Set(latestByTable.values())]
  const { data: profiles } = await supabase
    .from('customer_profiles')
    .select('id, display_name, loyalty_points')
    .in('id', customerIds)

  const visitCounts = await countVisitsForCustomers(restaurantId, customerIds)
  type ProfileRow = { id: string; display_name: string; loyalty_points: number }
  const profileMap = new Map<string, ProfileRow>(
    (profiles ?? []).map((p: ProfileRow) => [p.id, p]),
  )

  const result: Record<string, TableCustomerBadge> = {}
  for (const [tableId, customerId] of latestByTable) {
    const p = profileMap.get(customerId)
    if (!p) continue
    result[tableId] = {
      customer_id: customerId,
      display_name: p.display_name,
      loyalty_points: p.loyalty_points ?? 0,
      visit_count: visitCounts.get(customerId) ?? 1,
    }
  }
  return result
}

async function countVisitsForCustomers(
  restaurantId: string,
  customerIds: string[],
): Promise<Map<string, number>> {
  const supabase = createAdminClient()
  const counts = new Map<string, number>()
  for (const id of customerIds) counts.set(id, 0)

  const { data: oRows } = await supabase
    .from('orders')
    .select('customer_id')
    .eq('restaurant_id', restaurantId)
    .in('customer_id', customerIds)

  const { data: dRows } = await supabase
    .from('delivery_orders')
    .select('customer_id')
    .eq('restaurant_id', restaurantId)
    .in('customer_id', customerIds)

  for (const row of [...(oRows ?? []), ...(dRows ?? [])]) {
    const cid = row.customer_id as string
    counts.set(cid, (counts.get(cid) ?? 0) + 1)
  }
  return counts
}

export async function getCustomerGeofenceConfig(
  restaurantId: string,
): Promise<CustomerGeofenceRestaurantConfig | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select('geofence_enabled, geofence_radius_m, geofence_message, points_multiplier, lat, lng')
    .eq('id', restaurantId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    geofence_enabled: data.geofence_enabled as boolean,
    geofence_radius_m: data.geofence_radius_m as number | null,
    geofence_message: data.geofence_message as string | null,
    points_multiplier: Number(data.points_multiplier ?? 1),
    lat: data.lat as number | null,
    lng: data.lng as number | null,
  }
}

export async function updateCustomerGeofenceConfig(
  restaurantId: string,
  input: {
    geofence_enabled: boolean
    geofence_radius_m?: number
    geofence_message?: string
    points_multiplier?: number
  },
): Promise<CustomerGeofenceRestaurantConfig> {
  const supabase = createAdminClient()
  const updates: Record<string, unknown> = {
    geofence_enabled: input.geofence_enabled,
  }
  if (input.geofence_radius_m !== undefined) updates.geofence_radius_m = input.geofence_radius_m
  if (input.geofence_message !== undefined) updates.geofence_message = input.geofence_message
  if (input.points_multiplier !== undefined) updates.points_multiplier = input.points_multiplier

  const { data, error } = await supabase
    .from('restaurants')
    .update(updates)
    .eq('id', restaurantId)
    .select('geofence_enabled, geofence_radius_m, geofence_message, points_multiplier, lat, lng')
    .single()

  if (error) throw new Error(error.message)
  return {
    geofence_enabled: data.geofence_enabled as boolean,
    geofence_radius_m: data.geofence_radius_m as number | null,
    geofence_message: data.geofence_message as string | null,
    points_multiplier: Number(data.points_multiplier ?? 1),
    lat: data.lat as number | null,
    lng: data.lng as number | null,
  }
}

export interface CustomerRatingForRestaurant {
  id: string
  stars: number
  comment: string | null
  created_at: string
  order_type: string
  entity_type: string
}

/** Calificaciones de comensales hacia este restaurante o sus riders. */
export async function getCustomerRatingsForRestaurant(
  restaurantId: string,
): Promise<CustomerRatingForRestaurant[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('customer_ratings')
    .select('id, stars, comment, created_at, order_type, entity_type, entity_id')
    .or(`entity_type.eq.restaurant,entity_type.eq.rider`)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)

  type RatingRow = {
    id: string
    stars: number
    comment: string | null
    created_at: string
    order_type: string
    entity_type: string
    entity_id: string
  }

  const rows = (data ?? []) as RatingRow[]
  const restaurantRatings = rows.filter(
    (r: RatingRow) => r.entity_type === 'restaurant' && r.entity_id === restaurantId,
  )

  const { data: riders } = await supabase
    .from('rider_profiles')
    .select('id')
    .eq('restaurant_id', restaurantId)

  const riderIds = new Set((riders ?? []).map((r: { id: string }) => r.id))
  const riderRatings = rows.filter(
    (r: RatingRow) => r.entity_type === 'rider' && riderIds.has(r.entity_id),
  )

  return [...restaurantRatings, ...riderRatings]
    .map((r: RatingRow) => ({
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      created_at: r.created_at,
      order_type: r.order_type,
      entity_type: r.entity_type,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}
