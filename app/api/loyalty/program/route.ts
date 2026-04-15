import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { z } from 'zod'

/**
 * GET /api/loyalty/program?restaurant_id=…    → current program + rewards
 * POST /api/loyalty/program                    → upsert program (admin only)
 */

const UpsertSchema = z.object({
  restaurant_id:          z.string().uuid(),
  name:                   z.string().min(1).max(80).optional(),
  active:                 z.boolean().optional(),
  mechanic:               z.enum(['stamps', 'points', 'both']).optional(),
  stamps_per_reward:      z.number().int().min(1).max(100).optional(),
  stamp_trigger:          z.enum(['per_visit', 'per_order', 'per_amount']).optional(),
  stamp_amount_threshold: z.number().int().min(100).nullish(),
  points_per_clp:         z.number().min(0).max(1).optional(),
  welcome_points:         z.number().int().min(0).max(100_000).optional(),
  multi_location:         z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })

  const { error } = await requireRestaurantRole(restaurantId)
  if (error) return error

  const supabase = createAdminClient()
  const { data: program } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  const [{ data: rewards }, { data: multipliers }] = await Promise.all([
    program
      ? supabase.from('reward_catalog').select('*').eq('program_id', program.id).order('points_cost', { ascending: true, nullsFirst: true })
      : Promise.resolve({ data: [] }),
    program
      ? supabase.from('multiplier_rules').select('*').eq('program_id', program.id)
      : Promise.resolve({ data: [] }),
  ])

  return NextResponse.json({ program, rewards: rewards ?? [], multipliers: multipliers ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = UpsertSchema.parse(body)

    const { error: authErr } = await requireRestaurantRole(data.restaurant_id, ['owner', 'admin', 'super_admin'])
    if (authErr) return authErr

    const supabase = createAdminClient()

    const { data: existing } = await supabase
      .from('loyalty_programs')
      .select('id')
      .eq('restaurant_id', data.restaurant_id)
      .maybeSingle()

    if (existing) {
      const { restaurant_id: _ignore, ...patch } = data
      void _ignore
      const { data: updated, error } = await supabase
        .from('loyalty_programs')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ program: updated })
    } else {
      const { data: created, error } = await supabase
        .from('loyalty_programs')
        .insert({ ...data })
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ program: created })
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
