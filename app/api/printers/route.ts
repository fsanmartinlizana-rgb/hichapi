import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

const KINDS = ['cocina', 'barra', 'caja', 'otro'] as const

const CreateSchema = z.object({
  restaurant_id: z.string().uuid(),
  name:          z.string().min(1).max(60).transform(s => s.toUpperCase().trim()),
  description:   z.string().max(200).optional(),
  kind:          z.enum(KINDS).default('cocina'),
})

const UpdateSchema = z.object({
  id:            z.string().uuid(),
  restaurant_id: z.string().uuid(),
  name:          z.string().min(1).max(60).transform(s => s.toUpperCase().trim()).optional(),
  description:   z.string().max(200).optional(),
  kind:          z.enum(KINDS).optional(),
  active:        z.boolean().optional(),
})

// GET /api/printers?restaurant_id=...
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, [
    'owner', 'admin', 'supervisor', 'garzon', 'waiter', 'anfitrion', 'cocina', 'super_admin',
  ])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('printers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('kind')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ printers: data ?? [] })
}

// POST /api/printers
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

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin', 'super_admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('printers')
    .insert({
      restaurant_id: body.restaurant_id,
      name:          body.name,
      description:   body.description ?? null,
      kind:          body.kind,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `Ya existe una impresora con el nombre "${body.name}"` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ printer: data }, { status: 201 })
}

// PATCH /api/printers
export async function PATCH(req: NextRequest) {
  let body: z.infer<typeof UpdateSchema>
  try {
    body = UpdateSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin', 'super_admin'])
  if (authErr) return authErr

  const { id, restaurant_id, ...updates } = body
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('printers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurant_id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ printer: data })
}

// DELETE /api/printers?id=...&restaurant_id=...
export async function DELETE(req: NextRequest) {
  const id           = req.nextUrl.searchParams.get('id')
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')

  if (!id || !restaurantId) {
    return NextResponse.json({ error: 'id y restaurant_id requeridos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('printers')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
