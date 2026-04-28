import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/upgrades?weeks=8
//
// Devuelve upgrades/downgrades de plan de restaurants en las últimas N semanas.
// Lee de la tabla `restaurant_audit` (migration 062).
//
// Output:
//   • by_week: serie de { week_start: 'YYYY-MM-DD', upgrades: N, downgrades: N }
//   • events:  últimos 50 cambios con detalle (restaurant, old→new, fecha)
//
// "Upgrade" se define por orden: free < starter < pro < enterprise.
// Cualquier cambio ascendente cuenta como upgrade, descendente como downgrade.
// Si el plan no es uno de los conocidos, se ignora.
//
// Auth: x-admin-secret. Sprint 4.1.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PLAN_RANK: Record<string, number> = {
  free:       0,
  starter:    1,
  pro:        2,
  enterprise: 3,
}

function classify(oldPlan: string | null, newPlan: string | null): 'upgrade' | 'downgrade' | 'unknown' {
  const o = oldPlan ? PLAN_RANK[oldPlan] : undefined
  const n = newPlan ? PLAN_RANK[newPlan] : undefined
  if (o == null || n == null) return 'unknown'
  if (n > o) return 'upgrade'
  if (n < o) return 'downgrade'
  return 'unknown'
}

function isAuthorized(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || adminSecret.length < 20) return false
  return req.headers.get('x-admin-secret') === adminSecret
}

/** Lunes 00:00 UTC del ISO-week que contiene `d`. */
function weekStart(d: Date): string {
  const c = new Date(d)
  c.setUTCHours(0, 0, 0, 0)
  // 0=Sun, 1=Mon ... 6=Sat. Queremos lunes como inicio.
  const dow = c.getUTCDay()
  const diff = dow === 0 ? -6 : 1 - dow
  c.setUTCDate(c.getUTCDate() + diff)
  return c.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weeksParam = parseInt(req.nextUrl.searchParams.get('weeks') ?? '8', 10)
  const weeks = Number.isFinite(weeksParam) && weeksParam > 0 ? Math.min(weeksParam, 52) : 8
  const since = new Date(Date.now() - weeks * 7 * 86400000).toISOString()

  // 1. Cambios de plan en el rango. La tabla puede no existir si la migration
  //    062 no se aplicó; devolvemos respuesta vacía con hint en ese caso.
  const { data: audits, error } = await supabase
    .from('restaurant_audit')
    .select('id, restaurant_id, old_value, new_value, changed_at, restaurants(name, slug)')
    .eq('field', 'plan')
    .gte('changed_at', since)
    .order('changed_at', { ascending: false })

  if (error) {
    // Tabla no existe (migration pendiente)
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      return NextResponse.json({
        period_weeks:    weeks,
        migration_pending: true,
        note:            'Migration 062 (restaurant_audit) no aplicada — sin datos históricos disponibles.',
        by_week:         [],
        events:          [],
        totals:          { upgrades: 0, downgrades: 0 },
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 2. Construir serie por semana (lunes a lunes), todos los buckets en 0
  const buckets = new Map<string, { week_start: string; upgrades: number; downgrades: number }>()
  for (let i = 0; i < weeks; i++) {
    const weekDate = new Date(Date.now() - (weeks - 1 - i) * 7 * 86400000)
    const ws = weekStart(weekDate)
    if (!buckets.has(ws)) buckets.set(ws, { week_start: ws, upgrades: 0, downgrades: 0 })
  }

  // 3. Eventos clasificados + acumulación en buckets
  let totalUp = 0
  let totalDown = 0
  const events = (audits ?? []).map(a => {
    const kind = classify(a.old_value, a.new_value)
    if (kind === 'upgrade') totalUp++
    else if (kind === 'downgrade') totalDown++

    const ws = weekStart(new Date(a.changed_at))
    const b = buckets.get(ws)
    if (b) {
      if (kind === 'upgrade') b.upgrades++
      else if (kind === 'downgrade') b.downgrades++
    }

    // Supabase devuelve `restaurants` como objeto o array según FK; tipamos defensivo
    const rest = Array.isArray(a.restaurants) ? a.restaurants[0] : a.restaurants
    return {
      id:            a.id,
      restaurant_id: a.restaurant_id,
      restaurant_name: rest?.name ?? null,
      restaurant_slug: rest?.slug ?? null,
      old_plan:      a.old_value,
      new_plan:      a.new_value,
      kind,
      changed_at:    a.changed_at,
    }
  })

  return NextResponse.json({
    period_weeks: weeks,
    migration_pending: false,
    totals: {
      upgrades:   totalUp,
      downgrades: totalDown,
    },
    by_week: Array.from(buckets.values()).sort((a, b) => a.week_start.localeCompare(b.week_start)),
    events:  events.slice(0, 50),
  })
}
