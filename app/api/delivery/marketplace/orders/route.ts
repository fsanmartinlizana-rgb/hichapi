/**
 * GET /api/delivery/marketplace/orders — list pending delivery orders for a restaurant
 * Used by riders to browse available orders before accepting one.
 * Requires rider auth (Bearer token).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRider } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { error } = await requireRider()
  if (error) return error

  const { searchParams } = req.nextUrl
  const restaurantId = searchParams.get('restaurant_id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id es requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error: dbError } = await supabase
    .from('delivery_orders')
    .select('id, client_name, client_phone, pickup_address, delivery_address, total_clp, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'pending_assignment')
    .order('created_at', { ascending: true })

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
