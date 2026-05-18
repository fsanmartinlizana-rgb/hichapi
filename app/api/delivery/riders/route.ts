/**
 * GET /api/delivery/riders — list riders who have worked with this restaurant
 * Requirements: 7.10, 10.6
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/server'
import type { RiderPublicProfile } from '@/lib/delivery/types'

export async function GET(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error: authError } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
  if (authError) return authError

  const supabase = createAdminClient()

  // Get distinct rider IDs who completed at least 1 delivery for this restaurant
  const { data: orders, error: ordersError } = await supabase
    .from('delivery_orders')
    .select('rider_id')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'delivered')
    .not('rider_id', 'is', null)

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 })

  const riderIds = [...new Set((orders ?? []).map((o: { rider_id: string | null }) => o.rider_id).filter(Boolean))]
  if (riderIds.length === 0) return NextResponse.json([])

  // Fetch public profiles only (no national_id, no doc URLs)
  const { data: profiles, error: profilesError } = await supabase
    .from('rider_profiles')
    .select('id, full_name, profile_photo_url, vehicle_type, vehicle_model, status, avg_rating, total_ratings')
    .in('id', riderIds)

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 })

  // Count completed deliveries per rider for this restaurant
  const countMap = new Map<string, number>()
  for (const o of orders ?? []) {
    const order = o as { rider_id: string | null }
    if (order.rider_id) countMap.set(order.rider_id, (countMap.get(order.rider_id) ?? 0) + 1)
  }

  const result = (profiles ?? []).map((p: RiderPublicProfile & { id: string }) => ({
    ...(p as RiderPublicProfile),
    completed_deliveries: countMap.get(p.id) ?? 0,
  }))

  return NextResponse.json(result)
}
