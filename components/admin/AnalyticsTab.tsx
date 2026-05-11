'use client'

/**
 * AnalyticsTab — pestaña Analytics del dashboard founder.
 *
 * Lee de /api/admin/analytics (auth con x-admin-secret).
 * Renderiza:
 *   1. Overview cards (búsquedas/page views/sesiones d1/d7/d30 + % no results)
 *   2. Tendencia de búsquedas (SVG inline, sin recharts — sigue el patrón
 *      de RegistrationsByDay para mantener bundle delgado)
 *   3. Top queries, top zonas, top restaurants vistos, top clickeados
 *   4. Oportunidades (búsquedas sin resultado por zona) + botón enriquecer
 *   5. Costos Google Places del mes con alerta visual si % > 80%
 */
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, TrendingUp, Search, Eye, MousePointer, AlertTriangle, DollarSign, MapPin, Sparkles } from 'lucide-react'

interface AnalyticsPayload {
  period: string
  overview: {
    searches:   { d1: number; d7: number; d30: number }
    page_views: { d1: number; d7: number; d30: number }
    sessions:   { d1: number; d7: number; d30: number }
    pct_no_results_30d: number
  }
  trend: Array<{ date: string; count: number }>
  top_queries: Array<{ query: string; count: number; last_at: string }>
  top_zones:   Array<{ zone: string; count: number; no_results_pct: number }>
  top_viewed_restaurants: Array<{ id: string; name: string; slug: string; neighborhood: string | null; views: number }>
  top_clicked_restaurants: Array<{ id: string; name: string; slug: string; neighborhood: string | null; clicks: number }>
  opportunity_zones: Array<{ zone: string; count: number }>
  costs: {
    month_spend_usd: number; month_budget_usd: number; pct_budget: number
    projected_eom_usd: number; text_search_count: number; photo_count: number
  }
}

interface Props { adminSecret: string; period: string }

