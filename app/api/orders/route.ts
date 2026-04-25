import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── Schemas ───────────────────────────────────────────────────────────────────

const CartItemSchema = z.object({
  menu_item_id: z.string(),
  name: z.string(),
  quantity: z.number().int().min(1),
  unit_price: z.number().min(0),
  note: z.string().nullish(),
})

const CreateOrderSchema = z.object({
  restaurant_slug: z.string(),
  table_id: z.string().min(1), // qr_token OR uuid
  cart: z.array(CartItemSchema).min(1),
  client_name: z.string().optional(),
  notes: z.string().optional(),
})

// ── POST /api/orders ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { restaurant_slug, table_id, cart, client_name, notes } =
      CreateOrderSchema.parse(body)

    // Use service-role client — table clients are anonymous
    const supabase = createAdminClient()

    // 1. Resolve restaurant_id from slug
    const { data: restaurant, error: restaurantErr } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurant_slug)
      .single()

    if (restaurantErr || !restaurant) {
      return NextResponse.json(
        { error: 'Restaurante no encontrado' },
        { status: 404 }
      )
    }

    // 2. Resolve table — try qr_token first, then UUID
    const { data: table, error: tableErr } = await (async () => {
      const base = supabase.from('tables').select('id, status, label').eq('restaurant_id', restaurant.id)
      // Always try qr_token first (URL param from QR scan)
      const { data: byToken } = await base.eq('qr_token', table_id).single()
      if (byToken) return { data: byToken, error: null }
      // Fallback: try by UUID id
      const { data: byId, error } = await supabase.from('tables').select('id, status, label').eq('restaurant_id', restaurant.id).eq('id', table_id).single()
      return { data: byId, error }
    })()

    if (tableErr || !table) {
      return NextResponse.json(
        { error: 'Mesa no encontrada' },
        { status: 404 }
      )
    }

    // Reject orders on "bloqueada" parent tables (tables that have been split into sub-tables).
    if ((table as { status?: string }).status === 'bloqueada') {
      return NextResponse.json(
        { error: `${(table as { label?: string }).label ?? 'Esta mesa'} está dividida. Selecciona una sub-mesa (ej: 2a, 2b).` },
        { status: 409 }
      )
    }

    // 2.5. Reject orders if caja is closed (gating obligatorio)
    // El admin puede deshabilitar este gate via restaurants.cash_required = false.
    // Si la columna no existe (schema legacy), default es true (gating activo).
    let cashRequired = true
    try {
      const { data: restConfig, error: rcErr } = await supabase
        .from('restaurants')
        .select('cash_required')
        .eq('id', restaurant.id)
        .maybeSingle()
      if (!rcErr && restConfig && (restConfig as { cash_required?: boolean | null }).cash_required === false) {
        cashRequired = false
      }
    } catch { /* columna no existe — gating ON por default */ }

    if (cashRequired) {
      const { data: openSession } = await supabase
        .from('cash_register_sessions')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'open')
        .limit(1)
        .maybeSingle()

      if (!openSession) {
        return NextResponse.json(
          {
            error: 'La caja está cerrada. El restaurante no puede recibir pedidos en este momento.',
            reason: 'cash_register_closed',
            hint:   'Pedile al admin que abra la caja desde /caja para reanudar el servicio.',
          },
          { status: 409 }
        )
      }
    }

    const realTableId = table.id

    // 3. Calculate total
    const total = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)

    // 4. Create order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        restaurant_id: restaurant.id,
        table_id: realTableId,
        status: 'pending',
        total,
        client_name: client_name ?? null,
        notes: notes ?? null,
      })
      .select('id')
      .single()

    if (orderErr || !order) {
      console.error('Order insert error:', orderErr)
      return NextResponse.json(
        { error: 'No se pudo crear el pedido' },
        { status: 500 }
      )
    }

    // 5. Resolve destination + station_id for each cart item.
    // Sprint 2026-04-20: en escenarios multi-local (enterprise), un plato
    // puede rutear a una station que vive en OTRO restaurant de la misma
    // marca. Si no resolvemos station_id al crear el order_item, la
    // comanda se "pierde" — no aparece en /comandas ni /garzon del local
    // donde debería prepararse.
    //
    // Orden de resolución:
    //   1. menu_item_station_override  (override puntual por plato)
    //   2. menu_category_station        (ruteo default por categoría)
    //   3. destination                  (fallback legacy: cocina/barra)
    const menuItemIds = cart.map(c => c.menu_item_id)
    const { data: menuRows } = await supabase
      .from('menu_items')
      .select('id, destination, category_id, tax_exempt')
      .in('id', menuItemIds)
    type MenuRow = { id: string; destination: string | null; category_id: string | null; tax_exempt: boolean | null }
    const menuRowsTyped = (menuRows ?? []) as MenuRow[]

    // Override por plato (con location_id=null == global)
    const { data: overridesRows } = await supabase
      .from('menu_item_station_override')
      .select('menu_item_id, station_id, location_id')
      .in('menu_item_id', menuItemIds)
      .is('location_id', null)
    const overrideByItem = new Map<string, string>(
      ((overridesRows ?? []) as { menu_item_id: string; station_id: string }[])
        .map(o => [o.menu_item_id, o.station_id]),
    )

    // Ruteo por categoría — solo traemos la station primary
    const categoryIds = [...new Set(menuRowsTyped.map(r => r.category_id).filter((c): c is string => !!c))]
    const stationByCategory = new Map<string, string>()
    if (categoryIds.length > 0) {
      const { data: catRouting } = await supabase
        .from('menu_category_station')
        .select('category_id, station_id, is_primary')
        .in('category_id', categoryIds)
      // Preferir la station marcada is_primary; si no, la primera encontrada.
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

    // 6. Create order items con destination + station_id snapshot.
    // Hacemos 2 intentos con fallback gradual para tolerar DBs que no
    // corrieron aún la migration 048 (agrega order_items.station_id):
    //   Intento 1: con station_id (schema completo)
    //   Intento 2: sin station_id (legacy)
    // Si ambos fallan, borramos la order padre y devolvemos error claro
    // al cliente para que no quede la mesa ocupada con comanda fantasma.
    const baseRow = (item: typeof cart[number]) => ({
      order_id:    order.id,
      menu_item_id: item.menu_item_id,
      name:        item.name,
      quantity:    item.quantity,
      unit_price:  item.unit_price,
      notes:       item.note ?? null,
      status:      'pending' as const,
      destination: destByItem.get(item.menu_item_id) || 'cocina',
      tax_exempt:  taxExemptByItem.get(item.menu_item_id) ?? false,
    })

    let itemsErr = (await supabase
      .from('order_items')
      .insert(
        cart.map(item => ({
          ...baseRow(item),
          station_id: stationByItem.get(item.menu_item_id) ?? null,
        })),
      )).error

    if (itemsErr) {
      // Log detalles completos para poder diagnosticar en Vercel logs
      console.error('Order items insert (with station_id) failed:', {
        code:    itemsErr.code,
        message: itemsErr.message,
        details: itemsErr.details,
        hint:    itemsErr.hint,
      })
      // Retry sin station_id (DBs que no corrieron migration 048)
      itemsErr = (await supabase
        .from('order_items')
        .insert(cart.map(baseRow))).error
      if (itemsErr) {
        console.error('Order items insert (fallback sin station_id) failed:', {
          code:    itemsErr.code,
          message: itemsErr.message,
          details: itemsErr.details,
          hint:    itemsErr.hint,
        })
        // Última línea de defensa: rollback de la order padre para que
        // la mesa no quede ocupada con un pedido fantasma.
        await supabase.from('orders').delete().eq('id', order.id)
        return NextResponse.json(
          {
            error:      'No se pudo guardar los items del pedido',
            details:    itemsErr.message,
            diagnostic: itemsErr.code === '42703'
              ? 'Falta columna en order_items. Revisá que la migration 048 (multi_location_stations) esté aplicada.'
              : 'Revisá logs de /api/orders en Vercel.',
          },
          { status: 500 },
        )
      }
    }

    // 7. Mark table as occupied — SOLO si los items se guardaron bien.
    await supabase
      .from('tables')
      .update({ status: 'ocupada' })
      .eq('id', realTableId)

    return NextResponse.json({
      orderId: order.id,
      total,
      status: 'pending',
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: err.issues },
        { status: 400 }
      )
    }
    console.error('Orders route error:', err)
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    )
  }
}

