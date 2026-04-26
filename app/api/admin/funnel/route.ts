import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/funnel?days=30
//
// Funnel de activación de restaurantes registrados en el período. Muestra
// cuántos llegaron a cada hito de onboarding:
//
//   1. registered       → restaurants creados en el período
//   2. with_menu        → de esos, cuántos tienen ≥1 menu_item.available=true
//   3. with_qr          → cuántos tienen ≥1 tabla creada
//   4. first_order_paid → cuántos tienen ≥1 order con status='paid'
//
// Permite ver dónde se rompe el onboarding y atacar ese punto.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function isAuthorized(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || adminSecret.length < 20) return false
  return req.headers.get('x-admin-secret') === adminSecret
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const daysParam = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 30
  const since = new Date(Date.now() - days * 86400000).toISOString()

  // 1. Restaurants registrados en el período
  const { data: restaurants, error: rErr } = await supabase
    .from('restaurants')
    .select('id, name, slug, created_at, plan')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 })
  }

  const restIds = (restaurants ?? []).map(r => r.id)
  if (restIds.length === 0) {
    return NextResponse.json({
      period_days: days,
      stages: { registered: 0, with_menu: 0, with_qr: 0, first_order_paid: 0 },
      stage_pct: { with_menu: 0, with_qr: 0, first_order_paid: 0 },
      drop_off: { menu: 0, qr: 0, order: 0 },
    })
  }

  // 2. with_menu — restaurants con al menos 1 menu_item disponible
  const { data: menuRows } = await supabase
    .from('menu_items')
    .select('restaurant_id')
    .in('restaurant_id', restIds)
    .eq('available', true)

  const withMenuSet = new Set((menuRows ?? []).map(m => m.restaurant_id))

  // 3. with_qr — restaurants con al menos 1 tabla
  const { data: tableRows } = await supabase
    .from('tables')
    .select('restaurant_id')
    .in('restaurant_id', restIds)

  const withQrSet = new Set((tableRows ?? []).map(t => t.restaurant_id))

  // 4. first_order_paid — restaurants con al menos 1 order paid
  const { data: orderRows } = await supabase
    .from('orders')
    .select('restaurant_id')
    .in('restaurant_id', restIds)
    .eq('status', 'paid')

  const firstOrderSet = new Set((orderRows ?? []).map(o => o.restaurant_id))

  const registered = restaurants?.length ?? 0
  const withMenu = withMenuSet.size
  const withQr = withQrSet.size
  const firstOrderPaid = firstOrderSet.size

  const pct = (n: number) => (registered > 0 ? Math.round((n / registered) * 100) : 0)

  // Cohort detalle: cada restaurant con sus flags (para drill-down futuro)
  const cohort = (restaurants ?? []).map(r => ({
    id:               r.id,
    name:             r.name,
    slug:             r.slug,
    created_at:       r.created_at,
    plan:             r.plan,
    has_menu:         withMenuSet.has(r.id),
    has_qr:           withQrSet.has(r.id),
    has_paid_order:   firstOrderSet.has(r.id),
  }))

  return NextResponse.json({
    period_days: days,
    stages: {
      registered,
      with_menu:        withMenu,
      with_qr:          withQr,
      first_order_paid: firstOrderPaid,
    },
    stage_pct: {
      with_menu:        pct(withMenu),
      with_qr:          pct(withQr),
      first_order_paid: pct(firstOrderPaid),
    },
    drop_off: {
      menu:  registered - withMenu,
      qr:    withMenu - withQr,
      order: withQr - firstOrderPaid,
    },
    cohort,
  })
}
