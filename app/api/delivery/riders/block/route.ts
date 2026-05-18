/**
 * POST /api/delivery/riders/block — block a rider for this restaurant
 * Requirements: 7.11
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantRole, requireUser } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const BlockRiderSchema = z.object({
  rider_id: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { user, error: userError } = await requireUser()
  if (userError || !user) return userError ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error: authError } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
  if (authError) return authError

  const body = await req.json()
  const parsed = BlockRiderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('rider_blocked_restaurants')
    .insert({
      restaurant_id: restaurantId,
      rider_id:      parsed.data.rider_id,
      blocked_by:    user.id,
    })

  if (error?.code === '23505') {
    return NextResponse.json({ error: 'Este rider ya está bloqueado para este restaurante' }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 201 })
}
