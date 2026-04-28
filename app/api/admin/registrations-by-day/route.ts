import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/registrations-by-day?days=30
//
// Devuelve registraciones de restaurants agrupadas por día. Para el gráfico
// del centro de mando del founder.
//
// Output: array de { date: 'YYYY-MM-DD', count: N }, todos los días del rango
// (incluyendo días sin registraciones, count=0). El frontend ya recibe la
// serie completa, no tiene que rellenar gaps.
//
// Auth: x-admin-secret. Sprint 4.3.
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
  const since = new Date(Date.now() - days * 86400000)
  // Normalizar a inicio del día para que el rango sea consistente
  since.setUTCHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('restaurants')
    .select('created_at')
    .gte('created_at', since.toISOString())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Agrupar por día (YYYY-MM-DD en UTC para evitar drift por timezones)
  const counts = new Map<string, number>()
  for (const r of data ?? []) {
    if (!r.created_at) continue
    const day = r.created_at.slice(0, 10)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }

  // Construir serie completa con días vacíos en 0
  const series: Array<{ date: string; count: number }> = []
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86400000)
    const key = d.toISOString().slice(0, 10)
    series.push({ date: key, count: counts.get(key) ?? 0 })
  }

  const total = series.reduce((s, p) => s + p.count, 0)
  const max = series.reduce((m, p) => Math.max(m, p.count), 0)
  const avgPerDay = days > 0 ? total / days : 0

  return NextResponse.json({
    period_days: days,
    total,
    max_per_day: max,
    avg_per_day: Math.round(avgPerDay * 10) / 10,
    series,
  })
}
