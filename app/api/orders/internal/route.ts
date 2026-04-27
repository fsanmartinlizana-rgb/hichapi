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
  pax:           z.number().int().min(1).optional(),
  tip:           z.number().int().min(0).optional(), // Propina opcional (no va en DTE)
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

  // Validar que la caja esté abierta (mismo gate que /api/orders)
  // El admin puede deshabilitar este gate via restaurants.cash_required = false.
  let cashRequired = true
  try {
    const { data: restConfig } = await supabase
      .from('restaurants')
      .select('cash_required')
      .eq('id', body.restaurant_id)
      .maybeSingle()
    if (restConfig && (restConfig as { cash_required?: boolean | null }).cash_required === false) {
      cashRequired = false
    }
  } catch { /* columna no existe — gating ON por default */ }

  if (cashRequired) {
    const { data: openSession } = await supabase
      .from('cash_register_sessions')
      .select('id')
      .eq('restaurant_id', body.restaurant_id)
      .eq('status', 'open')
      .limit(1)
      .maybeSingle()

    if (!openSession) {
      return NextResponse.json(
        {
          error: 'La caja está cerrada. No se pueden tomar pedidos en este momento.',
          reason: 'cash_register_closed',
          hint:   'Abre la caja desde /caja para reanudar el servicio.',
        },
        { status: 409 }
      )
    }
  }

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

  // 2. Calcular subtotal (sin propina) y total (con propina)
  const subtotal = body.cart.reduce((s, c) => s + c.unit_price * c.quantity, 0)
  const tipAmount = body.tip ?? 0
  const cartTotal = subtotal + tipAmount

  // 3. Si la mesa está ocupada, buscar la orden activa y agregar ítems a ella.
  //    Si está libre (o cualquier otro estado), crear una orden nueva.
  let orderId: string
  let isAddingToExisting = false

  if (t.status === 'ocupada') {
    // Buscar la orden activa más reciente de esta mesa (pending o en_proceso)
    const { data: activeOrder, error: activeOrderErr } = await supabase
      .from('orders')
      .select('id, total')
      .eq('table_id', body.table_id)
      .eq('restaurant_id', body.restaurant_id)
      .in('status', ['pending', 'en_proceso', 'preparing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeOrderErr) {
      console.error('[orders/internal] active order lookup failed:', activeOrderErr)
      return NextResponse.json(
        { error: 'No se pudo obtener la comanda activa', details: activeOrderErr.message },
        { status: 500 },
      )
    }

    if (activeOrder) {
      orderId = (activeOrder as { id: string; total: number }).id
      isAddingToExisting = true
      // Actualizar total + subtotal de la orden existente.
      // La check constraint orders_total_equals_subtotal_plus_tip exige
      // total = subtotal + tip. Sin tip → tip=0 → total = subtotal.
      const newTotal = ((activeOrder as { id: string; total: number }).total ?? 0) + cartTotal
      const newSubtotal = ((activeOrder as { id: string; total: number; subtotal?: number }).subtotal ?? 0) + subtotal
      const newTip = ((activeOrder as { id: string; total: number; tip?: number }).tip ?? 0) + tipAmount
      await supabase.from('orders').update({ 
        subtotal: newSubtotal,
        tip: newTip,
        total: newTotal 
      }).eq('id', orderId)
    } else {
      // Mesa ocupada pero sin orden activa encontrada — crear una nueva igual
      const { data: newOrder, error: newOrderErr } = await supabase
        .from('orders')
        .insert({
          restaurant_id: body.restaurant_id,
          table_id:      body.table_id,
          status:        'pending',
          subtotal:      subtotal,
          tip:           tipAmount,
          total:         cartTotal,
          client_name:   body.client_name ?? null,
          notes:         body.notes ?? null,
          pax:           body.pax ?? null,
        })
        .select('id')
        .single()

      if (newOrderErr || !newOrder) {
        console.error('[orders/internal] order insert failed (occupied fallback):', newOrderErr)
        return NextResponse.json(
          { error: 'No se pudo crear la comanda', details: newOrderErr?.message },
          { status: 500 },
        )
      }
      orderId = (newOrder as { id: string }).id
    }
  } else {
    // Mesa libre — crear orden nueva
    const { data: newOrder, error: newOrderErr } = await supabase
      .from('orders')
      .insert({
        restaurant_id: body.restaurant_id,
        table_id:      body.table_id,
        status:        'pending',
        subtotal:      subtotal,
        tip:           tipAmount,
        total:         cartTotal,
        client_name:   body.client_name ?? null,
        notes:         body.notes ?? null,
        pax:           body.pax ?? null,
      })
      .select('id')
      .single()

    if (newOrderErr || !newOrder) {
      console.error('[orders/internal] order insert failed:', newOrderErr)
      return NextResponse.json(
        { error: 'No se pudo crear la comanda', details: newOrderErr?.message },
        { status: 500 },
      )
    }
    orderId = (newOrder as { id: string }).id
  }

  // Alias para compatibilidad con el resto del código
  const order = { id: orderId }
  const total = cartTotal

  // 4. Resolver station_id por cada item (misma lógica que /api/orders).
  //    Orden: override puntual → category routing → null (fallback legacy
  //    que se maneja por destination).
  const menuItemIds = body.cart.map(c => c.menu_item_id)
  const { data: menuRows } = await supabase
    .from('menu_items')
    .select('id, destination, category_id, tax_exempt')
    .in('id', menuItemIds)
  type MenuRow = { id: string; destination: string | null; category_id: string | null; tax_exempt: boolean | null }
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
  const taxExemptByItem = new Map<string, boolean>()
  for (const r of menuRowsTyped) {
    destByItem.set(r.id, r.destination || 'cocina')
    taxExemptByItem.set(r.id, r.tax_exempt ?? false)
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
    tax_exempt:  taxExemptByItem.get(item.menu_item_id) ?? false,
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
      // Rollback: solo borrar la orden si fue creada nueva en este request.
      // Si estamos agregando a una orden existente, no tocar nada.
      if (!isAddingToExisting) {
        await supabase.from('orders').delete().eq('id', order.id)
      }
      return NextResponse.json(
        { error: 'No se pudieron guardar los productos', details: itemsErr.message },
        { status: 500 },
      )
    }
  }

  // 6. Marcar mesa ocupada (solo si no lo estaba ya)
  if (!isAddingToExisting) {
    await supabase.from('tables').update({ status: 'ocupada' }).eq('id', body.table_id)
  }

  // 7. Enviar tickets al notifier de impresión agrupados por estación.
  //    Fire-and-forget: no bloqueamos la respuesta si el notifier falla.
  //    Cada estación con print_server configurado recibe un ticket con sus items.
  void sendStationTickets({
    supabase,
    restaurantId: body.restaurant_id,
    tableId:      body.table_id,
    orderId:      order.id,
    cart:         body.cart,
    stationByItem,
    destByItem,
  }).catch(err => console.error('[orders/internal] station tickets error (non-blocking):', err))

  return NextResponse.json({
    ok:                true,
    orderId:           order.id,
    total,
    status:            'pending',
    addedToExisting:   isAddingToExisting,
  })
}

