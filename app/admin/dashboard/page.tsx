'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, LogIn, ExternalLink, TrendingUp, Store, ShoppingBag,
  DollarSign, Star, LifeBuoy, AlertTriangle,
} from 'lucide-react'
import ActivationFunnel from '@/components/admin/ActivationFunnel'
import AdminTicketsTab from '@/components/admin/AdminTicketsTab'
import RestaurantsAtRisk from '@/components/admin/RestaurantsAtRisk'
import RegistrationsByDay from '@/components/admin/RegistrationsByDay'
import PlanUpgrades from '@/components/admin/PlanUpgrades'
import AnalyticsTab from '@/components/admin/AnalyticsTab'
import RidersTab from '@/components/admin/RidersTab'

// ── Types ────────────────────────────────────────────────────────────────────

interface KPIs {
  restaurants_total:  number
  restaurants_active: number
  orders_paid:        number
  revenue_clp:        number
  commission_clp:     number
  avg_order_value:    number
  reviews_count:      number
  avg_rating:         number | null
  tickets_open:       number
  tickets_critical:   number
}

interface TopRestaurant {
  id:           string
  name:         string
  neighborhood: string | null
  plan:         string | null
  active:       boolean | null
  orders:       number
  revenue:      number
  commission:   number
}

interface Review {
  id:            string
  restaurant_id: string
  rating:        number
  comment:       string | null
  ai_summary:    string | null
  sentiment:     string | null
  created_at:    string
}

interface Ticket {
  id:            string
  restaurant_id: string | null
  subject:       string
  description:   string
  severity:      string
  status:        string
  created_at:    string
  resolved_at:   string | null
}

interface DashboardPayload {
  period:          string
  kpis:            KPIs
  top_restaurants: TopRestaurant[]
  recent_reviews:  Review[]
  recent_tickets:  Ticket[]
}

const PERIODS = [
  { value: '7d',  label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: 'all', label: 'Todo' },
]

