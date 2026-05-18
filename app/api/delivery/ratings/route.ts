/**
 * GET  /api/delivery/ratings — rating history for the restaurant
 * POST /api/delivery/ratings — submit a rider rating
 * Requirements: 6.2, 6.7, 6.8, 6.9
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantRole, requireUser } from '@/lib/supabase/auth-guard'
import { CreateRiderRatingSchema } from '@/lib/delivery/types'
import { submitRating, getRatingsForRestaurant } from '@/lib/delivery/rating.service'

export async function GET(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error: authError } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
  if (authError) return authError

  const { searchParams } = req.nextUrl
  const from  = searchParams.get('from')  ?? undefined
  const to    = searchParams.get('to')    ?? undefined
  const stars = searchParams.get('stars') ? parseInt(searchParams.get('stars')!, 10) : undefined

  try {
    const ratings = await getRatingsForRestaurant(restaurantId, { from, to, stars })
    return NextResponse.json(ratings)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const restaurantId = req.headers.get('x-restaurant-id')
  if (!restaurantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { user, error: authError } = await requireUser()
  if (authError || !user) return authError ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error: roleError } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
  if (roleError) return roleError

  const body = await req.json()
  const parsed = CreateRiderRatingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const rating = await submitRating(restaurantId, user.id, parsed.data)
    return NextResponse.json(rating, { status: 201 })
  } catch (err: any) {
    if (err.message?.includes('ya fue calificado')) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    if (err.message?.includes('48 horas') || err.message?.includes('entregados')) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
