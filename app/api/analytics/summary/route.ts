import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ── /api/analytics/summary ───────────────────────────────────────────────────
// Devuelve KPIs agregados reales para el dashboard unificado de /analytics.
//
// Query params:
//   restaurant_id (UUID, requerido)
//   period        ('dia' | 'semana' | 'mes' | '30d' — default 'semana')
//
// Respuesta (todas las métricas calculadas contra supabase):
//   {
//     period,
//     range: { start: ISO, end: ISO },
//     revenue: { total_paid, total_all, orders_count, avg_ticket },
//     comparison: { prev_total_paid, delta_pct },    // vs periodo anterior
//     top_items: [{ name, qty, revenue }],           // top 5 por cantidad
//     by_hour:   [{ hour: 0..23, orders, revenue }], // agregado del período
//     by_day:    [{ date: ISO, orders, revenue }],   // últimos 30 días
//     stock_alerts: number,                          // stock_items con current<min
//     open_tables: number,                           // mesas con status ocupada
//   }

type Period = 'dia' | 'semana' | 'mes' | '30d'

function periodRange(period: Period): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date()
  const end = now
  let start: Date
  let prevStart: Date
  let prevEnd: Date
  switch (period) {
    case 'dia':
      start = new Date(now); start.setHours(0, 0, 0, 0)
      prevEnd = new Date(start.getTime() - 1)
      prevStart = new Date(prevEnd); prevStart.setHours(0, 0, 0, 0)
      break
    case 'semana':
      start = new Date(now); start.setDate(now.getDate() - 7)
      prevEnd = start
      prevStart = new Date(start); prevStart.setDate(start.getDate() - 7)
      break
    case 'mes':
      start = new Date(now); start.setMonth(now.getMonth() - 1)
      prevEnd = start
      prevStart = new Date(start); prevStart.setMonth(start.getMonth() - 1)
      break
    case '30d':
    default:
      start = new Date(now); start.setDate(now.getDate() - 30)
      prevEnd = start
      prevStart = new Date(start); prevStart.setDate(start.getDate() - 30)
      break
  }
  return { start, end, prevStart, prevEnd }
}

interface Order {
  id: string
  total: number
  status: string
  created_at: string
}

interface OrderItem {
  order_id: string
  name: string
  quantity: number
  unit_price: number
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  const periodParam  = (req.nextUrl.searchParams.get('period') ?? 'semana') as Period

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor'])
  if (authErr) return authErr

  const { start, end, prevStart, prevEnd } = periodRange(periodParam)
  const supabase = createAdminClient()