const CLP = (v: number) => `$${v.toLocaleString('es-CL')}`

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FounderDashboardPage() {
  const [secret, setSecret]     = useState('')
  const [authed, setAuthed]     = useState(false)
  const [authError, setAuthErr] = useState(false)
  const [period, setPeriod]     = useState('30d')
  const [data, setData]         = useState<DashboardPayload | null>(null)
  const [loading, setLoading]   = useState(false)
  const [tab, setTab]           = useState<'restaurants' | 'reviews' | 'tickets' | 'analytics' | 'riders'>('restaurants')

  const load = useCallback(async (s = secret, p = period) => {
    setLoading(true)
    const res = await fetch(`/api/admin/dashboard?period=${p}`, {
      headers: { 'x-admin-secret': s },
    })
    if (res.status === 401) {
      setAuthed(false); setAuthErr(true); setLoading(false); return
    }
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [secret, period])

  async function handleLogin() {
    setAuthErr(false)
    const res = await fetch(`/api/admin/dashboard?period=30d`, {
      headers: { 'x-admin-secret': secret },
    })
    if (res.status === 401) { setAuthErr(true); return }
    const json = await res.json()
    setData(json)
    setAuthed(true)
  }

  useEffect(() => { if (authed) load() }, [authed, period]) // eslint-disable-line

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-strong)]">
        <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold mb-1">
            hi<span className="text-[#E55A2B]">chapi</span> · founder
          </h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">Centro de mando</p>
          <div className="flex flex-col gap-3">
            <input
              type="password"
              placeholder="Clave de acceso"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] px-4 py-3 text-sm
                         text-[var(--text-strong)] focus:outline-none focus:border-[#FF6B35] transition-colors"
            />
            {authError && <p className="text-xs text-red-700">Clave incorrecta</p>}
            <button
              onClick={handleLogin}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                         bg-[#FF6B35] hover:bg-[#e55a2b] text-white font-semibold text-sm transition-colors"
            >
              <LogIn size={15} /> Entrar
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-muted)]">
        <RefreshCw size={20} className="animate-spin" />
      </main>
    )
  }

  const k = data.kpis

  return (
    <main className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-strong)]">
      {/* Header */}
      <header className="bg-[var(--surface-card)] border-b border-[var(--border-subtle)] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold">
            hi<span className="text-[#E55A2B]">chapi</span>
            <span className="text-[var(--text-muted)] font-normal ml-2 text-sm">· Centro de mando</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--surface-sunken)] rounded-lg border border-[var(--border-subtle)] p-1">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  period === p.value ? 'bg-[#FF6B35] text-white' : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load()}
            className="p-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <a href="/admin" className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[#E55A2B] transition-colors">
            Submissions <ExternalLink size={11} />
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard icon={Store}        label="Restaurantes activos" value={`${k.restaurants_active} / ${k.restaurants_total}`} />
          <KpiCard icon={ShoppingBag}  label="Pedidos pagados"      value={k.orders_paid.toLocaleString('es-CL')} />
          <KpiCard icon={TrendingUp}   label="Revenue total"        value={CLP(k.revenue_clp)}  accent />
          <KpiCard icon={DollarSign}   label="Comisión 1% HiChapi"  value={CLP(k.commission_clp)} accent />
          <KpiCard icon={Star}         label="Rating promedio"      value={k.avg_rating !== null ? `${k.avg_rating} ★` : '—'} />
        </div>

        {/* Ticket alert — críticos sin respuesta hace >24h */}
        {(() => {
          const stale = data.recent_tickets.filter(t =>
            t.severity === 'critical'
            && (t.status === 'open' || t.status === 'investigating')
            && Date.now() - new Date(t.created_at).getTime() > 24 * 3600 * 1000
          )
          if (stale.length > 0) {
            return (
              <button
                onClick={() => setTab('tickets')}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/15 transition-colors text-left"
              >
                <AlertTriangle size={18} className="text-red-700 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-200 font-semibold">
                    {stale.length} ticket{stale.length > 1 ? 's' : ''} crítico{stale.length > 1 ? 's' : ''} sin respuesta hace &gt;24h
                  </p>
                  <p className="text-xs text-red-700/70 mt-0.5 truncate">
                    {stale[0].subject}
                  </p>
                </div>
                <span className="text-xs text-red-700/60">Ver →</span>
              </button>
            )
          }
          if (k.tickets_critical > 0) {
            return (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle size={18} className="text-amber-700 shrink-0" />
                <p className="text-sm text-amber-200">
                  {k.tickets_critical} ticket{k.tickets_critical > 1 ? 's' : ''} crítico{k.tickets_critical > 1 ? 's' : ''} abierto{k.tickets_critical > 1 ? 's' : ''}.
                </p>
              </div>
            )
          }
          return null
        })()}

        {/* Nuevos restaurantes por día */}
        <RegistrationsByDay
          adminSecret={secret}
          days={period === '7d' ? 7 : period === '90d' ? 90 : period === 'all' ? 90 : 30}
        />

        {/* Funnel de activación de restaurantes */}
        <ActivationFunnel
          adminSecret={secret}
          days={period === '7d' ? 7 : period === '90d' ? 90 : period === 'all' ? 365 : 30}
        />

        {/* Upgrades / downgrades de plan por semana (necesita migration 062) */}
        <PlanUpgrades adminSecret={secret} weeks={8} />

        {/* Restaurantes en riesgo de churn / atascados en activación */}
        <RestaurantsAtRisk adminSecret={secret} />

        {/* Tabs */}
        <div className="flex gap-1 bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-1 w-fit flex-wrap">
          {([
            { id: 'restaurants', label: `Top restaurantes (${data.top_restaurants.length})` },
            { id: 'reviews',     label: `Feedback (${k.reviews_count})` },
            { id: 'tickets',     label: `Soporte (${k.tickets_open} abiertos)` },
            { id: 'analytics',   label: `Analytics` },
            { id: 'riders',      label: `Repartidores` },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-[#FF6B35] text-white' : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'restaurants' && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-sunken)] border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="px-4 py-3 text-left  text-[var(--text-muted)] text-xs font-medium">Restaurante</th>
                  <th className="px-4 py-3 text-left  text-[var(--text-muted)] text-xs font-medium">Plan</th>
                  <th className="px-4 py-3 text-right text-[var(--text-muted)] text-xs font-medium">Pedidos</th>
                  <th className="px-4 py-3 text-right text-[var(--text-muted)] text-xs font-medium">Revenue</th>
                  <th className="px-4 py-3 text-right text-[var(--text-muted)] text-xs font-medium">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {data.top_restaurants.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)]">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-[var(--text-muted)] text-xs">{r.neighborhood ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs capitalize">{r.plan ?? 'free'}</td>
                    <td className="px-4 py-3 text-right font-mono">{r.orders}</td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--text-body)]">{CLP(r.revenue)}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#E55A2B]">{CLP(r.commission)}</td>
                  </tr>
                ))}
                {data.top_restaurants.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">Sin restaurantes en el período</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reviews' && (
          <div className="space-y-2">
            {data.recent_reviews.map(r => (
              <div key={r.id} className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#E55A2B] font-mono text-sm">{'★'.repeat(r.rating)}<span className="text-[var(--text-muted)]">{'★'.repeat(5 - r.rating)}</span></span>
                    {r.sentiment && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                        r.sentiment === 'positive' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700' :
                        r.sentiment === 'negative' ? 'bg-red-500/10 border-red-500/30 text-red-700' :
                        'bg-[var(--surface-sunken)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                      }`}>{r.sentiment}</span>
                    )}
                  </div>
                  <span className="text-[var(--text-muted)] text-xs">{new Date(r.created_at).toLocaleDateString('es-CL')}</span>
                </div>
                {r.comment && <p className="text-sm text-[var(--text-body)]">{r.comment}</p>}
                {r.ai_summary && <p className="text-xs text-[var(--text-muted)] mt-1 italic">{r.ai_summary}</p>}
              </div>
            ))}
            {data.recent_reviews.length === 0 && (
              <div className="text-center py-10 text-[var(--text-muted)]">Sin reseñas en el período</div>
            )}
          </div>
        )}

        {tab === 'tickets' && (
          <AdminTicketsTab
            tickets={data.recent_tickets}
            adminSecret={secret}
            onRefresh={() => load()}
          />
        )}

        {tab === 'analytics' && (
          <AnalyticsTab adminSecret={secret} period={period} />
        )}

        {tab === 'riders' && (
          <RidersTab adminSecret={secret} />
        )}
      </div>
    </main>
  )
}

function KpiCard({ icon: Icon, label, value, accent }: {
  icon: React.ElementType
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className={`p-4 rounded-xl border ${accent ? 'bg-[#FF6B35]/10 border-[#FF6B35]/30' : 'bg-[var(--surface-sunken)] border-[var(--border-subtle)]'}`}>
      <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs mb-1">
        <Icon size={12} /> {label}
      </div>
      <p className={`text-xl font-bold ${accent ? 'text-[#E55A2B]' : 'text-[var(--text-strong)]'}`}>{value}</p>
    </div>
  )
}