// ── sendStationTickets ────────────────────────────────────────────────────────
// Agrupa los items del carrito por station_id (o por destination como fallback),
// obtiene la URL del notifier para cada estación y envía un POST a
// {notifier_url}/api/solicita_ticket por cada grupo.
// Fire-and-forget: los errores se loguean pero no afectan la respuesta al cliente.

interface SendTicketsParams {
  supabase:     ReturnType<typeof import('@/lib/supabase/server').createAdminClient>
  restaurantId: string
  tableId:      string
  orderId:      string
  cart:         Array<{
    menu_item_id: string
    name:         string
    quantity:     number
    unit_price:   number
    note?:        string | null
    destination:  string
  }>
  stationByItem: Map<string, string | null>
  destByItem:    Map<string, string>
}

async function sendStationTickets(params: SendTicketsParams): Promise<void> {
  const { supabase, restaurantId, tableId, orderId, cart, stationByItem, destByItem } = params

  // 1. Obtener datos del restaurante (slug = comercio)
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('slug, name, address, neighborhood')
    .eq('id', restaurantId)
    .maybeSingle()

  const comercio = restaurant?.slug || restaurant?.name || restaurantId
  const direccion = (restaurant as any)?.direccion || (restaurant as any)?.address || ''
  const comuna    = (restaurant as any)?.comuna    || (restaurant as any)?.neighborhood || ''

  // 2. Obtener datos de la mesa
  const { data: table } = await supabase
    .from('tables')
    .select('label')
    .eq('id', tableId)
    .maybeSingle()
  const mesaLabel = (table as any)?.label || tableId

  // 3. Agrupar items por station_id (o por destination si no hay station)
  //    Clave: station_id ?? `dest:${destination}`
  const groups = new Map<string, {
    key:         string
    stationId:   string | null
    destination: string
    items:       typeof cart
  }>()

  for (const item of cart) {
    const stationId = stationByItem.get(item.menu_item_id) ?? null
    const dest      = destByItem.get(item.menu_item_id) || item.destination

    // Solo enviar tickets para items que van a cocina o barra
    if (dest === 'ninguno') continue

    const key = stationId ?? `dest:${dest}`
    if (!groups.has(key)) {
      groups.set(key, { key, stationId, destination: dest, items: [] })
    }
    groups.get(key)!.items.push(item)
  }

  if (groups.size === 0) return

  // 4. Para cada grupo, obtener la URL del notifier desde print_servers
  const stationIds = [...groups.values()]
    .map(g => g.stationId)
    .filter((id): id is string => !!id)

  // Obtener stations con su print_server
  let stationPrinterMap = new Map<string, { notifierUrl: string; printerName: string }>()

  if (stationIds.length > 0) {
    const { data: stations } = await supabase
      .from('stations')
      .select('id, name, print_server_id, print_servers(id, name, printer_addr)')
      .in('id', stationIds)

    for (const st of (stations ?? []) as any[]) {
      const ps = st.print_servers
      if (!ps?.printer_addr) continue

      // printer_addr puede ser "192.168.1.100:9100" o "https://realdev.cl"
      // Normalizamos a URL base
      let baseUrl = ps.printer_addr as string
      if (!baseUrl.startsWith('http')) {
        baseUrl = `http://${baseUrl}`
      }
      // Quitar trailing slash
      baseUrl = baseUrl.replace(/\/$/, '')

      stationPrinterMap.set(st.id, {
        notifierUrl: baseUrl,
        printerName: ps.name || st.name,
      })
    }
  }

  // 5. Enviar un ticket por cada grupo
  const sendPromises: Promise<void>[] = []

  for (const group of groups.values()) {
    let notifierUrl: string | null = null
    let printerName = group.destination

    if (group.stationId && stationPrinterMap.has(group.stationId)) {
      const info = stationPrinterMap.get(group.stationId)!
      notifierUrl = info.notifierUrl
      printerName = info.printerName
    }

    // Si no hay notifier configurado para esta estación, skip
    if (!notifierUrl) {
      console.info(`[orders/internal] No hay print_server para estación ${group.stationId ?? group.destination} — ticket omitido`)
      continue
    }

    const payload = {
      comercio,
      impresora:  printerName,
      mesa:       mesaLabel,
      movimiento: orderId,
      mesero:     '',  // no tenemos el nombre del mesero en este contexto
      items:      group.items.map(i => ({
        nombre:    i.name,
        cantidad:  i.quantity,
        precio:    i.unit_price,
        nota:      i.note || '',
      })),
    }

    const url = `${notifierUrl}/api/solicita_ticket`

    sendPromises.push(
      fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(10_000),
      })
        .then(async res => {
          if (!res.ok) {
            const text = await res.text().catch(() => '')
            console.warn(`[orders/internal] solicita_ticket ${url} → ${res.status}: ${text}`)
          } else {
            console.info(`[orders/internal] solicita_ticket enviado a ${url} (${group.destination})`)
          }
        })
        .catch(err => {
          console.error(`[orders/internal] solicita_ticket ${url} falló:`, err?.message ?? err)
        })
    )
  }

  await Promise.allSettled(sendPromises)
}
