/**
 * GET/PATCH /api/restaurant/customers/config — geofence comensal + multiplicador puntos
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { GeofenceConfigSchema } from '@/lib/customer/schemas'
import {
  getCustomerGeofenceConfig,
  updateCustomerGeofenceConfig,
} from '@/lib/customer/restaurant-customers'

export async function GET(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'x-restaurant-id requerido' }, { status: 400 })
  }

  const { error: authError } = await requireRestaurantRole(restaurantId, [
    'owner', 'admin', 'super_admin',
  ])
  if (authError) return authError

  try {
    const config = await getCustomerGeofenceConfig(restaurantId)
    return NextResponse.json({ config })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'x-restaurant-id requerido' }, { status: 400 })
  }

  const { error: authError } = await requireRestaurantRole(restaurantId, [
    'owner', 'admin', 'super_admin',
  ])
  if (authError) return authError

  try {
    const body = await req.json()
    const parsed = GeofenceConfigSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    const config = await updateCustomerGeofenceConfig(restaurantId, parsed.data)
    return NextResponse.json({ config })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
