import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ── POST /api/orders/internal ─────────────────────────────────────────────
// Crea una comanda desde el panel admin (garzón/owner/etc). Resuelve
// station_id por cada item para que el ruteo cross-local funcione igual
// que cuando el cliente ordena desde el QR público.
//
// Diferencia con /api/orders:
//   • /api/orders:    flujo público, requiere restaurant_slug + qr_token
//   • /api/orders/internal: flujo interno, requiere restaurant_id + table_id
//     (UUID directo) y auth de team_member del restaurant.
//
// Sprint 2026-04-21.

const CartItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  name:         z.string(),
  quantity:     z.number().int().min(1),
  unit_price:   z.number().min(0),
  note:         z.string().nullish(),
  // destination legacy — se sigue persistiendo para retrocompat con paneles
  // que no lean station_id todavía.
  destination:  z.enum(['cocina', 'barra', 'ninguno']).default('cocina'),
})

const CreateSchema = z.object({
  restaurant_id: z.string().uuid(),
  table_id:      z.string().uuid(),
  cart:          z.array(CartItemSchema).min(1),
  client_name:   z.string().optional(),
  notes:         z.string().optional(),
})

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

  // Auth: team_member (owner/admin/supervisor/garzon/waiter/anfitrion)
  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, [
    'owner', 'admin', 'supervisor', 'garzon', 'waiter', 'anfitrion', 'super_admin',
  ])
  if (authErr) return authErr

  const supabase = createAdminClient()

  // 1. Verificar que la mesa pertenece al restaurant y está disponible
  const { data: table, error: tableErr } = await supabase
    .from('tables')
    .select('id, status, label')
    .eq('id', body.table_id)
    .eq('restaurant_id', body.restaurant_id)
    .maybeSingle()

  if (tableErr || !table) {
    return NextResponse.json({ error: 'Mesa no encontrada en este restaurant' }, { status: 404 })
  }
  const t = table as { id: string; status: string | null; label: string | null }
  if (t.status === 'bloqueada') {
    return NextResponse.json({ error: `${t.label ?? 'Esta mesa'} está dividida. Elegí una sub-mesa.` }, { status: 409 })
  }

  // 2. Calcular total
  const total = body.cart.reduce((s, c) => s + c.unit_price * c.quantity, 0)

  // 3. Crear order
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      restaurant_id: body.restaurant_id,
      table_id:      body.table_id,
      status:        'pending',
      total,
      client_name:   body.client_name ?? null,
      notes:         body.notes ?? null,
    })
    .select('id')
    .single()

  if (orderErr || !order) {
    console.error('[orders/internal] order insert failed:', orderErr)
    return NextResponse.json(
      { error: 'No se pudo crear la comanda', details: orderErr?.message },
      { status: 500 },
    )
  }

  // 4. Resolver station_id por cada item (misma lógica que /api/orders).
  //    Orden: override puntual → category routing → null (fallback legacy
  //    que se maneja por destination).
  const menuItemIds = body.cart.map(c => c.menu_item_id)
  const { data: menuRows } = await supabase
    .from('menu_items')
    .select('id, destination, category_id')
    .in('id', menuItemIds)
  type MenuRow = { id: string; destination: string | null; category_id: string | null }
  const menuRowsTyped = (menuRows ?? []) as MenuRow[]

  const { data: overridesRows } = await supabase
    .from('menu_item_station_override')
    .select('menu_item_id, station_id, location_id')
    .in('menu_item_id', menuItemIds)
    .is('location_id', null)
  const overrideByItem = new Map<string, string>(
    ((overridesRows ?? []) as { menu_item_id: string; station_id: string }[])
      .map(o => [o.menu_item_id, o.station_id]),
  )

  const categoryIds = [...new Set(menuRowsTyped.map(r => r.category_id).filter((c): c is string => !!c))]
  const stationByCategory = new Map<string, string>()
  if (categoryIds.length > 0) {
    const { data: catRouting } = await supabase
      .from('menu_category_station')
      .select('category_id, station_id, is_primary')
      .in('category_id', categoryIds)
    for (const r of ((catRouting ?? []) as { category_id: string; station_id: string; is_primary: boolean }[])) {
      if (r.is_primary || !stationByCategory.has(r.category_id)) {
        stationByCategory.set(r.category_id, r.station_id)
      }
    }
  }

  const destByItem    = new Map<string, string>()
  const stationByItem = new Map<string, string | null>()
  for (const r of menuRowsTyped) {
    destByItem.set(r.id, r.destination || 'cocina')
    const station =
      overrideByItem.get(r.id) ??
      (r.category_id ? stationByCategory.get(r.category_id) : undefined) ??
      null
    stationByItem.set(r.id, station)
  }

  // 5. Insertar order_items con station_id resuelto. Misma estrategia de
  //    fallback que /api/orders: si la columna station_id no existe en DB,
  //    retry sin ella y devolver diagnostic explícito si falla igual.
  const baseRow = (item: typeof body.cart[number]) => ({
    order_id:    order.id,
    menu_item_id: item.menu_item_id,
    name:        item.name,
    quantity:    item.quantity,
    unit_price:  item.unit_price,
    notes:       item.note ?? null,
    status:      'pending' as const,
    destination: destByItem.get(item.menu_item_id) || item.destination,
  })

  let itemsErr = (await supabase
    .from('order_items')
    .insert(body.cart.map(item => ({
      ...baseRow(item),
      station_id: stationByItem.get(item.menu_item_id) ?? null,
    })))
  ).error

  if (itemsErr) {
    console.error('[orders/internal] items insert (with station_id) failed:', itemsErr)
    itemsErr = (await supabase.from('order_items').insert(body.cart.map(baseRow))).error
    if (itemsErr) {
      // Rollback del order padre para no dejar mesa ocupada con pedido fantasma.
      await supabase.from('orders').delete().eq('id', order.id)
      return NextResponse.json(
        { error: 'No se pudieron guardar los productos', details: itemsErr.message },
        { status: 500 },
      )
    }
  }

  // 6. Marcar mesa ocupada (solo después del insert exitoso de items)
  await supabase.from('tables').update({ status: 'ocupada' }).eq('id', body.table_id)

  return NextResponse.json({
    ok:      true,
    orderId: order.id,
    total,
    status:  'pending',
  })
}
