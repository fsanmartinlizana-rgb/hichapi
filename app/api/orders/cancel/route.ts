import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── POST /api/orders/cancel ───────────────────────────────────────────────────
// Cancel an order with a reason. Frees the table if no other active orders
// exist for it. If reason is 'merma' or 'perdida', logs waste against each
// ingredient/stock_item so inventory stays consistent — but avoids double-
// counting when stock was already deducted by deduct_order_stock (status was
// confirmed/preparing/ready/paying).

const BodySchema = z.object({
  order_id: z.string().uuid(),
  reason:   z.enum(['cliente_cancelo', 'error_cocina', 'merma', 'perdida', 'otro']),
  notes:    z.string().max(500).optional(),
})

// Statuses at which `deduct_order_stock` has already run
const STOCK_DEDUCTED_STATUSES = new Set(['confirmed', 'preparing', 'ready', 'paying'])

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user)
    return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const { order_id, reason, notes } = BodySchema.parse(body)

    const supabase = createAdminClient()

    // 1. Load the order + items (with menu_item so we can pull ingredients JSONB)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        id, restaurant_id, table_id, status,
        order_items(id, name, quantity, unit_price, menu_item_id)
      `)
      .eq('id', order_id)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }
    if (order.status === 'paid' || order.status === 'cancelled') {
      return NextResponse.json({ error: 'No se puede cancelar un pedido ya cerrado' }, { status: 400 })
    }

    const stockWasAlreadyDeducted = STOCK_DEDUCTED_STATUSES.has(order.status)

    // 2. Mark the order cancelled and persist the reason as note
    const fullNote = `[CANCELADO:${reason}] ${notes ?? ''}`.trim()
    const { error: updErr } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        notes: fullNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id)

    if (updErr) {
      return NextResponse.json({ error: 'No se pudo cancelar el pedido' }, { status: 500 })
    }

    // 3. If cancellation is merma/perdida, log waste.
    //    If stock was already deducted (order was past "new"), we mark
    //    `already_deducted=true` so the trigger does NOT double-deduct.
    let mermaCount = 0
    if (reason === 'merma' || reason === 'perdida') {
      type Item = { name: string; quantity: number; unit_price: number; menu_item_id: string | null }
      const items = (order.order_items ?? []) as Item[]

      // Pre-fetch all menu_items with ingredients to avoid N+1
      const menuIds = items.map(i => i.menu_item_id).filter(Boolean) as string[]
      let menuMap: Record<string, Array<{ stock_item_id: string; qty: number }>> = {}
      if (menuIds.length > 0) {
        const { data: mis } = await supabase
          .from('menu_items')
          .select('id, ingredients')
          .in('id', menuIds)
        for (const mi of mis ?? []) {
          if (Array.isArray((mi as { ingredients?: unknown }).ingredients)) {
            menuMap[(mi as { id: string }).id] =
              (mi as { ingredients: Array<{ stock_item_id: string; qty: number }> }).ingredients
          }
        }
      }

      for (const item of items) {
        const ings = item.menu_item_id ? menuMap[item.menu_item_id] : null

        if (ings && ings.length > 0) {
          // Log waste per ingredient (accurate inventory accounting)
          for (const ing of ings) {
            const lossQty = ing.qty * item.quantity
            if (lossQty <= 0 || !ing.stock_item_id) continue
            const { error: wErr } = await supabase.from('waste_log').insert({
              restaurant_id: order.restaurant_id,
              stock_item_id: ing.stock_item_id,
              qty_lost:      lossQty,
              reason:        reason === 'merma' ? 'merma' : 'perdida',
              notes:         `Cancelación de pedido: ${item.name}${notes ? ` - ${notes}` : ''}`,
              already_deducted: stockWasAlreadyDeducted,
            })
            if (!wErr) mermaCount++
          }
        } else {
          // Fallback: match stock_item by dish name (legacy items without ingredients)
          const { data: stockItem } = await supabase
            .from('stock_items')
            .select('id, cost_per_unit')
            .eq('restaurant_id', order.restaurant_id)
            .ilike('name', item.name)
            .maybeSingle()

          const cost = stockItem?.cost_per_unit ?? item.unit_price
          const { error: wErr } = await supabase.from('waste_log').insert({
            restaurant_id: order.restaurant_id,
            stock_item_id: stockItem?.id ?? null,
            qty_lost:      item.quantity,
            reason:        reason === 'merma' ? 'merma' : 'perdida',
            notes:         `Cancelación de pedido: ${item.name}${notes ? ` - ${notes}` : ''}`,
            cost_lost:     Math.round(cost * item.quantity),
            already_deducted: stockWasAlreadyDeducted,
          })
          if (!wErr) mermaCount++
        }
      }
    }

    // 4. Free the table if no other active orders
    if (order.table_id) {
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('table_id', order.table_id)
        .not('status', 'in', '("paid","cancelled")')
        .neq('id', order_id)

      if (!activeOrders || activeOrders.length === 0) {
        await supabase
          .from('tables')
          .update({ status: 'libre' })
          .eq('id', order.table_id)
      }
    }

    return NextResponse.json({
      ok: true,
      order_id,
      reason,
      merma_logged: mermaCount,
      stock_was_already_deducted: stockWasAlreadyDeducted,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('orders/cancel error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
