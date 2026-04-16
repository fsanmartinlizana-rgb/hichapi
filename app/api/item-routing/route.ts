import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ── /api/item-routing ────────────────────────────────────────────────────────
// Override de ruteo puntual por menu_item: si un plato necesita ir a una
// station distinta a la que dictó su categoría, se escribe acá.
// Una fila con location_id=NULL aplica a TODOS los locales.
// Una fila con location_id específico aplica solo en ese local.

const SetSchema = z.object({
  restaurant_id: z.string().uuid(),
  menu_item_id:  z.string().uuid(),
  station_id:    z.string().uuid().nullable(), // null = quitar override
  location_id:   z.string().uuid().nullable().default(null),
})

// GET: /api/item-routing?restaurant_id=X → devuelve todos los overrides
// GET: /api/item-routing?restaurant_id=X&menu_item_id=Y → solo los de ese item
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  const menuItemId   = req.nextUrl.searchParams.get('menu_item_id')

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  let q = supabase
    .from('menu_item_station_override')
    .select('id, menu_item_id, station_id, location_id, stations(id, name, kind, location_id, locations(id, name))')

  if (menuItemId) {
    q = q.eq('menu_item_id', menuItemId)
  } else {
    // Filtrar: solo overrides cuyos menu_items pertenecen a este restaurant
    const { data: itemIds } = await supabase
      .from('menu_items')
      .select('id')
      .eq('restaurant_id', restaurantId)
    const ids = ((itemIds ?? []) as { id: string }[]).map(i => i.id)
    if (ids.length === 0) return NextResponse.json({ overrides: [] })
    q = q.in('menu_item_id', ids)
  }

  const { data } = await q
  return NextResponse.json({ overrides: data ?? [] })
}

// PUT: set/replace override para un menu_item (una fila, location_id optional).
// Si station_id=null, elimina el override existente.
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

  // Verificar que el menu_item pertenece al restaurant
  const { data: item } = await supabase
    .from('menu_items')
    .select('id')
    .eq('id', body.menu_item_id)
    .eq('restaurant_id', body.restaurant_id)
    .maybeSingle()

  if (!item) return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })

  // Borrar override existente para ese item + location
  if (body.location_id) {
    await supabase
      .from('menu_item_station_override')
      .delete()
      .eq('menu_item_id', body.menu_item_id)
      .eq('location_id', body.location_id)
  } else {
    await supabase
      .from('menu_item_station_override')
      .delete()
      .eq('menu_item_id', body.menu_item_id)
      .is('location_id', null)
  }

  // Si station_id es null → solo borrar (quitar override)
  if (!body.station_id) {
    return NextResponse.json({ override: null })
  }

  // Insertar nuevo
  const { data, error } = await supabase
    .from('menu_item_station_override')
    .insert({
      menu_item_id: body.menu_item_id,
      station_id:   body.station_id,
      location_id:  body.location_id,
    })
    .select('id, menu_item_id, station_id, location_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ override: data })
}
