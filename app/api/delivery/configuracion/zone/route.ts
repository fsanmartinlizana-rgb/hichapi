import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/server'
import { DeliveryZoneSchema } from '@/lib/delivery/types'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error: authError } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
  if (authError) return authError

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .single()

  // Si no existe, no es error, devolvemos null o un default
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error: authError } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
  if (authError) return authError

  const body = await req.json()
  
  // Extend schema validation if we added 'active' boolean to the form
  const parsed = DeliveryZoneSchema.extend({ active: z.boolean().optional() }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.issues }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Find if zone already exists for this restaurant
  const { data: existing } = await supabase
    .from('delivery_zones')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .single()

  const payload = {
    radius_km: parsed.data.radius_km,
    center_lat: parsed.data.center_lat,
    center_lng: parsed.data.center_lng,
    active: parsed.data.active ?? true,
  }

  let dbResult
  
  if (existing) {
    dbResult = await supabase
      .from('delivery_zones')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
  } else {
    dbResult = await supabase
      .from('delivery_zones')
      .insert({ ...payload, restaurant_id: restaurantId })
      .select()
      .single()
  }

  if (dbResult.error) {
    console.error('Zone save DB Error:', dbResult.error)
    return NextResponse.json({ error: dbResult.error.message }, { status: 500 })
  }

  return NextResponse.json(dbResult.data)
}
