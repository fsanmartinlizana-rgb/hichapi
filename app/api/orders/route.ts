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

    // 5. Resolve destination for each cart item from menu_items (snapshot)
    const menuItemIds = cart.map(c => c.menu_item_id)
    const { data: menuRows } = await supabase
      .from('menu_items')
      .select('id, destination')
      .in('id', menuItemIds)

    const destByItem = new Map<string, string>(
      (menuRows ?? []).map((r: { id: string; destination: string | null }) => [r.id, r.destination || 'cocina'])
    )

    // 6. Create order items with destination snapshot
    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(
        cart.map(item => ({
          order_id:    order.id,
          menu_item_id: item.menu_item_id,
          name:        item.name,
          quantity:    item.quantity,
          unit_price:  item.unit_price,
          notes:       item.note ?? null,
          status:      'pending',
          destination: destByItem.get(item.menu_item_id) || 'cocina',
        }))
      )

    if (itemsErr) {
      console.error('Order items insert error:', itemsErr)
      // Order was created — don't fail, just log
    }

    // 6. Mark table as occupied
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

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const tableId = searchParams.get('table_id')

  if (!tableId) {
    return NextResponse.json({ error: 'table_id requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('table_id', tableId)
    .not('status', 'in', '("paid","cancelled")')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    return NextResponse.json({ error: 'Error consultando pedidos' }, { status: 500 })
  }

  return NextResponse.json({ orders: orders ?? [] })
}
