import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cash/reports?restaurant_id=...&period=day|week|month&date=YYYY-MM-DD
// Reporte de cuadratura de caja para el período. Default: día actual.
//
// Devuelve:
//   - sessions: lista de sesiones con sus totales
//   - aggregate: { revenue, cash, digital, expenses, net, orders, sessions_count }
//   - by_day: breakdown diario para period=week|month
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const restId = req.nextUrl.searchParams.get('restaurant_id')
  const period = (req.nextUrl.searchParams.get('period') ?? 'day') as 'day' | 'week' | 'month'
  const dateStr = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)

  if (!restId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restId, ['owner', 'admin', 'supervisor', 'super_admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  // Calcular ventana de tiempo
  const anchor = new Date(`${dateStr}T00:00:00`)
  let startDate: Date, endDate: Date

  if (period === 'day') {
    startDate = new Date(anchor); startDate.setHours(0, 0, 0, 0)
    endDate   = new Date(anchor); endDate.setHours(23, 59, 59, 999)
  } else if (period === 'week') {
    // Lunes a Domingo
    const day = anchor.getDay()
    const monday = new Date(anchor); monday.setDate(anchor.getDate() - (day === 0 ? 6 : day - 1)); monday.setHours(0, 0, 0, 0)
    startDate = monday
    endDate = new Date(monday); endDate.setDate(monday.getDate() + 6); endDate.setHours(23, 59, 59, 999)
  } else {
    // month
    startDate = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    endDate   = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999)
  }

  // Sessions en el período
  const { data: sessions } = await supabase
    .from('cash_register_sessions')
    .select('id, opened_at, closed_at, opening_amount, actual_cash, total_cash, total_digital, total_orders, total_expenses, difference, status, notes')
    .eq('restaurant_id', restId)
    .gte('opened_at', startDate.toISOString())
    .lte('opened_at', endDate.toISOString())
    .order('opened_at', { ascending: false })

  type Sess = {
    id: string; opened_at: string; closed_at: string | null
    opening_amount: number; actual_cash: number | null
    total_cash: number | null; total_digital: number | null
    total_orders: number | null; total_expenses: number | null
    difference: number | null; status: string; notes: string | null
  }
  const sessRows = (sessions ?? []) as Sess[]

  // Orders pagadas en el período (desde caja o no — fuente de verdad)
  const { data: orders } = await supabase
    .from('orders')
    .select('id, updated_at, total, cash_amount, digital_amount, hichapi_commission, payment_method')
    .eq('restaurant_id', restId)
    .eq('status', 'paid')
    .gte('updated_at', startDate.toISOString())
    .lte('updated_at', endDate.toISOString())

  type O = {
    id: string; updated_at: string; total: number
    cash_amount: number | null; digital_amount: number | null
    hichapi_commission: number | null; payment_method: string | null
  }
  const ordRows = (orders ?? []) as O[]

  const aggregate = {
    revenue:        ordRows.reduce((s, o) => s + (o.total ?? 0), 0),
    cash:           ordRows.reduce((s, o) => s + (o.cash_amount ?? 0), 0),
    digital:        ordRows.reduce((s, o) => s + (o.digital_amount ?? 0), 0),
    commission:     ordRows.reduce((s, o) => s + (o.hichapi_commission ?? 0), 0),
    expenses:       sessRows.reduce((s, x) => s + (x.total_expenses ?? 0), 0),
    orders_count:   ordRows.length,
    sessions_count: sessRows.length,
    cuadratura: {
      total_diferencias: sessRows.reduce((s, x) => s + (x.difference ?? 0), 0),
      sesiones_cuadradas: sessRows.filter(x => (x.difference ?? 0) === 0).length,
      sesiones_con_dif:   sessRows.filter(x => (x.difference ?? 0) !== 0).length,
    },
  }

  // Breakdown por día (solo para week/month)
  let byDay: Array<{ date: string; revenue: number; cash: number; digital: number; orders: number }> = []
  if (period === 'week' || period === 'month') {
    const dayMap = new Map<string, { revenue: number; cash: number; digital: number; orders: number }>()
    for (const o of ordRows) {
      const day = o.updated_at.slice(0, 10)
      const cur = dayMap.get(day) ?? { revenue: 0, cash: 0, digital: 0, orders: 0 }
      cur.revenue += o.total ?? 0
      cur.cash    += o.cash_amount ?? 0
      cur.digital += o.digital_amount ?? 0
      cur.orders  += 1
      dayMap.set(day, cur)
    }
    byDay = Array.from(dayMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  return NextResponse.json({
    period,
    range: { start: startDate.toISOString(), end: endDate.toISOString() },
    aggregate,
    sessions: sessRows,
    by_day: byDay,
  })
}
