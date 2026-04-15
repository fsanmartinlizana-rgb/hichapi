import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ── GET /api/reports/brand?restaurant_id=X&date_from=...&date_to=... ─────────
// Reporte consolidado de TODOS los locales de la misma brand.
// - Respeta el toggle brand.share_reports. Si está off → solo el propio restaurant.
// - Agrupa por location para drill-down.
// - Retorna: ingresos totales, pedidos, ticket promedio, por local, por día.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const restaurantId = searchParams.get('restaurant_id')
  const dateFromStr  = searchParams.get('date_from')
  const dateToStr    = searchParams.get('date_to')

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor'])
  if (authErr) return authErr

  // Rango por default: últimos 30 días
  const dateTo   = dateToStr   ? new Date(dateToStr)   : new Date()
  const dateFrom = dateFromStr ? new Date(dateFromStr) : new Date(dateTo.getTime() - 30 * 86400 * 1000)

  const supabase = createAdminClient()

  // 1. Resolver brand + evaluar si se permite consolidado
  const { data: rest } = await supabase
    .from('restaurants')
    .select('brand_id, name')
    .eq('id', restaurantId)
    .maybeSingle()

  let shareReports = false
  let brandName: string | null = null
  let restaurantIds: string[] = [restaurantId]

  if (rest?.brand_id) {
    const { data: brand } = await supabase
      .from('brands')
      .select('name, share_reports')
      .eq('id', rest.brand_id)
      .maybeSingle()
    brandName    = brand?.name ?? null
    shareReports = !!brand?.share_reports

    if (shareReports) {
      // Todos los restaurants de la brand (via locations)
      const { data: locs } = await supabase
        .from('locations')
        .select('restaurant_id')
        .eq('brand_id', rest.brand_id)
        .not('restaurant_id', 'is', null)

      const ids = new Set<string>([restaurantId])
      ;(locs ?? []).forEach((l: { restaurant_id: string | null }) => { if (l.restaurant_id) ids.add(l.restaurant_id) })
      restaurantIds = [...ids]
    }
  }

  // 2. Query orders cobradas en el rango
  type OrderRow = {
    id: string
    restaurant_id: string
    location_id: string | null
    total: number | null
    payment_method: string | null
    cash_amount: number | null
    digital_amount: number | null
    created_at: string
    cash_registered_at: string | null
  }
  const { data: orders } = await supabase
    .from('orders')
    .select('id, restaurant_id, location_id, total, payment_method, cash_amount, digital_amount, created_at, cash_registered_at')
    .in('restaurant_id', restaurantIds)
    .eq('status', 'paid')
    .gte('cash_registered_at', dateFrom.toISOString())
    .lte('cash_registered_at', dateTo.toISOString())

  const ordersArr = (orders ?? []) as OrderRow[]

  // 3. Catálogo de locations para nombres
  const { data: allLocs } = await supabase
    .from('locations')
    .select('id, name, restaurant_id')
    .in('restaurant_id', restaurantIds)

  type LocRow = { id: string; name: string; restaurant_id: string | null }
  const locationsById = new Map<string, LocRow>(
    ((allLocs ?? []) as LocRow[]).map(l => [l.id, l]),
  )

  // 4. Agregaciones
  const total       = ordersArr.reduce((s: number, o: OrderRow) => s + (o.total ?? 0), 0)
  const totalCash   = ordersArr.reduce((s: number, o: OrderRow) => s + (o.cash_amount ?? 0), 0)
  const totalDigital = ordersArr.reduce((s: number, o: OrderRow) => s + (o.digital_amount ?? 0), 0)
  const count       = ordersArr.length
  const avgTicket   = count > 0 ? Math.round(total / count) : 0

  // Por location
  const byLocation: Record<string, { location_id: string | null; location_name: string; revenue: number; orders: number; cash: number; digital: number }> = {}
  for (const o of ordersArr) {
    const key = o.location_id ?? '__noloc__'
    const name = o.location_id ? (locationsById.get(o.location_id)?.name ?? 'Sin local') : 'Sin local'
    if (!byLocation[key]) byLocation[key] = { location_id: o.location_id ?? null, location_name: name, revenue: 0, orders: 0, cash: 0, digital: 0 }
    byLocation[key].revenue += (o.total ?? 0)
    byLocation[key].orders  += 1
    byLocation[key].cash    += (o.cash_amount ?? 0)
    byLocation[key].digital += (o.digital_amount ?? 0)
  }

  // Por día
  const byDay: Record<string, { date: string; revenue: number; orders: number }> = {}
  for (const o of ordersArr) {
    const day = (o.cash_registered_at ?? o.created_at).split('T')[0]
    if (!byDay[day]) byDay[day] = { date: day, revenue: 0, orders: 0 }
    byDay[day].revenue += (o.total ?? 0)
    byDay[day].orders  += 1
  }
  const byDayArr = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    brand_name:      brandName,
    share_reports:   shareReports,
    restaurants_included: restaurantIds.length,
    date_from: dateFrom.toISOString(),
    date_to:   dateTo.toISOString(),
    summary: {
      total,
      total_cash:    totalCash,
      total_digital: totalDigital,
      orders_count:  count,
      avg_ticket:    avgTicket,
    },
    by_location: Object.values(byLocation).sort((a, b) => b.revenue - a.revenue),
    by_day:      byDayArr,
  })
}
