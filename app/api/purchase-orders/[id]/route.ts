import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const OrderItemSchema = z.object({
  stock_item_id: z.string().uuid(),
  qty_ordered:   z.number().positive(),
  cost_per_unit: z.number().int().min(0),
})

const PatchOrderSchema = z.object({
  status:   z.enum(['borrador', 'enviada', 'recibida', 'cancelada']).optional(),
  supplier: z.string().min(1).optional(),
  notes:    z.string().optional(),
  items:    z.array(OrderItemSchema).min(1).optional(),
})

type OrderItem = { stock_item_id: string; qty_ordered: number; cost_per_unit: number }

/** Increment stock and insert a compra movement for each item. */
async function applyStockIncrements(items: OrderItem[], orderId: string) {
  for (const item of items) {
    const { data: si } = await supabase
      .from('stock_items')
      .select('current_qty, restaurant_id')
      .eq('id', item.stock_item_id)
      .single()

    if (si) {
      await supabase
        .from('stock_items')
        .update({ current_qty: si.current_qty + item.qty_ordered })
        .eq('id', item.stock_item_id)

      await supabase.from('stock_movements').insert({
        stock_item_id:     item.stock_item_id,
        restaurant_id:     si.restaurant_id,
        delta:             item.qty_ordered,
        reason:            'compra',
        purchase_order_id: orderId,
      })
    }
  }
}

/** Replace purchase_order_items for an order. */
async function replaceOrderItems(
  orderId: string,
  items: OrderItem[],
): Promise<{ error: string | null }> {
  await supabase.from('purchase_order_items').delete().eq('purchase_order_id', orderId)

  const { error } = await supabase.from('purchase_order_items').insert(
    items.map((item) => ({
      purchase_order_id: orderId,
      stock_item_id:     item.stock_item_id,
      qty_ordered:       item.qty_ordered,
      cost_per_unit:     item.cost_per_unit,
    })),
  )

  return { error: error?.message ?? null }
}

// PATCH /api/purchase-orders/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const { id } = await params

  let body: z.infer<typeof PatchOrderSchema>
  try {
    body = PatchOrderSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  // Fetch current order
  const { data: currentOrder, error: fetchErr } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !currentOrder) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  const wasAlreadyReceived = currentOrder.status === 'recibida'
  const isTransitioningToReceived = body.status === 'recibida'

  if (wasAlreadyReceived && (isTransitioningToReceived || body.items)) {
    // Revert previous stock movements via RPC
    const { error: rpcErr } = await supabase.rpc('reverse_purchase_order_stock', {
      p_purchase_order_id: id,
    })
    if (rpcErr) {
      return NextResponse.json(
        { error: 'Error al revertir movimientos: ' + rpcErr.message },
        { status: 500 },
      )
    }

    let itemsToApply: OrderItem[]

    if (body.items) {
      const { error: replaceErr } = await replaceOrderItems(id, body.items)
      if (replaceErr) return NextResponse.json({ error: replaceErr }, { status: 400 })
      itemsToApply = body.items
    } else {
      const { data: existingItems, error: itemsErr } = await supabase
        .from('purchase_order_items')
        .select('stock_item_id, qty_ordered, cost_per_unit')
        .eq('purchase_order_id', id)
      if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 })
      itemsToApply = existingItems ?? []
    }

    await applyStockIncrements(itemsToApply, id)
  } else if (!wasAlreadyReceived && isTransitioningToReceived) {
    if (body.items) {
      const { error: replaceErr } = await replaceOrderItems(id, body.items)
      if (replaceErr) return NextResponse.json({ error: replaceErr }, { status: 400 })
    }

    const { data: orderItems, error: itemsErr } = await supabase
      .from('purchase_order_items')
      .select('stock_item_id, qty_ordered, cost_per_unit')
      .eq('purchase_order_id', id)

    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 400 })

    await applyStockIncrements(orderItems ?? [], id)
  } else if (body.items && !wasAlreadyReceived) {
    const { error: replaceErr } = await replaceOrderItems(id, body.items)
    if (replaceErr) return NextResponse.json({ error: replaceErr }, { status: 400 })
  }

  // Build update payload
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updatePayload.status = body.status
  if (body.supplier !== undefined) updatePayload.supplier = body.supplier
  if (body.notes !== undefined) updatePayload.notes = body.notes
  if (isTransitioningToReceived) updatePayload.received_at = new Date().toISOString()

  const { data: updatedOrder, error: updateErr } = await supabase
    .from('purchase_orders')
    .update(updatePayload)
    .eq('id', id)
    .select('*, purchase_order_items(*)')
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 })
  }

  return NextResponse.json({ order: updatedOrder })
}
