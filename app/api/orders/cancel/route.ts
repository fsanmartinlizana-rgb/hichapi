import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildOrderItemWasteRow } from '@/lib/mermas/order-waste'
import type { MenuCandidate, StockCandidate } from '@/lib/mermas/resolve'

// ── POST /api/orders/cancel ───────────────────────────────────────────────────
// Cancel an order with a reason. Frees the table if no other active orders
// exist for it.
//
// Regla de merma (2026-06): si el pedido YA estaba preparado (stock descontado:
// confirmed/preparing/ready/paying) y se cancela, la comida se desechó → cada
// plato queda en mermas como item_type='plato' (con already_deducted=true para
// no re-descontar stock). También se registra si el motivo es merma/perdida
// aunque no estuviera preparado. Antes solo se logueaba contra stock_item_id,
// y los platos sin receta no entraban (violaban el CHECK waste_log_item_presence).

const BodySchema = z.object({
  order_id: z.string().uuid(),
  reason:   z.enum(['cliente_cancelo', 'error_cocina', 'merma', 'perdida', 'otro']),
  notes:    z.string().max(500).optional(),
})

// Statuses at which `deduct_order_stock` has already run
const STOCK_DEDUCTED_STATUSES = new Set(['confirmed', 'preparing', 'ready', 'paying'])

// Mapea el motivo de cancelación a un reason válido de waste_log.
function wasteReasonFor(reason: string): string {
  if (reason === 'merma' || reason === 'perdida') return reason
  if (reason === 'error_cocina') return 'error_prep'
  return 'merma' // cliente_cancelo / otro sobre pedido preparado = desecho
}

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

    // 3. Registrar merma: si el pedido ya estaba preparado (desecho real) o si
    //    el motivo es merma/perdida. Cada ítem se loguea como plato (o insumo)
    //    vía el resolver compartido, garantizando que satisface el CHECK y que
    //    aparece en /mermas. already_deducted=true cuando el stock ya se descontó
    //    al preparar (no re-descuenta).
    let mermaCount = 0
    const shouldLogMerma = stockWasAlreadyDeducted || reason === 'merma' || reason === 'perdida'
    if (shouldLogMerma) {
      type Item = { name: string; quantity: number; unit_price: number; menu_item_id: string | null }
      const items = (order.order_items ?? []) as Item[]

      // Traemos carta + inventario una vez para resolver los ítems.
      const [menuRes, stockRes] = await Promise.all([
        supabase.from('menu_items').select('id, name, cost_price').eq('restaurant_id', order.restaurant_id),
        supabase.from('stock_items').select('id, name, cost_per_unit').eq('restaurant_id', order.restaurant_id),
      ])
      const menu  = (menuRes.data  ?? []) as MenuCandidate[]
      const stock = (stockRes.data ?? []) as StockCandidate[]
      const wReason = wasteReasonFor(reason)

      for (const item of items) {
        const row = buildOrderItemWasteRow(
          { name: item.name, menu_item_id: item.menu_item_id, quantity: item.quantity, unit_price: item.unit_price },
          menu, stock,
          {
            restaurant_id:    order.restaurant_id,
            reason:           wReason,
            already_deducted: stockWasAlreadyDeducted,
            logged_by:        user.id,
            note:             `Cancelación de pedido: ${item.name}${notes ? ` - ${notes}` : ''}`,
          },
        )
        if (!row) {
          console.warn(`[orders/cancel] ítem sin resolver para merma: "${item.name}" (restaurant ${order.restaurant_id})`)
          continue
        }
        const { error: wErr } = await supabase.from('waste_log').insert(row)
        if (wErr) console.error('[orders/cancel] waste_log insert error:', wErr.code, wErr.message)
        else mermaCount++
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
