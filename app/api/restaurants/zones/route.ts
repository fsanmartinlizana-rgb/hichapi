import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ══════════════════════════════════════════════════════════════════════════════
//  GET  /api/restaurants/zones?restaurant_id=xxx   → list zones
//  POST /api/restaurants/zones                      → create zone
//  PATCH /api/restaurants/zones                     → update zone
//  DELETE /api/restaurants/zones?id=xxx            → remove zone
//
//  Cada restaurante crea sus zonas con nombre y color custom (ej. "Terraza",
//  "Salón Principal", "Pet-friendly"). Se usan como filtro en /mesas.
// ══════════════════════════════════════════════════════════════════════════════

const ZoneCreateSchema = z.object({
  restaurant_id: z.string().uuid(),
  name:          z.string().trim().min(1).max(40),
  color:         z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sort_order:    z.number().int().min(0).max(999).optional(),
})

const ZoneUpdateSchema = z.object({
  id:    z.string().uuid(),
  restaurant_id: z.string().uuid(),
  name:       z.string().trim().min(1).max(40).optional(),
  color:      z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sort_order: z.number().int().min(0).max(999).optional(),
})

export async function GET(req: NextRequest) {
  const restId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }
  const { error: authErr } = await requireRestaurantRole(restId, ['owner', 'admin', 'supervisor', 'garzon', 'anfitrion'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('restaurant_zones')
    .select('id, name, color, sort_order')
    .eq('restaurant_id', restId)
    .order('sort_order', { ascending: true })
    .order('name')

  if (error) {
    return NextResponse.json({ error: 'No se pudo cargar zonas' }, { status: 500 })
  }
  return NextResponse.json({ zones: data ?? [] })
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof ZoneCreateSchema>
  try {
    body = ZoneCreateSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('restaurant_zones')
    .insert({
      restaurant_id: body.restaurant_id,
      name:          body.name,
      color:         body.color ?? '#6B7280',
      sort_order:    body.sort_order ?? 0,
    })
    .select('id, name, color, sort_order')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe una zona con ese nombre' }, { status: 409 })
    }
    return NextResponse.json({ error: 'No se pudo crear zona' }, { status: 500 })
  }
  return NextResponse.json({ zone: data })
}

export async function PATCH(req: NextRequest) {
  let body: z.infer<typeof ZoneUpdateSchema>
  try {
    body = ZoneUpdateSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin'])
  if (authErr) return authErr

  const update: Record<string, unknown> = {}
  if (body.name !== undefined)       update.name = body.name
  if (body.color !== undefined)      update.color = body.color
  if (body.sort_order !== undefined) update.sort_order = body.sort_order

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('restaurant_zones')
    .update(update)
    .eq('id', body.id)
    .eq('restaurant_id', body.restaurant_id)
    .select('id, name, color, sort_order')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo actualizar zona' }, { status: 500 })
  }
  return NextResponse.json({ zone: data })
}

export async function DELETE(req: NextRequest) {
  const id    = req.nextUrl.searchParams.get('id')
  const restId = req.nextUrl.searchParams.get('restaurant_id')
  if (!id || !restId) {
    return NextResponse.json({ error: 'id y restaurant_id requeridos' }, { status: 400 })
  }
  const { error: authErr } = await requireRestaurantRole(restId, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  // Desvincular mesas que usan esta zona (name-based FK soft) antes de borrar
  const { data: zone } = await supabase
    .from('restaurant_zones')
    .select('name')
    .eq('id', id)
    .eq('restaurant_id', restId)
    .single()

  if (zone?.name) {
    await supabase
      .from('tables')
      .update({ zone: null })
      .eq('restaurant_id', restId)
      .eq('zone', zone.name)
  }

  const { error } = await supabase
    .from('restaurant_zones')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restId)

  if (error) {
    return NextResponse.json({ error: 'No se pudo eliminar zona' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