export default function AnalyticsTab({ adminSecret, period }: Props) {
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`/api/admin/analytics?period=${period}`, {
        headers: { 'x-admin-secret': adminSecret },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error cargando analytics')
    }
    setLoading(false)
  }, [adminSecret, period])

  useEffect(() => { void load() }, [load])

  if (loading && !data) {
    return <div className="flex items-center justify-center py-12 text-white/40">
      <RefreshCw size={20} className="animate-spin" />
    </div>
  }
  if (err) return <div className="text-red-400 text-sm">{err}</div>
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card icon={Search} label="Búsquedas hoy / 7d / 30d"
          value={`${data.overview.searches.d1} / ${data.overview.searches.d7} / ${data.overview.searches.d30}`} />
        <Card icon={Eye} label="Page views hoy / 7d / 30d"
          value={`${data.overview.page_views.d1} / ${data.overview.page_views.d7} / ${data.overview.page_views.d30}`} />
        <Card icon={MousePointer} label="Sesiones únicas (30d)"
          value={data.overview.sessions.d30.toString()} />
        <Card
          icon={AlertTriangle}
          label="% búsquedas sin resultado (30d)"
          value={`${data.overview.pct_no_results_30d.toFixed(1)}%`}
          accent={data.overview.pct_no_results_30d > 25}
        />
      </section>

      {/* Tendencia */}
      <Section title="Búsquedas por día (últimos 30)" icon={TrendingUp}>
        <TrendChart series={data.trend} />
      </Section>

      {/* Costos Google Places */}
      <Section title="Google Places — gasto del mes" icon={DollarSign}>
        <CostsCard costs={data.costs} />
      </Section>

      {/* Oportunidades */}
      <Section title="Oportunidades — búsquedas sin resultado por zona" icon={Sparkles}>
        <OpportunitiesTable
          zones={data.opportunity_zones}
          adminSecret={adminSecret}
          onEnriched={load}
        />
      </Section>

      {/* Top queries / zonas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="Top 20 queries" icon={Search}>
          <SimpleList
            rows={data.top_queries.map(q => ({
              label: q.query,
              value: q.count,
              sub:   `último: ${new Date(q.last_at).toLocaleDateString('es-CL')}`,
            }))}
          />
        </Section>
        <Section title="Top zonas buscadas" icon={MapPin}>
          <SimpleList
            rows={data.top_zones.map(z => ({
              label: z.zone,
              value: z.count,
              sub:   `${z.no_results_pct.toFixed(0)}% sin resultado`,
            }))}
          />
        </Section>
      </div>

      {/* Top restaurants vistos / clickeados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="Top 20 restaurants más vistos" icon={Eye}>
          <SimpleList
            rows={data.top_viewed_restaurants.map(r => ({
              label: r.name,
              value: r.views,
              sub:   r.neighborhood ?? '',
              href:  r.slug ? `/r/${r.slug}` : undefined,
            }))}
          />
        </Section>
        <Section title="Top 20 más clickeados desde búsqueda" icon={MousePointer}>
          <SimpleList
            rows={data.top_clicked_restaurants.map(r => ({
              label: r.name,
              value: r.clicks,
              sub:   r.neighborhood ?? '',
              href:  r.slug ? `/r/${r.slug}` : undefined,
            }))}
          />
        </Section>
      </div>
    </div>
  )
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

function Card({ icon: Icon, label, value, accent }: {
  icon: typeof Search; label: string; value: string; accent?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
      <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
        <Icon size={12} /> {label}
      </div>
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
    </div>
  )
}

function Section({ title, icon: Icon, children }: {
  title: string; icon: typeof Search; children: React.ReactNode
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <Icon size={14} className="text-[#FF6B35]" /> {title}
      </h3>
      {children}
    </div>
  )
}

function TrendChart({ series }: { series: Array<{ date: string; count: number }> }) {
  if (series.length === 0) return <div className="text-white/30 text-xs">Sin datos</div>
  const max = Math.max(...series.map(s => s.count), 1)
  const W = 600, H = 120, pad = 10
  const stepX = (W - pad * 2) / (series.length - 1 || 1)
  const points = series.map((s, i) => {
    const x = pad + i * stepX
    const y = H - pad - ((s.count / max) * (H - pad * 2))
    return `${x},${y}`
  }).join(' ')
  const lastDate = series[series.length - 1]?.date
  const firstDate = series[0]?.date
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32">
        <polyline points={points} fill="none" stroke="#FF6B35" strokeWidth="2" />
        {series.map((s, i) => {
          const x = pad + i * stepX
          const y = H - pad - ((s.count / max) * (H - pad * 2))
          return <circle key={s.date} cx={x} cy={y} r="2" fill="#FF6B35" />
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-white/30 mt-1">
        <span>{firstDate}</span><span>máx: {max}</span><span>{lastDate}</span>
      </div>
    </div>
  )
}

function CostsCard({ costs }: { costs: AnalyticsPayload['costs'] }) {
  const pct = costs.pct_budget
  const alertColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-white tabular-nums">${costs.month_spend_usd}</div>
          <div className="text-xs text-white/40">de ${costs.month_budget_usd} budget mensual</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-white/60">Proyección fin de mes</div>
          <div className="text-lg font-semibold text-white tabular-nums">${costs.projected_eom_usd}</div>
        </div>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${alertColor} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="flex justify-between text-xs text-white/40">
        <span>{costs.text_search_count} text searches</span>
        <span>{costs.photo_count} photos</span>
        <span className={pct > 80 ? 'text-red-400 font-semibold' : ''}>{pct.toFixed(1)}% consumido</span>
      </div>
    </div>
  )
}

function OpportunitiesTable({ zones, adminSecret, onEnriched }: {
  zones: Array<{ zone: string; count: number }>
  adminSecret: string
  onEnriched: () => void
}) {
  const [pending, setPending] = useState<string | null>(null)
  async function enrich(zone: string) {
    setPending(zone)
    try {
      await fetch('/api/enrich-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone }),
      })
      onEnriched()
    } finally {
      setPending(null)
    }
  }
  if (zones.length === 0) return <div className="text-white/30 text-xs">Sin oportunidades — todas las zonas tienen cobertura</div>
  return (
    <div className="space-y-1.5">
      {zones.map(z => (
        <div key={z.zone} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/5">
          <div className="flex items-center gap-3">
            <span className="text-sm text-white">{z.zone}</span>
            <span className="text-xs text-white/40">{z.count} búsquedas</span>
          </div>
          <button
            onClick={() => enrich(z.zone)}
            disabled={pending === z.zone}
            className="text-xs px-2.5 py-1 rounded bg-[#FF6B35]/20 text-[#FF6B35] hover:bg-[#FF6B35]/30 disabled:opacity-50"
          >
            {pending === z.zone ? 'Enriqueciendo...' : 'Enriquecer zona'}
          </button>
        </div>
      ))}
      {/* Note: el botón usa el guard same-origin del endpoint — admin debe
          estar en hichapi.com o localhost para que funcione */}
    </div>
  )
}

function SimpleList({ rows }: { rows: Array<{ label: string; value: number; sub?: string; href?: string }> }) {
  if (rows.length === 0) return <div className="text-white/30 text-xs">Sin datos</div>
  return (
    <div className="space-y-1 max-h-72 overflow-y-auto">
      {rows.map((r, i) => {
        const body = (
          <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/5">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white truncate">{r.label}</div>
              {r.sub && <div className="text-[11px] text-white/40">{r.sub}</div>}
            </div>
            <div className="text-sm font-semibold text-[#FF6B35] tabular-nums ml-3">{r.value}</div>
          </div>
        )
        return r.href ? (
          <a key={i} href={r.href} target="_blank" rel="noopener noreferrer" className="block">{body}</a>
        ) : (
          <div key={i}>{body}</div>
        )
      })}
    </div>
  )
}
