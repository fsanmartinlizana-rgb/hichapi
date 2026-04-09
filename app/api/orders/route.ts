import { createAdminClient } from '@/lib/supabase/server'
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
      const base = supabase.from('tables').select('id').eq('restaurant_id', restaurant.id)
      // Always try qr_token first (URL param from QR scan)
      const { data: byToken } = await base.eq('qr_token', table_id).single()
      if (byToken) return { data: byToken, error: null }
      // Fallback: try by UUID id
      const { data: byId, error } = await supabase.from('tables').select('id').eq('restaurant_id', restaurant.id).eq('id', table_id).single()
      return { data: byId, error }
    })()

    if (tableErr || !table) {
      return NextResponse.json(
        { error: 'Mesa no encontrada' },
        { status: 404 }
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

    // 5. Create order items
    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(
        cart.map(item => ({
          order_id: order.id,
          menu_item_id: item.menu_item_id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.note ?? null,
          status: 'pending',
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
      status:         z.enum(['confirmed','preparing','ready','paying','paid','cancelled']),
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

    // Deduct stock ingredients when order moves to 'preparing'
    if (status === 'preparing') {
      try {
        const { data: orderData } = await supabase
          .from('orders')
          .select('restaurant_id, order_items(quantity, menu_item_id)')
          .eq('id', order_id)
          .single()

        if (orderData?.order_items) {
          for (const item of orderData.order_items as { quantity: number; menu_item_id: string }[]) {
            const { data: menuItem } = await supabase
              .from('menu_items')
              .select('ingredients')
              .eq('id', item.menu_item_id)
              .single()

            const ingredients: { stock_item_id: string; qty: number }[] =
              menuItem?.ingredients ?? []

            for (const ing of ingredients) {
              const deduction = ing.qty * item.quantity
              await supabase.rpc('adjust_stock', {
                p_stock_item_id: ing.stock_item_id,
                p_delta: -deduction,
              }).catch(() => {
                // Fallback: direct update
                supabase.from('stock_items')
                  .update({ current_qty: supabase.rpc('greatest', {}) })
                  .eq('id', ing.stock_item_id)
              })

              await supabase.from('stock_movements').insert({
                restaurant_id:  orderData.restaurant_id,
                stock_item_id:  ing.stock_item_id,
                delta:          -deduction,
                reason:         'orden',
                order_id,
              })
            }
          }
        }
      } catch {
        // Stock deduction is best-effort — don't fail the status update
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
