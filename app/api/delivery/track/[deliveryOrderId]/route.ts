/**
 * GET /api/delivery/track/[deliveryOrderId] — public endpoint for customers to track their order
 * Requirements: 7.10
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deliveryOrderId: string }> },
) {
  const { deliveryOrderId } = await params

  if (!deliveryOrderId || deliveryOrderId === 'undefined') {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // We only return public tracking data, no sensitive rider info
  const { data: order, error } = await supabase
    .from('delivery_orders')
    .select(`
      id,
      status,
      created_at,
      pickup_at,
      delivered_at,
      client_name,
      restaurant:restaurants (
        id,
        name,
        slug,
        address
      ),
      rider:rider_profiles (
        id,
        full_name,
        phone,
        vehicle_type,
        vehicle_plate,
        last_lat,
        last_lng
      )
    `)
    .eq('id', deliveryOrderId)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  return NextResponse.json(order)
}