// ── PATCH /api/orders/:id — advance status (e.g. request bill) ───────────────

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = z.object({
      order_id:       z.string().uuid(),
      status:         z.enum(['confirmed','preparing','ready','paying','delivered','paid','cancelled']),
      payment_method: z.enum(['cash','digital','mixed']).optional(),
      cash_amount:    z.number().int().min(0).optional(),
      digital_amount: z.number().int().min(0).optional(),
      user_id:        z.string().uuid().optional(),
    }).parse(body)

    const { order_id, status, payment_method, cash_amount, digital_amount, user_id } = parsed

    const supabase = createAdminClient()

    // Build update payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: Record<string, any> = { status }

    if (status === 'delivered') {
      updatePayload.delivered_at = new Date().toISOString()
    }

    if (status === 'paying') {
      updatePayload.bill_requested_at = new Date().toISOString()
      // If the order was already delivered, don't regress the status —
      // just record the bill_requested_at timestamp (garzón still sees the badge).
      const { data: cur } = await supabase
        .from('orders')
        .select('status')
        .eq('id', order_id)
        .single()
      if ((cur as { status?: string } | null)?.status === 'delivered') {
        delete (updatePayload as Record<string, unknown>).status
      }
    }

    if (status === 'paid' && payment_method) {
      const cash    = cash_amount ?? 0
      const digital = digital_amount ?? 0
      updatePayload.payment_method        = payment_method
      updatePayload.cash_amount           = cash
      updatePayload.digital_amount        = digital
      updatePayload.hichapi_commission    = Math.round(digital * 0.01)
      updatePayload.cash_registered_at    = new Date().toISOString()
      if (user_id) updatePayload.cash_registered_by = user_id
    }

    const { error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order_id)

    if (error) {
      return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 })
    }

    // ── Fix crítico 2026-04-22: disparar evento de Realtime ────────────────
    // Los UPDATE hechos con service_role no siempre se emiten al canal de
    // postgres_changes con anon_key (es comportamiento esperado de Supabase).
    // Consecuencia: el cliente QR en /<slug>/<tableId> está suscripto a
    // 'UPDATE on orders' para redirigir a /review cuando status=paid, pero
    // nunca recibe el evento, y la encuesta de feedback no se gatilla.
    //
    // Workaround (mismo patrón que /api/bills/split/[splitId]/pay): hacemos
    // un segundo UPDATE idempotente con el cliente autenticado SSR para
    // que la publicación de Realtime sí emita el cambio. El UPDATE pone el
    // mismo status que ya quedó seteado → no cambia nada en DB pero
    // dispara el event realtime.
    if (status === 'paid' || status === 'paying') {
      try {
        const { createClient: createSsrClient } = await import('@/lib/supabase/server')
        const ssrClient = await createSsrClient()
        await ssrClient
          .from('orders')
          .update({ status: updatePayload.status ?? status })
          .eq('id', order_id)
      } catch (realtimeErr) {
        // Non-blocking: el status ya se persistió con admin client.
        console.warn('[orders PATCH] No se pudo disparar evento realtime:', realtimeErr)
      }
    }

    // Notificación: cliente pidió la cuenta desde Chapi
    if (status === 'paying') {
      try {
        const { data: ordRaw } = await supabase
          .from('orders')
          .select('restaurant_id, table_id, total, tables(label)')
          .eq('id', order_id)
          .single()
        const ord = ordRaw as {
          restaurant_id: string
          table_id: string
          total: number
          tables: { label: string } | { label: string }[] | null
        } | null
        if (ord?.restaurant_id) {
          const tbl = Array.isArray(ord.tables) ? ord.tables[0] : ord.tables
          const tableLabel = tbl?.label ?? 'Mesa'
          await createNotification({
            restaurant_id: ord.restaurant_id,
            type:          'bill_requested',
            severity:      'warning',
            category:      'operacion',
            title:         `${tableLabel} pidió la cuenta`,
            message:       `Total pendiente: $${ord.total.toLocaleString('es-CL')}. Acércate a cobrar.`,
            action_url:    `/comandas?focus=${order_id}`,
            action_label:  'Ver comanda',
            dedupe_key:    `bill_requested:${order_id}`,
            metadata:      { order_id, table_id: ord.table_id, total: ord.total },
          })
        }
      } catch (notifErr) {
        console.error('[notifications] bill_requested failed (non-blocking):', notifErr)
      }
    }

    // Deduct stock when order is confirmed (entering prep flow).
    // Idempotent on the DB side: deduct_order_stock is safe to call once per order.
    // We trigger on 'confirmed' (admin accepts) so stock matches what kitchen will use.
    if (status === 'confirmed' || status === 'preparing') {
      try {
        const { data: result, error: rpcErr } = await supabase.rpc('deduct_order_stock', {
          p_order_id: order_id,
        })
        if (rpcErr) console.error('Stock deduction RPC error:', rpcErr)
        else if (result?.deductions?.length > 0) {
          console.log(`Stock deducted for order ${order_id}: ${result.deductions.length} items`)
        }
      } catch (stockErr) {
        // Stock deduction is best-effort — don't fail the status update
        console.error('Stock deduction failed (non-blocking):', stockErr)
      }
    }

    // Auto-liberar mesa cuando la orden se cierra (paid o cancelled) y no hay
    // otros pedidos activos en esa misma mesa. Server-side con admin client
    // para evitar problemas de RLS cuando el garzón no es dueño del restaurant.
    if (status === 'paid' || status === 'cancelled') {
      try {
        const { data: ord } = await supabase
          .from('orders')
          .select('table_id')
          .eq('id', order_id)
          .single()
        const tableId = (ord as { table_id?: string } | null)?.table_id
        if (tableId) {
          const { data: activeOthers } = await supabase
            .from('orders')
            .select('id')
            .eq('table_id', tableId)
            .not('status', 'in', '("paid","cancelled")')
            .neq('id', order_id)
          if (!activeOthers || activeOthers.length === 0) {
            await supabase
              .from('tables')
              .update({ status: 'libre' })
              .eq('id', tableId)
          }
        }
      } catch (tableErr) {
        console.error('Auto-release table failed (non-blocking):', tableErr)
      }
    }

    return NextResponse.json({ ok: true, order_id, status })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── GET /api/orders?table_id=… ────────────────────────────────────────────────
