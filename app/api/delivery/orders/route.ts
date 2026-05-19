/**
 * GET  /api/delivery/orders  — list delivery orders for the restaurant
 * POST /api/delivery/orders  — create a delivery order manually
 * Requirements: 7.9, 8.5
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantRole, requireRider } from '@/lib/supabase/auth-guard'
import { CreateDeliveryOrderSchema } from '@/lib/delivery/types'
import { createDeliveryOrder, listOrdersForRestaurant } from '@/lib/delivery/delivery-order.service'
import { createAdminClient } from '@/lib/supabase/server'
export async function GET(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')

  // If restaurant header is present → restaurant admin view (takes priority)
  if (restaurantId) {
    const { error: authError } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor', 'super_admin'])
    if (authError) return authError

    const { searchParams } = req.nextUrl
    const statusParam = searchParams.get('status')
    const status = statusParam ? statusParam.split(',') : undefined
    const from   = searchParams.get('from')   ?? undefined
    const to     = searchParams.get('to')     ?? undefined

    try {
      const orders = await listOrdersForRestaurant(restaurantId, {
        status: status as any,
        from,
        to,
      })
      return NextResponse.json(orders)
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
  }

  // No restaurant header → try rider auth (mobile app)
  const { rider, error: riderError } = await requireRider()
  if (riderError || !rider) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const { data: orders, error } = await supabase
      .from('delivery_orders')
      .select('*')
      .eq('rider_id', rider.id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return NextResponse.json(orders)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error: authError } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
  if (authError) return authError

  const body = await req.json()
  const parsed = CreateDeliveryOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const order = await createDeliveryOrder(restaurantId, parsed.data)
    return NextResponse.json(order, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
