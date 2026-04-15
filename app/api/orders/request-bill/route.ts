import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications/server'
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/request-bill
// Cliente pide la cuenta para una mesa entera (consolida todas las comandas
// activas de esa mesa). Marca TODAS las órdenes no pagadas como 'paying' y
// dispara UNA sola notificación al garzón.
//
// Body: { table_id }  — table_id puede ser UUID o qr_token
// ─────────────────────────────────────────────────────────────────────────────

const BodySchema = z.object({
  table_id: z.string().min(4),
})

export async function POST(req: NextRequest) {
  try {
    const { table_id: tableIdParam } = BodySchema.parse(await req.json())
    const supabase = createAdminClient()

    // Resolver qr_token → UUID si hace falta
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableIdParam)
    let realTableId: string | null = null
    let tableLabel = 'Mesa'
    let restaurantId: string | null = null

    if (isUUID) {
      const { data: t } = await supabase
        .from('tables')
        .select('id, label, restaurant_id')
        .eq('id', tableIdParam)
        .maybeSingle()
      if (t) {
        realTableId = t.id
        tableLabel = (t as { label?: string }).label ?? 'Mesa'
        restaurantId = (t as { restaurant_id?: string }).restaurant_id ?? null
      }
    } else {
      const { data: t } = await supabase
        .from('tables')
        .select('id, label, restaurant_id')
        .eq('qr_token', tableIdParam)
        .maybeSingle()
      if (t) {
        realTableId = t.id
        tableLabel = (t as { label?: string }).label ?? 'Mesa'
        restaurantId = (t as { restaurant_id?: string }).restaurant_id ?? null
      }
    }

    if (!realTableId || !restaurantId) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })
    }

    // Buscar todas las órdenes activas de esta mesa
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, total, status')
      .eq('table_id', realTableId)
      .not('status', 'in', '("paid","cancelled")')

    if (!activeOrders || activeOrders.length === 0) {
      return NextResponse.json(
        { error: 'No hay pedidos activos en esta mesa todavía.', orders_count: 0 },
        { status: 404 },
      )
    }

    type Ord = { id: string; total: number; status: string }
    const orders = activeOrders as Ord[]

    // Marcar TODAS como 'paying' (idempotente — si ya está 'paying' no hace nada)
    const orderIds = orders.map(o => o.id)
    const now = new Date().toISOString()
    await supabase
      .from('orders')
      .update({ status: 'paying', bill_requested_at: now })
      .in('id', orderIds)
      .not('status', 'in', '("paid","cancelled","delivered")')

    // Si alguna orden ya estaba 'delivered', marcarla 'paying' regresaría
    // el estado — sólo registramos bill_requested_at en esas:
    await supabase
      .from('orders')
      .update({ bill_requested_at: now })
      .in('id', orderIds)
      .eq('status', 'delivered')

    const totalPending = orders.reduce((s, o) => s + (o.total ?? 0), 0)

    // Disparar UNA notificación consolidada para la mesa
    try {
      await createNotification({
        restaurant_id: restaurantId,
        type:          'bill_requested',
        severity:      'warning',
        category:      'operacion',
        title:         `${tableLabel} pidió la cuenta`,
        message:       orders.length > 1
          ? `${orders.length} comandas · Total $${totalPending.toLocaleString('es-CL')}. Acércate a cobrar.`
          : `Total $${totalPending.toLocaleString('es-CL')}. Acércate a cobrar.`,
        action_url:    `/comandas?focus_table=${realTableId}`,
        action_label:  'Ver mesa',
        dedupe_key:    `bill_requested:${realTableId}`,
        metadata:      { table_id: realTableId, order_ids: orderIds, total: totalPending },
      })
    } catch (notifErr) {
      console.error('[notifications] bill_requested failed (non-blocking):', notifErr)
    }

    return NextResponse.json({
      ok: true,
      table_id:     realTableId,
      table_label:  tableLabel,
      orders_count: orders.length,
      total:        totalPending,
      order_ids:    orderIds,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('request-bill error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