// `table_id` puede ser:
//   - UUID de la tabla (uso interno del panel admin)
//   - qr_token (uso del cliente desde la URL del QR /[slug]/[tableId])
// Resolvemos a UUID antes de filtrar — sin esto, los pedidos del cliente
// QR nunca se encontraban (orders.table_id es UUID, qr_token no matchea).

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const tableIdParam = searchParams.get('table_id')

  if (!tableIdParam) {
    return NextResponse.json({ error: 'table_id requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Resolver: si parece UUID, usarlo directo; si no, buscar por qr_token
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableIdParam)

  let realTableId: string | null = null
  if (isUUID) {
    realTableId = tableIdParam
  } else {
    const { data: byToken } = await supabase
      .from('tables')
      .select('id')
      .eq('qr_token', tableIdParam)
      .maybeSingle()
    if (byToken) realTableId = byToken.id
  }

  if (!realTableId) {
    // Mesa no encontrada — devolvemos array vacío en vez de error 404
    // para que la UI muestre "sin pedidos" en lugar de explotar
    return NextResponse.json({ orders: [], table_resolved: false })
  }

  // 2026-04-22: ?include_recent_paid=1 incluye ordenes pagadas en los
  // ultimos 10 minutos. Necesario para que el polling del cliente QR en
  // /<slug>/<tableId>/page.tsx detecte la transicion 'paying' → 'paid'
  // y dispare la redireccion a /review. Sin este flag, la orden
  // desaparece del fetch cuando admin marca paid y el cliente nunca se
  // entera.
  const includeRecentPaid = searchParams.get('include_recent_paid') === '1'

  let query = supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('table_id', realTableId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (includeRecentPaid) {
    // Excluye cancelled pero incluye paid de los ultimos 10min.
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString()
    query = query
      .not('status', 'eq', 'cancelled')
      .or(`status.neq.paid,and(status.eq.paid,updated_at.gte.${tenMinAgo})`)
  } else {
    query = query.not('status', 'in', '("paid","cancelled")')
  }

  const { data: orders, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Error consultando pedidos' }, { status: 500 })
  }

  return NextResponse.json({ orders: orders ?? [], table_resolved: true })
}
