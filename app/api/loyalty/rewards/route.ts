import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { z } from 'zod'

/**
 * Admin CRUD for reward_catalog.
 * POST   — create reward
 * PATCH  — update reward
 * DELETE — soft-delete (active=false)
 */

const Base = {
  restaurant_id: z.string().uuid(),
}

const CreateSchema = z.object({
  ...Base,
  type:        z.enum(['free_item', 'discount_percent', 'discount_amount', 'free_category']),
  name:        z.string().min(1).max(80),
  description: z.string().max(240).optional(),
  value:       z.record(z.string(), z.unknown()).default({}),
  points_cost: z.number().int().min(1).nullish(),
  stamps_cost: z.number().int().min(1).nullish(),
  valid_days:  z.record(z.string(), z.unknown()).nullish(),
  active:      z.boolean().default(true),
}).refine(d => d.points_cost != null || d.stamps_cost != null, {
  message: 'Se requiere al menos points_cost o stamps_cost',
})

const UpdateSchema = z.object({
  ...Base,
  id:          z.string().uuid(),
  type:        z.enum(['free_item', 'discount_percent', 'discount_amount', 'free_category']).optional(),
  name:        z.string().min(1).max(80).optional(),
  description: z.string().max(240).nullish(),
  value:       z.record(z.string(), z.unknown()).optional(),
  points_cost: z.number().int().min(1).nullish(),
  stamps_cost: z.number().int().min(1).nullish(),
  valid_days:  z.record(z.string(), z.unknown()).nullish(),
  active:      z.boolean().optional(),
})

const DeleteSchema = z.object({
  ...Base,
  id: z.string().uuid(),
})

async function ensureAdmin(restaurantId: string) {
  return await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
}

async function getProgramId(restaurantId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('loyalty_programs')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  return data?.id as string | undefined
}

export async function POST(req: NextRequest) {
  try {
    const data = CreateSchema.parse(await req.json())
    const { error: authErr } = await ensureAdmin(data.restaurant_id)
    if (authErr) return authErr

    const programId = await getProgramId(data.restaurant_id)
    if (!programId) return NextResponse.json({ error: 'Crea primero el programa de fidelización' }, { status: 400 })

    const supabase = createAdminClient()
    const { data: reward, error } = await supabase
      .from('reward_catalog')
      .insert({
        program_id: programId,
        restaurant_id: data.restaurant_id,
        type: data.type,
        name: data.name,
        description: data.description ?? null,
        value: data.value,
        points_cost: data.points_cost ?? null,
        stamps_cost: data.stamps_cost ?? null,
        valid_days: data.valid_days ?? null,
        active: data.active,
      })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reward })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const data = UpdateSchema.parse(await req.json())
    const { error: authErr } = await ensureAdmin(data.restaurant_id)
    if (authErr) return authErr

    const supabase = createAdminClient()
    const { id, restaurant_id, ...patch } = data
    void restaurant_id
    const { data: reward, error } = await supabase
      .from('reward_catalog')
      .update(patch)
      .eq('id', id)
      .eq('restaurant_id', data.restaurant_id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reward })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const data = DeleteSchema.parse(await req.json())
    const { error: authErr } = await ensureAdmin(data.restaurant_id)
    if (authErr) return authErr

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('reward_catalog')
      .update({ active: false })
      .eq('id', data.id)
      .eq('restaurant_id', data.restaurant_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
