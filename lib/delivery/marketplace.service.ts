/**
 * lib/delivery/marketplace.service.ts
 *
 * MarketplaceService — Haversine distance, filters, sorting.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8
 */
import { createAdminClient } from '@/lib/supabase/server'
import { haversineDistance } from './route-engine.service'
import type { MarketplaceRestaurant, DeliveryZone, DeliveryFeeTier, VehicleType } from './types'

export interface MarketplaceFilters {
  vehicle_type?: VehicleType
  min_fee?: number
}

export async function getMarketplaceListings(
  riderLat: number | null,
  riderLng: number | null,
  filters: MarketplaceFilters = {},
): Promise<MarketplaceRestaurant[]> {
  const supabase = createAdminClient()

  // Fetch active restaurants with at least one active delivery zone
  const { data: zones, error: zonesError } = await supabase
    .from('delivery_zones')
    .select('*, restaurants!inner(id, name, cuisine_type, neighborhood, active)')
    .eq('active', true)
    .eq('restaurants.active', true)

  if (zonesError) throw new Error(zonesError.message)
  if (!zones || zones.length === 0) return []

  // Group zones by restaurant
  const restaurantMap = new Map<string, {
    restaurant: { id: string; name: string; cuisine_type: string | null; neighborhood: string | null }
    zones: DeliveryZone[]
  }>()

  for (const z of zones) {
    const rest = z.restaurants as { id: string; name: string; cuisine_type: string | null; neighborhood: string | null }
    if (!restaurantMap.has(rest.id)) {
      restaurantMap.set(rest.id, { restaurant: rest, zones: [] })
    }
    restaurantMap.get(rest.id)!.zones.push({
      id:            z.id,
      restaurant_id: z.restaurant_id,
      radius_km:     z.radius_km,
      center_lat:    z.center_lat,
      center_lng:    z.center_lng,
      active:        z.active,
      created_at:    z.created_at,
    })
  }

  const restaurantIds = [...restaurantMap.keys()]

  // Fetch fee tiers for all restaurants
  const { data: tiers } = await supabase
    .from('delivery_fee_tiers')
    .select('*')
    .in('restaurant_id', restaurantIds)

  const tiersByRestaurant = new Map<string, DeliveryFeeTier[]>()
  for (const t of tiers ?? []) {
    if (!tiersByRestaurant.has(t.restaurant_id)) {
      tiersByRestaurant.set(t.restaurant_id, [])
    }
    tiersByRestaurant.get(t.restaurant_id)!.push(t as DeliveryFeeTier)
  }

  // Fetch pending order counts
  const { data: pendingOrders } = await supabase
    .from('delivery_orders')
    .select('restaurant_id')
    .in('restaurant_id', restaurantIds)
    .eq('status', 'pending_assignment')

  const pendingCountByRestaurant = new Map<string, number>()
  for (const o of pendingOrders ?? []) {
    pendingCountByRestaurant.set(
      o.restaurant_id,
      (pendingCountByRestaurant.get(o.restaurant_id) ?? 0) + 1,
    )
  }

  // Fetch average delivery times
  const { data: deliveredOrders } = await supabase
    .from('delivery_orders')
    .select('restaurant_id, picked_up_at, delivered_at')
    .in('restaurant_id', restaurantIds)
    .eq('status', 'delivered')
    .not('picked_up_at', 'is', null)
    .not('delivered_at', 'is', null)

  const avgTimeByRestaurant = new Map<string, number>()
  const timeSumMap = new Map<string, { sum: number; count: number }>()
  for (const o of deliveredOrders ?? []) {
    if (!o.picked_up_at || !o.delivered_at) continue
    const durationMin =
      (new Date(o.delivered_at).getTime() - new Date(o.picked_up_at).getTime()) / 60_000
    const entry = timeSumMap.get(o.restaurant_id) ?? { sum: 0, count: 0 }
    timeSumMap.set(o.restaurant_id, { sum: entry.sum + durationMin, count: entry.count + 1 })
  }
  for (const [id, { sum, count }] of timeSumMap) {
    avgTimeByRestaurant.set(id, Math.round(sum / count))
  }

  // Build listings
  const listings: MarketplaceRestaurant[] = []

  for (const [restaurantId, { restaurant, zones: restZones }] of restaurantMap) {
    const restTiers = tiersByRestaurant.get(restaurantId) ?? []
    const primaryZone = restZones[0]

    // Vehicle type filter: if tiers specify vehicle_types, check compatibility
    if (filters.vehicle_type) {
      const compatible = restTiers.some(
        t => t.vehicle_types.length === 0 || t.vehicle_types.includes(filters.vehicle_type!),
      )
      if (!compatible) continue
    }

    // Fee range
    const fees = restTiers.map(t => t.fee_clp)
    const feeMin = fees.length > 0 ? Math.min(...fees) : 0
    const feeMax = fees.length > 0 ? Math.max(...fees) : 0

    // Minimum fee filter
    if (filters.min_fee !== undefined && feeMax < filters.min_fee) continue

    // Distance from rider to restaurant zone center
    let distanceKm = 0
    if (riderLat !== null && riderLng !== null) {
      distanceKm = haversineDistance(
        riderLat,
        riderLng,
        primaryZone.center_lat,
        primaryZone.center_lng,
      )

      // Strict enforcement: if rider is outside the restaurant's delivery zone, exclude it
      if (distanceKm > primaryZone.radius_km) continue
    }

    listings.push({
      restaurant_id:        restaurantId,
      name:                 restaurant.name,
      cuisine_type:         restaurant.cuisine_type,
      neighborhood:         restaurant.neighborhood,
      distance_km:          Math.round(distanceKm * 10) / 10,
      fee_range:            { min: feeMin, max: feeMax },
      pending_orders_count: pendingCountByRestaurant.get(restaurantId) ?? 0,
      delivery_zone:        primaryZone,
      fee_tiers:            restTiers,
      avg_delivery_minutes: avgTimeByRestaurant.get(restaurantId) ?? null,
    })
  }

  // Sort by distance ascending; fallback to alphabetical when GPS unavailable
  if (riderLat !== null && riderLng !== null) {
    listings.sort((a, b) => a.distance_km - b.distance_km)
  } else {
    listings.sort((a, b) => a.name.localeCompare(b.name))
  }

  return listings
}
