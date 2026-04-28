import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/risks
//
// Restaurantes en riesgo de churn / atascados en activación. Calcula flags
// por restaurant y un score de urgencia para que el founder sepa A QUIÉN
// LLAMAR MAÑANA antes de perderlo.
//
// Flags:
//   • no_orders_3d:    paid plan + 0 pedidos pagados últimos 3 días → URGENT
//   • no_orders_7d:    paid plan + 0 pedidos pagados últimos 7 días
//   • incomplete_menu: signup >7d + <5 menu items disponibles (activación rota)
//   • no_qr:           signup >7d + 0 tables (activación rota)
//   • inactive:        restaurant.active = false (ya está desactivado)
//
// Score de urgencia (0-100): qué tan al rojo está. El founder ordena por esto.
//
// Auth: x-admin-secret. Sprint 4.2.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PAID_PLANS = new Set(['starter', 'pro', 'enterprise'])

function isAuthorized(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || adminSecret.length < 20) return false
  return req.headers.get('x-admin-secret') === adminSecret
}

interface RiskFlag {
  no_orders_3d:    boolean
  no_orders_7d:    boolean
  incomplete_menu: boolean
  no_qr:           boolean
  inactive:        boolean
}

interface RestaurantRisk {
  id:                string
  name:              string
  slug:              string
  plan:              string
  active:            boolean
  neighborhood:      string | null
  days_since_signup: number
  last_paid_order_at: string | null
  days_since_last_order: number | null
  menu_items_count:  number
  tables_count:      number
  flags:             RiskFlag
  flags_active:      Array<keyof RiskFlag>
  urgency:           number
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Todos los restaurants (activos y desactivados — el founder quiere ver
  //    también los que ya churnearon, marcados con flag inactive)
  const { data: restaurants, error: rErr } = await supabase
    .from('restaurants')
    .select('id, name, slug, plan, active, neighborhood, created_at')

  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 })
  }
  if (!restaurants || restaurants.length === 0) {
    return NextResponse.json({ restaurants: [], total: 0 })
  }

  const restIds = restaurants.map(r => r.id)
  const now = Date.now()
  const since3d = new Date(now - 3 * 86400000).toISOString()
  const since7d = new Date(now - 7 * 86400000).toISOString()

  // 2. Pedidos pagados últimos 3 y 7 días — agrupados por restaurant
  const [orders3dRes, orders7dRes, allPaidOrdersRes] = await Promise.all([
    supabase
      .from('orders')
      .select('restaurant_id')
      .in('restaurant_id', restIds)
      .eq('status', 'paid')
      .gte('created_at', since3d),
    supabase
      .from('orders')
      .select('restaurant_id')
      .in('restaurant_id', restIds)
      .eq('status', 'paid')
      .gte('created_at', since7d),
    // Para "días desde último pedido" — traemos el más reciente paid por
    // restaurant. Limitamos columnas para no tirar ancho de banda.
    supabase
      .from('orders')
      .select('restaurant_id, created_at')
      .in('restaurant_id', restIds)
      .eq('status', 'paid')
      .order('created_at', { ascending: false }),
  ])

  const orders3dSet = new Set((orders3dRes.data ?? []).map(o => o.restaurant_id))
  const orders7dSet = new Set((orders7dRes.data ?? []).map(o => o.restaurant_id))

  // Último pedido pagado por restaurant (la query ya viene ordenada DESC,
  // entonces el primero que vemos por id es el más reciente)
  const lastOrderByRestaurant = new Map<string, string>()
  for (const o of allPaidOrdersRes.data ?? []) {
    if (!lastOrderByRestaurant.has(o.restaurant_id)) {
      lastOrderByRestaurant.set(o.restaurant_id, o.created_at)
    }
  }

  // 3. Menu items disponibles por restaurant
  const { data: menuRows } = await supabase
    .from('menu_items')
    .select('restaurant_id')
    .in('restaurant_id', restIds)
    .eq('available', true)

  const menuCountByRest = new Map<string, number>()
  for (const m of menuRows ?? []) {
    menuCountByRest.set(m.restaurant_id, (menuCountByRest.get(m.restaurant_id) ?? 0) + 1)
  }

  // 4. Tables (QR) por restaurant
  const { data: tableRows } = await supabase
    .from('tables')
    .select('restaurant_id')
    .in('restaurant_id', restIds)

  const tablesCountByRest = new Map<string, number>()
  for (const t of tableRows ?? []) {
    tablesCountByRest.set(t.restaurant_id, (tablesCountByRest.get(t.restaurant_id) ?? 0) + 1)
  }

  // 5. Computar flags + urgencia por restaurant
  const result: RestaurantRisk[] = restaurants.map(r => {
    const plan = r.plan ?? 'free'
    const isPaid = PAID_PLANS.has(plan)
    const daysSinceSignup = r.created_at
      ? Math.floor((now - new Date(r.created_at).getTime()) / 86400000)
      : 0

    const lastOrderIso = lastOrderByRestaurant.get(r.id) ?? null
    const daysSinceLastOrder = lastOrderIso
      ? Math.floor((now - new Date(lastOrderIso).getTime()) / 86400000)
      : null

    const menuCount = menuCountByRest.get(r.id) ?? 0
    const tablesCount = tablesCountByRest.get(r.id) ?? 0

    const flags: RiskFlag = {
      // Solo aplica a paying customers — un free sin pedidos no es churn de revenue
      no_orders_3d:    isPaid && r.active === true && !orders3dSet.has(r.id),
      no_orders_7d:    isPaid && r.active === true && !orders7dSet.has(r.id),
      // Activación atascada: ya pasó la luna de miel y no llenaron lo básico
      incomplete_menu: r.active === true && daysSinceSignup > 7 && menuCount < 5,
      no_qr:           r.active === true && daysSinceSignup > 7 && tablesCount === 0,
      inactive:        r.active === false,
    }

    // Score de urgencia: qué tan al rojo. Cero = todo OK.
    let urgency = 0
    if (flags.no_orders_3d)    urgency = Math.max(urgency, 100)
    else if (flags.no_orders_7d) urgency = Math.max(urgency, 80)
    if (flags.incomplete_menu) urgency = Math.max(urgency, 70)
    if (flags.no_qr)           urgency = Math.max(urgency, 60)
    if (flags.inactive)        urgency = Math.max(urgency, 40)

    // Bonus de severidad: enterprise > pro > starter
    if (urgency > 0) {
      if (plan === 'enterprise') urgency = Math.min(100, urgency + 10)
      else if (plan === 'pro')   urgency = Math.min(100, urgency + 5)
    }

    const flagsActive = (Object.keys(flags) as Array<keyof RiskFlag>)
      .filter(k => flags[k])

    return {
      id:                    r.id,
      name:                  r.name,
      slug:                  r.slug,
      plan,
      active:                r.active === true,
      neighborhood:          r.neighborhood,
      days_since_signup:     daysSinceSignup,
      last_paid_order_at:    lastOrderIso,
      days_since_last_order: daysSinceLastOrder,
      menu_items_count:      menuCount,
      tables_count:          tablesCount,
      flags,
      flags_active:          flagsActive,
      urgency,
    }
  })

  // Solo devolvemos los que tienen al menos un flag activo, ordenados por urgencia
  const atRisk = result
    .filter(r => r.flags_active.length > 0)
    .sort((a, b) => b.urgency - a.urgency)

  return NextResponse.json({
    total:           atRisk.length,
    total_evaluated: restaurants.length,
    restaurants:     atRisk,
  })
}
