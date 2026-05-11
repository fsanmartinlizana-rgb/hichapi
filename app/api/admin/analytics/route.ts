/**
 * GET /api/admin/analytics
 *
 * Datos del tab Analytics del dashboard founder. Auth: header x-admin-secret
 * (mismo patrón que /api/admin/dashboard — no Supabase auth porque el
 * dashboard usa una clave compartida).
 *
 * Devuelve overview, tendencia, top queries, top zonas, top restaurants
 * (page views + clicks), búsquedas sin resultado, costos de Google Places.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function isAuthorized(req: NextRequest) {
  const s = process.env.ADMIN_SECRET
  if (!s || s.length < 20) return false
  return req.headers.get('x-admin-secret') === s
}

function dateNDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const period = req.nextUrl.searchParams.get('period') ?? '30d'
  const days   = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const since  = dateNDaysAgo(days)
  const since30 = dateNDaysAgo(30)
  const since7  = dateNDaysAgo(7)
  const since1  = dateNDaysAgo(1)

  // ── Overview cards ───────────────────────────────────────────────────────
  const [searchTotal30, searchTotal7, searchTotal1, pvTotal30, pvTotal7, pvTotal1] = await Promise.all([
    supabase.from('search_events').select('id', { count: 'exact', head: true }).gte('created_at', since30),
    supabase.from('search_events').select('id', { count: 'exact', head: true }).gte('created_at', since7),
    supabase.from('search_events').select('id', { count: 'exact', head: true }).gte('created_at', since1),
    supabase.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', since30),
    supabase.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', since7),
    supabase.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', since1),
  ])

  // % búsquedas sin resultado (últimos 30d)
  const { count: noResultsCount30 } = await supabase
    .from('search_events')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since30)
    .eq('no_results_in_zone', true)
  const pctNoResults30 = (searchTotal30.count ?? 0) > 0
    ? ((noResultsCount30 ?? 0) / (searchTotal30.count ?? 1)) * 100
    : 0

  // Sesiones únicas (DISTINCT session_id) — Supabase no soporta count(distinct)
  // directo, derivamos en JS pidiendo solo session_id de los últimos N días.
  async function uniqueSessions(sinceISO: string): Promise<number> {
    const [se, pv] = await Promise.all([
      supabase.from('search_events').select('session_id').gte('created_at', sinceISO).limit(10000),
      supabase.from('page_views').select('session_id').gte('created_at', sinceISO).limit(10000),
    ])
    const set = new Set<string>()
    for (const r of (se.data ?? []) as { session_id: string }[]) set.add(r.session_id)
    for (const r of (pv.data ?? []) as { session_id: string }[]) set.add(r.session_id)
    return set.size
  }
  const [sess30, sess7, sess1] = await Promise.all([
    uniqueSessions(since30), uniqueSessions(since7), uniqueSessions(since1),
  ])

  // ── Tendencia: búsquedas por día últimos 30d ─────────────────────────────
  const { data: searchSeries } = await supabase
    .from('search_events')
    .select('created_at')
    .gte('created_at', since30)
    .limit(20000)

  const trend = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
    trend.set(d, 0)
  }
  for (const row of (searchSeries ?? []) as { created_at: string }[]) {
    const d = row.created_at.slice(0, 10)
    if (trend.has(d)) trend.set(d, (trend.get(d) ?? 0) + 1)
  }
  const trendData = Array.from(trend.entries()).map(([date, count]) => ({ date, count }))

  // ── Top queries (últimos `days`) ─────────────────────────────────────────
  const { data: queryRows } = await supabase
    .from('search_events')
    .select('query_text, created_at')
    .gte('created_at', since)
    .limit(10000)

  const queryMap = new Map<string, { count: number; last: string }>()
  for (const r of (queryRows ?? []) as { query_text: string; created_at: string }[]) {
    const k = r.query_text.toLowerCase().trim()
    const prev = queryMap.get(k)
    if (prev) {
      prev.count++
      if (r.created_at > prev.last) prev.last = r.created_at
    } else {
      queryMap.set(k, { count: 1, last: r.created_at })
    }
  }
  const topQueries = Array.from(queryMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([query, v]) => ({ query, count: v.count, last_at: v.last }))

  // ── Top zonas buscadas ───────────────────────────────────────────────────
  const { data: zoneRows } = await supabase
    .from('search_events')
    .select('zone_detected, no_results_in_zone')
    .gte('created_at', since)
    .not('zone_detected', 'is', null)
    .limit(10000)

  const zoneMap = new Map<string, { count: number; noResults: number }>()
  for (const r of (zoneRows ?? []) as { zone_detected: string; no_results_in_zone: boolean }[]) {
    const z = r.zone_detected
    const prev = zoneMap.get(z) ?? { count: 0, noResults: 0 }
    prev.count++
    if (r.no_results_in_zone) prev.noResults++
    zoneMap.set(z, prev)
  }
  const topZones = Array.from(zoneMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([zone, v]) => ({
      zone,
      count: v.count,
      no_results_pct: v.count > 0 ? (v.noResults / v.count) * 100 : 0,
    }))

  // ── Top restaurants más vistos (page views) ──────────────────────────────
  const { data: rViewsRows } = await supabase
    .from('page_views')
    .select('restaurant_id, path')
    .gte('created_at', since)
    .not('restaurant_id', 'is', null)
    .limit(20000)

  const rViewMap = new Map<string, number>()
  for (const r of (rViewsRows ?? []) as { restaurant_id: string }[]) {
    rViewMap.set(r.restaurant_id, (rViewMap.get(r.restaurant_id) ?? 0) + 1)
  }
  const topViewIds = Array.from(rViewMap.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 20)
  const viewIds = topViewIds.map(([id]) => id)
  const { data: viewRestNames } = viewIds.length > 0
    ? await supabase.from('restaurants').select('id, name, slug, neighborhood').in('id', viewIds)
    : { data: [] }
  const nameById = new Map<string, { name: string; slug: string; neighborhood: string | null }>()
  for (const r of (viewRestNames ?? []) as { id: string; name: string; slug: string; neighborhood: string | null }[]) {
    nameById.set(r.id, { name: r.name, slug: r.slug, neighborhood: r.neighborhood })
  }
  const topViewedRestaurants = topViewIds.map(([id, c]) => ({
    id, views: c,
    name: nameById.get(id)?.name ?? 'Unknown',
    slug: nameById.get(id)?.slug ?? '',
    neighborhood: nameById.get(id)?.neighborhood ?? null,
  }))

  // ── Top restaurants más clickeados desde búsqueda ────────────────────────
  const { data: clickRows } = await supabase
    .from('search_result_events')
    .select('restaurant_id')
    .gte('created_at', since)
    .eq('clicked', true)
    .limit(20000)
  const clickMap = new Map<string, number>()
  for (const r of (clickRows ?? []) as { restaurant_id: string }[]) {
    clickMap.set(r.restaurant_id, (clickMap.get(r.restaurant_id) ?? 0) + 1)
  }
  const topClickedIds = Array.from(clickMap.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 20)
  const cIds = topClickedIds.map(([id]) => id)
  const { data: clickRestNames } = cIds.length > 0
    ? await supabase.from('restaurants').select('id, name, slug, neighborhood').in('id', cIds)
    : { data: [] }
  const cNameById = new Map<string, { name: string; slug: string; neighborhood: string | null }>()
  for (const r of (clickRestNames ?? []) as { id: string; name: string; slug: string; neighborhood: string | null }[]) {
    cNameById.set(r.id, { name: r.name, slug: r.slug, neighborhood: r.neighborhood })
  }
  const topClickedRestaurants = topClickedIds.map(([id, c]) => ({
    id, clicks: c,
    name: cNameById.get(id)?.name ?? 'Unknown',
    slug: cNameById.get(id)?.slug ?? '',
    neighborhood: cNameById.get(id)?.neighborhood ?? null,
  }))

  // ── Búsquedas sin resultado por zona (oportunidades) ─────────────────────
  const { data: noResRows } = await supabase
    .from('search_events')
    .select('zone_detected, failure_reason')
    .gte('created_at', since30)
    .eq('no_results_in_zone', true)
    .not('zone_detected', 'is', null)
    .limit(10000)

  const noResMap = new Map<string, number>()
  for (const r of (noResRows ?? []) as { zone_detected: string }[]) {
    noResMap.set(r.zone_detected, (noResMap.get(r.zone_detected) ?? 0) + 1)
  }
  const opportunityZones = Array.from(noResMap.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([zone, count]) => ({ zone, count }))

  // ── Distribución de failure_reason (últimos 30d) ─────────────────────────
  // Permite priorizar: ¿hay que enriquecer zonas, pedirle a owners que taguen
  // dietary, o revisar pricing? Cada categoría requiere acción distinta.
  const failureCounts: Record<string, number> = {
    no_zone_coverage: 0,
    no_cuisine_match: 0,
    no_dietary_match: 0,
    no_budget_match:  0,
    enrichment_skipped: 0,
  }
  for (const r of (noResRows ?? []) as { failure_reason: string | null }[]) {
    const k = r.failure_reason
    if (k && k in failureCounts) failureCounts[k]++
  }
  const failureBreakdown = Object.entries(failureCounts)
    .map(([reason, count]) => ({ reason, count }))

  // ── Costos Google Places (mes actual) ────────────────────────────────────
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1); startOfMonth.setUTCHours(0, 0, 0, 0)
  const { data: spendRows } = await supabase
    .from('enrichment_log')
    .select('cost_usd, text_search_count, photo_count, last_enriched_at')
    .gte('last_enriched_at', startOfMonth.toISOString())

  let spendUsd = 0, textCalls = 0, photoCalls = 0
  for (const r of (spendRows ?? []) as { cost_usd: number | string; text_search_count: number; photo_count: number }[]) {
    spendUsd   += Number(r.cost_usd ?? 0)
    textCalls  += Number(r.text_search_count ?? 0)
    photoCalls += Number(r.photo_count ?? 0)
  }
  const budgetUsd = Number(process.env.GOOGLE_PLACES_MONTHLY_BUDGET_USD ?? 50)
  const pctBudget = budgetUsd > 0 ? (spendUsd / budgetUsd) * 100 : 0
  // Proyección lineal a fin de mes
  const daysIntoMonth = Math.max(1, new Date().getUTCDate())
  const daysInMonth   = new Date(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0).getUTCDate()
  const projectedEom  = (spendUsd / daysIntoMonth) * daysInMonth

  return NextResponse.json({
    period,
    overview: {
      searches:   { d1: searchTotal1.count ?? 0, d7: searchTotal7.count ?? 0, d30: searchTotal30.count ?? 0 },
      page_views: { d1: pvTotal1.count ?? 0,     d7: pvTotal7.count ?? 0,     d30: pvTotal30.count ?? 0 },
      sessions:   { d1: sess1, d7: sess7, d30: sess30 },
      pct_no_results_30d: Number(pctNoResults30.toFixed(1)),
    },
    trend:                  trendData,
    top_queries:            topQueries,
    top_zones:              topZones,
    top_viewed_restaurants: topViewedRestaurants,
    top_clicked_restaurants: topClickedRestaurants,
    opportunity_zones:      opportunityZones,
    failure_breakdown:      failureBreakdown,
    costs: {
      month_spend_usd:    Number(spendUsd.toFixed(2)),
      month_budget_usd:   budgetUsd,
      pct_budget:         Number(pctBudget.toFixed(1)),
      projected_eom_usd:  Number(projectedEom.toFixed(2)),
      text_search_count:  textCalls,
      photo_count:        photoCalls,
    },
  })
}
