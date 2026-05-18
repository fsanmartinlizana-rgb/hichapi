import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/server'
import { DeliveryFeeTierSchema } from '@/lib/delivery/types'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error: authError } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
  if (authError) return authError

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('delivery_fee_tiers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('min_km', { ascending: true })

  if (error) {
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
  
  const PayloadSchema = z.object({
    tiers: z.array(DeliveryFeeTierSchema),
  })

  const parsed = PayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.issues }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 1. Remove all old tiers for this restaurant
  const { error: delError } = await supabase
    .from('delivery_fee_tiers')
    .delete()
    .eq('restaurant_id', restaurantId)

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 })
  }

  // 2. Insert new tiers
  if (parsed.data.tiers.length > 0) {
    const rows = parsed.data.tiers.map(t => ({
      restaurant_id: restaurantId,
      min_km: t.min_km,
      max_km: t.max_km,
      fee_clp: t.fee_clp,
      vehicle_types: t.vehicle_types,
    }))

    const { data, error: insError } = await supabase
      .from('delivery_fee_tiers')
      .insert(rows)
      .select()

    if (insError) {
      return NextResponse.json({ error: insError.message }, { status: 500 })
    }

    return NextResponse.json({ tiers: data })
  }

  return NextResponse.json({ tiers: [] })
}