  // ── Orders del período ─────────────────────────────────────────────────
  const { data: ordersRaw } = await supabase
    .from('orders')
    .select('id, total, status, created_at')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false })
  const orders = (ordersRaw ?? []) as Order[]

  const paidOrders = orders.filter(o => o.status === 'paid')
  const totalPaid  = paidOrders.reduce((s, o) => s + (o.total || 0), 0)
  const totalAll   = orders.reduce((s, o) => s + (o.total || 0), 0)

  // ── Orders del período anterior (para delta_pct) ───────────────────────
  const { data: prevOrdersRaw } = await supabase
    .from('orders')
    .select('total, status')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'paid')
    .gte('created_at', prevStart.toISOString())
    .lte('created_at', prevEnd.toISOString())
  const prevTotalPaid = ((prevOrdersRaw ?? []) as { total: number }[])
    .reduce((s, o) => s + (o.total || 0), 0)
  const deltaPct = prevTotalPaid > 0
    ? Math.round(((totalPaid - prevTotalPaid) / prevTotalPaid) * 100)
    : totalPaid > 0 ? 100 : 0

  // ── Order items del período (para top_items y by_hour con revenue) ─────
  const orderIds = orders.map(o => o.id)
  const { data: itemsRaw } = orderIds.length
    ? await supabase
        .from('order_items')
        .select('order_id, name, quantity, unit_price')
        .in('order_id', orderIds)
    : { data: [] }
  const items = (itemsRaw ?? []) as OrderItem[]

  const itemsByName = new Map<string, { qty: number; revenue: number }>()
  for (const it of items) {
    const cur = itemsByName.get(it.name) ?? { qty: 0, revenue: 0 }
    cur.qty     += it.quantity || 0
    cur.revenue += (it.unit_price || 0) * (it.quantity || 0)
    itemsByName.set(it.name, cur)
  }
  const topItems = [...itemsByName.entries()]
    .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  // ── By hour (00-23) con cantidad de órdenes y revenue ──────────────────
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, revenue: 0 }))
  for (const o of paidOrders) {
    const h = new Date(o.created_at).getHours()
    byHour[h].orders += 1
    byHour[h].revenue += o.total || 0
  }

  // ── Heatmap ocupación: day-of-week (0=Dom..6=Sab) × hour (0-23) ─────
  // Usa TODOS los pedidos pagados del período (no solo paidOrders del rango
  // corto) para que el heatmap muestre patrones significativos. Por cada
  // celda guarda cantidad de órdenes y cantidad de "días únicos con data"
  // para calcular el promedio por día de la semana en la UI.
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  const heatmapDaysSeen: Set<string>[][] = Array.from(
    { length: 7 },
    () => Array.from({ length: 24 }, () => new Set<string>()),
  )
  for (const o of paidOrders) {
    const d = new Date(o.created_at)
    const dow = d.getDay()
    const hr  = d.getHours()
    heatmap[dow][hr] += 1
    heatmapDaysSeen[dow][hr].add(o.created_at.slice(0, 10))
  }
  // Convertir a promedio por día observado: si un (lunes 13:00) tiene 5
  // órdenes y vimos 2 lunes en el período, promedio = 2.5. Esto da una
  // lectura estable independiente de cuántas semanas tenga el período.
  const heatmapAvg: number[][] = heatmap.map((row, dow) =>
    row.map((orders, hr) => {
      const seen = heatmapDaysSeen[dow][hr].size || 1
      return Math.round((orders / seen) * 10) / 10
    }),
  )

  // ── By day (últimos 30 días) ───────────────────────────────────────────
  const byDay = new Map<string, { orders: number; revenue: number }>()
  const last30 = new Date(); last30.setDate(last30.getDate() - 30)
  const { data: last30Raw } = await supabase
    .from('orders')
    .select('total, status, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'paid')
    .gte('created_at', last30.toISOString())
  for (const o of ((last30Raw ?? []) as { total: number; created_at: string }[])) {
    const day = o.created_at.slice(0, 10)
    const cur = byDay.get(day) ?? { orders: 0, revenue: 0 }
    cur.orders += 1
    cur.revenue += o.total || 0
    byDay.set(day, cur)
  }
  const byDayArr = [...byDay.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ── Stock alerts + open tables (operational widgets) ───────────────────
  const { data: stockRaw } = await supabase
    .from('stock_items')
    .select('current_qty, min_threshold')
    .eq('restaurant_id', restaurantId)
  const stockAlerts = ((stockRaw ?? []) as { current_qty: number; min_threshold: number | null }[])
    .filter(s => s.min_threshold != null && s.current_qty <= (s.min_threshold ?? 0)).length

  const { count: openTables } = await supabase
    .from('tables')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('status', 'ocupada')

  // ── Mermas del período ─────────────────────────────────────────────────
  const { data: wasteRaw } = await supabase
    .from('waste_log')
    .select('qty_lost, cost_lost, reason, item_type, menu_item_id, stock_item_id, logged_at')
    .eq('restaurant_id', restaurantId)
    .gte('logged_at', start.toISOString())
    .lte('logged_at', end.toISOString())
  const waste = (wasteRaw ?? []) as Array<{
    qty_lost: number; cost_lost: number | null; reason: string | null
    item_type: string | null; menu_item_id: string | null; stock_item_id: string | null
    logged_at: string
  }>

  const wasteTotalCost  = waste.reduce((s, w) => s + (w.cost_lost ?? 0), 0)
  const wasteByReason   = new Map<string, { count: number; cost: number }>()
  for (const w of waste) {
    const key = w.reason ?? 'otro'
    const cur = wasteByReason.get(key) ?? { count: 0, cost: 0 }
    cur.count += 1
    cur.cost  += w.cost_lost ?? 0
    wasteByReason.set(key, cur)
  }
  const topReasons = [...wasteByReason.entries()]
    .map(([reason, v]) => ({ reason, count: v.count, cost: v.cost }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5)

  return NextResponse.json({
    period: periodParam,
    range: { start: start.toISOString(), end: end.toISOString() },
    revenue: {
      total_paid:   totalPaid,
      total_all:    totalAll,
      orders_count: paidOrders.length,
      avg_ticket:   paidOrders.length ? Math.round(totalPaid / paidOrders.length) : 0,
    },
    comparison: {
      prev_total_paid: prevTotalPaid,
      delta_pct:       deltaPct,
    },
    top_items:    topItems,
    by_hour:      byHour,
    by_day:       byDayArr,
    heatmap:      heatmapAvg, // 7×24 matriz de avg orders por (dow, hour)
    stock_alerts: stockAlerts,
    open_tables:  openTables ?? 0,
    waste: {
      total_cost:   wasteTotalCost,
      events_count: waste.length,
      top_reasons:  topReasons,
    },
  })
}
