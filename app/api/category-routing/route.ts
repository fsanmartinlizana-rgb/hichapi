import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ── /api/category-routing ────────────────────────────────────────────────────
// CRUD de menu_category_station: define a qué station(s) rutea cada categoría.
// Una categoría puede mapear a múltiples stations (ej: pizzas → Cocina Y Barra
// para notificación). Se marca is_primary en la principal.

const SetSchema = z.object({
  restaurant_id: z.string().uuid(),
  category_id:   z.string().uuid(),
  station_ids:   z.array(z.string().uuid()).default([]),
  primary_id:    z.string().uuid().nullish(),
})

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  const categoryId   = req.nextUrl.searchParams.get('category_id')

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  const query = supabase
    .from('menu_category_station')
    .select('id, category_id, station_id, is_primary, stations(id, name, kind, location_id, locations(id, name))')
    .order('category_id')

  const { data } = categoryId ? await query.eq('category_id', categoryId) : await query

  return NextResponse.json({ routes: data ?? [] })
}

// Reemplaza TODO el ruteo de una categoría con el set provisto.
// Uso: el front envía category_id + station_ids[] (lista completa) + primary_id.
// Borramos lo existente y creamos las nuevas filas. Idempotente.
export async function PUT(req: NextRequest) {
  let body: z.infer<typeof SetSchema>
  try {
    body = SetSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  // Verificar que la categoría pertenece a algo que el user puede administrar
  // (misma brand que restaurant_id o el mismo restaurant).
  const { data: cat } = await supabase
    .from('menu_categories')
    .select('id, brand_id, restaurant_id')
    .eq('id', body.category_id)
    .maybeSingle()

  if (!cat) return NextResponse.json({ error: 'Categoría no existe' }, { status: 404 })

  const { data: rest } = await supabase
    .from('restaurants')
    .select('brand_id')
    .eq('id', body.restaurant_id)
    .maybeSingle()

  const sameBrand      = cat.brand_id && rest?.brand_id && cat.brand_id === rest.brand_id
  const sameRestaurant = cat.restaurant_id === body.restaurant_id
  if (!sameBrand && !sameRestaurant) {
    return NextResponse.json({ error: 'Categoría no pertenece a esta marca' }, { status: 403 })
  }

  // Wipe + recrear
  await supabase.from('menu_category_station').delete().eq('category_id', body.category_id)

  if (body.station_ids.length === 0) {
    return NextResponse.json({ routes: [] })
  }

  const rows = body.station_ids.map(sid => ({
    category_id: body.category_id,
    station_id:  sid,
    is_primary:  body.primary_id ? sid === body.primary_id : false,
  }))

  // Si no marcaron primary_id pero hay stations, la primera es primary
  if (!body.primary_id && rows.length > 0) rows[0].is_primary = true

  const { data, error } = await supabase
    .from('menu_category_station')
    .insert(rows)
    .select('*')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ routes: data ?? [] })
}
