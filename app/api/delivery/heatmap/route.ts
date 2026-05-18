/**
 * GET /api/delivery/heatmap — heat map data (rider or restaurant admin)
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 4.8
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRider, requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { getHeatMapData } from '@/lib/delivery/heatmap.service'
import type { TimeOfDay } from '@/lib/delivery/types'

export async function GET(req: NextRequest) {
  // Dual auth: rider OR restaurant admin
  const { rider } = await requireRider()
  if (!rider) {
    const restaurantId = req.headers.get('x-restaurant-id')
    if (!restaurantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { error: authError } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
    if (authError) return authError
  }

  const { searchParams } = req.nextUrl
  const days          = searchParams.get('days')         ? parseInt(searchParams.get('days')!, 10) : undefined
  const time_of_day   = searchParams.get('time_of_day')  as TimeOfDay | null
  const day_of_week   = searchParams.get('day_of_week')  ? parseInt(searchParams.get('day_of_week')!, 10) : undefined
  const restaurant_id = searchParams.get('restaurant_id') ?? undefined

  try {
    const cells = await getHeatMapData({
      days,
      time_of_day: time_of_day ?? undefined,
      day_of_week,
      restaurant_id,
    })
    return NextResponse.json(cells)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
