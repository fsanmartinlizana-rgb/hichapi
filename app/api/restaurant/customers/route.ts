/**
 * GET /api/restaurant/customers — comensales reconocidos del restaurante
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { listRestaurantCustomers } from '@/lib/customer/restaurant-customers'

export async function GET(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'x-restaurant-id requerido' }, { status: 400 })
  }

  const { error: authError } = await requireRestaurantRole(restaurantId, [
    'owner', 'admin', 'supervisor', 'garzon', 'super_admin',
  ])
  if (authError) return authError

  try {
    const customers = await listRestaurantCustomers(restaurantId)
    return NextResponse.json({ customers })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
