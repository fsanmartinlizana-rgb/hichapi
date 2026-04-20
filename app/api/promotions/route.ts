import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ── /api/promotions ────────────────────────────────────────────────────────
// CRUD de promociones por restaurant.
// Sprint 2026-04-20.

const KindEnum = z.enum(['discount_pct','discount_amount','2x1','combo','happy_hour'])

const CreateSchema = z.object({
  restaurant_id:   z.string().uuid(),
  name:            z.string().min(2).max(120),
  description:     z.string().max(400).optional(),
  kind:            KindEnum.default('discount_pct'),
  value:           z.number().int().min(0).max(100000).optional(),
  time_start:      z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  time_end:        z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  days_of_week:    z.array(z.number().int().min(0).max(6)).nullable().optional(),
  valid_from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  valid_until:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  channel_mesa:    z.boolean().default(true),
  channel_espera:  z.boolean().default(true),
  channel_chapi:   z.boolean().default(true),
  menu_item_ids:   z.array(z.string().uuid()).nullable().optional(),
  active:          z.boolean().default(true),
})

const UpdateSchema = CreateSchema.partial().extend({
  id:            z.string().uuid(),
  restaurant_id: z.string().uuid(),
})

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor', 'garzon', 'anfitrion', 'cocina'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('promotions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  return NextResponse.json({ promotions: data ?? [] })
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof CreateSchema>
  try {
    body = CreateSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { user, error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin', 'supervisor'])
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('promotions')
    .insert({
      ...body,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ promotion: data })
}

export async function PATCH(req: NextRequest) {
  let body: z.infer<typeof UpdateSchema>
  try {
    body = UpdateSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin', 'supervisor'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { id, restaurant_id: _rest, ...updates } = body
  void _rest
  const { data, error } = await supabase
    .from('promotions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', body.restaurant_id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ promotion: data })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!id || !restaurantId) return NextResponse.json({ error: 'id y restaurant_id requeridos' }, { status: 400 })

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { error } = await supabase.from('promotions').delete().eq('id', id).eq('restaurant_id', restaurantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
