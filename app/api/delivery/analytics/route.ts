/**
 * GET /api/delivery/analytics — delivery metrics for the restaurant
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.8
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/server'
import { AnalyticsQuerySchema } from '@/lib/delivery/types'
import type { DeliveryAnalytics, DailyVolume, StatusBreakdown, TopRider, RiderPublicProfile } from '@/lib/delivery/types'

export async function GET(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error: authError } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
  if (authError) return authError

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  // Default: last 30 days
  const defaultTo   = new Date().toISOString().split('T')[0]
  const defaultFrom = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0]

  const parsed = AnalyticsQuerySchema.safeParse({
    from: from ?? defaultFrom,
    to:   to   ?? defaultTo,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Fetch all delivery orders in range
  const { data: orders, error: ordersError } = await supabase
    .from('delivery_orders')
    .select('id, status, delivery_fee_clp, picked_up_at, delivered_at, rider_id, created_at')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', parsed.data.from)
    .lte('created_at', parsed.data.to + 'T23:59:59Z')

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 })

  const allOrders = orders ?? []

  // Totals
  type OrderRow = { id: string; status: string; delivery_fee_clp: number | null; picked_up_at: string | null; delivered_at: string | null; rider_id: string | null; created_at: string }
  const delivered  = allOrders.filter((o: OrderRow) => o.status === 'delivered')
  const failed     = allOrders.filter((o: OrderRow) => o.status === 'failed')
  const cancelled  = allOrders.filter((o: OrderRow) => o.status === 'cancelled')
  const assigned   = allOrders.filter((o: OrderRow) => !['pending_assignment', 'cancelled'].includes(o.status))

  const totalCompleted = delivered.length
  const successRate    = assigned.length > 0 ? totalCompleted / assigned.length : 0

  // Average delivery time (minutes)
  const durations = delivered
    .filter((o: OrderRow) => o.picked_up_at && o.delivered_at)
    .map((o: OrderRow) => (new Date(o.delivered_at!).getTime() - new Date(o.picked_up_at!).getTime()) / 60_000)
  const avgDeliveryMinutes = durations.length > 0
    ? Math.round(durations.reduce((s: number, d: number) => s + d, 0) / durations.length)
    : null

  // Total fees paid
  const totalFeesPaid = delivered.reduce((s: number, o: OrderRow) => s + (o.delivery_fee_clp ?? 0), 0)

  // Daily volumes
  const dailyMap = new Map<string, number>()
  for (const o of allOrders as OrderRow[]) {
    const day = o.created_at.split('T')[0]
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1)
  }
  const dailyVolumes: DailyVolume[] = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  // Status breakdown
  const statusBreakdown: StatusBreakdown = {
    delivered: totalCompleted,
    failed:    failed.length,
    cancelled: cancelled.length,
  }

  // Top 5 riders
  const riderCountMap = new Map<string, number>()
  for (const o of delivered as OrderRow[]) {
    if (o.rider_id) {
      riderCountMap.set(o.rider_id, (riderCountMap.get(o.rider_id) ?? 0) + 1)
    }
  }
  const topRiderIds = [...riderCountMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id)

  let topRiders: TopRider[] = []
  if (topRiderIds.length > 0) {
    const { data: riderProfiles } = await supabase
      .from('rider_profiles')
      .select('id, full_name, profile_photo_url, vehicle_type, vehicle_model, status, avg_rating, total_ratings')
      .in('id', topRiderIds)

    topRiders = topRiderIds
      .map(id => {
        const profile = riderProfiles?.find((r: { id: string }) => r.id === id)
        if (!profile) return null
        return {
          rider: profile as RiderPublicProfile,
          completed_count: riderCountMap.get(id) ?? 0,
        }
      })
      .filter((r): r is TopRider => r !== null)
  }

  // Average rider rating given by this restaurant
  const { data: ratings } = await supabase
    .from('rider_ratings')
    .select('stars')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', parsed.data.from)
    .lte('created_at', parsed.data.to + 'T23:59:59Z')

  const avgRiderRating = ratings && ratings.length > 0
    ? Math.round((ratings.reduce((s: number, r: { stars: number }) => s + r.stars, 0) / ratings.length) * 10) / 10
    : null

  const analytics: DeliveryAnalytics = {
    total_completed:      totalCompleted,
    avg_delivery_minutes: avgDeliveryMinutes,
    avg_rider_rating:     avgRiderRating,
    total_fees_paid_clp:  totalFeesPaid,
    success_rate:         Math.round(successRate * 1000) / 1000,
    daily_volumes:        dailyVolumes,
    status_breakdown:     statusBreakdown,
    top_riders:           topRiders,
  }

  return NextResponse.json(analytics)
}
