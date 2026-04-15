import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ── /api/stations ────────────────────────────────────────────────────────────
// CRUD de estaciones de preparación (cocina, barra, parrilla, postres, etc.)
// Una station vive en una location y puede apuntar a un print_server.

const STATION_KINDS = [
  'cocina','cocina_fria','cocina_caliente','parrilla','horno',
  'barra','postres','panaderia','otro',
] as const

const CreateSchema = z.object({
  restaurant_id:   z.string().uuid(),
  location_id:     z.string().uuid().nullish(),
  name:            z.string().min(1).max(120),
  kind:            z.enum(STATION_KINDS).default('cocina'),
  print_server_id: z.string().uuid().nullish(),
  color:           z.string().max(20).nullish(),
  sort_order:      z.number().int().optional(),
})

const UpdateSchema = z.object({
  id:              z.string().uuid(),
  restaurant_id:   z.string().uuid(),
  name:            z.string().min(1).max(120).optional(),
  kind:            z.enum(STATION_KINDS).optional(),
  location_id:     z.string().uuid().nullish(),
  print_server_id: z.string().uuid().nullish(),
  color:           z.string().max(20).nullish(),
  sort_order:      z.number().int().optional(),
  active:          z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  const locationId   = req.nextUrl.searchParams.get('location_id')

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor', 'garzon', 'cocina', 'anfitrion'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  let q = supabase
    .from('stations')
    .select('*, locations(name)')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true })

  if (locationId) q = q.eq('location_id', locationId)

  const { data } = await q
  return NextResponse.json({ stations: data ?? [] })
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof CreateSchema>
  try {
    body = CreateSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('stations')
    .insert({
      restaurant_id:   body.restaurant_id,
      location_id:     body.location_id ?? null,
      name:            body.name,
      kind:            body.kind,
      print_server_id: body.print_server_id ?? null,
      color:           body.color ?? null,
      sort_order:      body.sort_order ?? 0,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ station: data })
}

export async function PATCH(req: NextRequest) {
  let body: z.infer<typeof UpdateSchema>
  try {
    body = UpdateSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { id, restaurant_id, ...updates } = body

  const { data, error } = await supabase
    .from('stations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurant_id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ station: data })
}

export async function DELETE(req: NextRequest) {
  const id           = req.nextUrl.searchParams.get('id')
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')

  if (!id || !restaurantId) {
    return NextResponse.json({ error: 'id y restaurant_id requeridos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { error } = await supabase.from('stations').delete().eq('id', id).eq('restaurant_id', restaurantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
