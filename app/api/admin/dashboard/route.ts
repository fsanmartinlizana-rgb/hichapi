import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// ── GET /api/admin/dashboard ──────────────────────────────────────────────────
// Founder-level view of HiChapi: restaurants, orders, 1% commission, feedback
// and support tickets. Protected with the same ADMIN_SECRET as other admin APIs.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const HICHAPI_COMMISSION_RATE = 0.01 // 1 %

function isAuthorized(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || adminSecret.length < 20) return false
  return req.headers.get('x-admin-secret') === adminSecret
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const period = req.nextUrl.searchParams.get('period') ?? '30d'
  const days   = period === '7d' ? 7 : period === '90d' ? 90 : period === 'all' ? 3650 : 30
  const since  = new Date(Date.now() - days * 86400000).toISOString()

  // ── Restaurants ────────────────────────────────────────────────────────────
  const { data: restaurants, count: restaurantsCount } = await supabase
    .from('restaurants')
    .select('id, name, neighborhood, created_at, plan, active', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(200)

  type R = { id: string; name: string; neighborhood: string | null; created_at: string; plan: string | null; active: boolean | null }
  const rList = (restaurants ?? []) as R[]

  // ── Orders (period) ────────────────────────────────────────────────────────
  const { data: orders } = await supabase
    .from('orders')
    .select('id, restaurant_id, total, hichapi_commission, status, created_at, updated_at')
    .eq('status', 'paid')
    .gte('updated_at', since)

  type O = { id: string; restaurant_id: string; total: number; hichapi_commission: number | null; status: string; updated_at: string }
  const oList = (orders ?? []) as O[]

  const totalRevenue    = oList.reduce((s, o) => s + (o.total ?? 0), 0)
  const totalCommission = oList.reduce((s, o) => s + (o.hichapi_commission ?? Math.round(o.total * HICHAPI_COMMISSION_RATE)), 0)

  // Per-restaurant aggregate (top 20)
  const byRest: Record<string, { orders: number; revenue: number; commission: number }> = {}
  for (const o of oList) {
    const entry = byRest[o.restaurant_id] ?? { orders: 0, revenue: 0, commission: 0 }
    entry.orders++
    entry.revenue    += o.total ?? 0
    entry.commission += o.hichapi_commission ?? Math.round(o.total * HICHAPI_COMMISSION_RATE)
    byRest[o.restaurant_id] = entry
  }
  const topRestaurants = rList
    .map(r => ({
      id: r.id,
      name: r.name,
      neighborhood: r.neighborhood,
      plan: r.plan,
      active: r.active,
      ...(byRest[r.id] ?? { orders: 0, revenue: 0, commission: 0 }),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20)

  // ── Reviews / Feedback (period) ────────────────────────────────────────────
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, restaurant_id, rating, comment, ai_summary, sentiment, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)

  type Rev = { id: string; restaurant_id: string; rating: number; comment: string | null; ai_summary: string | null; sentiment: string | null; created_at: string }
  const revList = (reviews ?? []) as Rev[]
  const avgRating = revList.length > 0
    ? Math.round((revList.reduce((s, r) => s + r.rating, 0) / revList.length) * 10) / 10
    : null

  // ── Support tickets ────────────────────────────────────────────────────────
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, restaurant_id, subject, description, severity, status, created_at, resolved_at')
    .order('created_at', { ascending: false })
    .limit(50)

  type T = { id: string; restaurant_id: string | null; subject: string; description: string; severity: string; status: string; created_at: string; resolved_at: string | null }
  const tList = (tickets ?? []) as T[]
  const openTickets = tList.filter(t => t.status === 'open' || t.status === 'investigating').length
  const criticalOpen = tList.filter(t => t.severity === 'critical' && (t.status === 'open' || t.status === 'investigating')).length

  // ── Response ───────────────────────────────────────────────────────────────
  return NextResponse.json({
    period,
    kpis: {
      restaurants_total:  restaurantsCount ?? rList.length,
      restaurants_active: rList.filter(r => r.active !== false).length,
      orders_paid:        oList.length,
      revenue_clp:        totalRevenue,
      commission_clp:     totalCommission,
      avg_order_value:    oList.length > 0 ? Math.round(totalRevenue / oList.length) : 0,
      reviews_count:      revList.length,
      avg_rating:         avgRating,
      tickets_open:       openTickets,
      tickets_critical:   criticalOpen,
    },
    top_restaurants: topRestaurants,
    recent_reviews:  revList.slice(0, 10),
    recent_tickets:  tList.slice(0, 15),
  })
}
