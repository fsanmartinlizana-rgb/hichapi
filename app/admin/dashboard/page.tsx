'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, LogIn, ExternalLink, TrendingUp, Store, ShoppingBag,
  DollarSign, Star, LifeBuoy, AlertTriangle,
} from 'lucide-react'
import ActivationFunnel from '@/components/admin/ActivationFunnel'

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
  const [tab, setTab]           = useState<'restaurants' | 'reviews' | 'tickets'>('restaurants')

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
      <main className="min-h-screen flex items-center justify-center bg-[#0A0A14] text-white">
        <div className="bg-[#13132A] rounded-2xl border border-white/10 p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold mb-1">
            hi<span className="text-[#FF6B35]">chapi</span> · founder
          </h1>
          <p className="text-sm text-white/40 mb-6">Centro de mando</p>
          <div className="flex flex-col gap-3">
            <input
              type="password"
              placeholder="Clave de acceso"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm
                         text-white focus:outline-none focus:border-[#FF6B35] transition-colors"
            />
            {authError && <p className="text-xs text-red-400">Clave incorrecta</p>}
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
      <main className="min-h-screen flex items-center justify-center bg-[#0A0A14] text-white/40">
        <RefreshCw size={20} className="animate-spin" />
      </main>
    )
  }

  const k = data.kpis

  return (
    <main className="min-h-screen bg-[#0A0A14] text-white">
      {/* Header */}
      <header className="bg-[#13132A] border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold">
            hi<span className="text-[#FF6B35]">chapi</span>
            <span className="text-white/40 font-normal ml-2 text-sm">· Centro de mando</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/5 rounded-lg border border-white/10 p-1">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  period === p.value ? 'bg-[#FF6B35] text-white' : 'text-white/40 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load()}
            className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <a href="/admin" className="flex items-center gap-1 text-xs text-white/40 hover:text-[#FF6B35] transition-colors">
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

        {/* Ticket alert */}
        {k.tickets_critical > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-200">
              {k.tickets_critical} ticket{k.tickets_critical > 1 ? 's' : ''} crítico{k.tickets_critical > 1 ? 's' : ''} abierto{k.tickets_critical > 1 ? 's' : ''}.
            </p>
          </div>
        )}

        {/* Funnel de activación de restaurantes */}
        <ActivationFunnel
          adminSecret={secret}
          days={period === '7d' ? 7 : period === '90d' ? 90 : period === 'all' ? 365 : 30}
        />

        {/* Tabs */}
        <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1 w-fit">
          {([
            { id: 'restaurants', label: `Top restaurantes (${data.top_restaurants.length})` },
            { id: 'reviews',     label: `Feedback (${k.reviews_count})` },
            { id: 'tickets',     label: `Soporte (${k.tickets_open} abiertos)` },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-[#FF6B35] text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'restaurants' && (
          <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/3 border-b border-white/8">
                <tr>
                  <th className="px-4 py-3 text-left  text-white/40 text-xs font-medium">Restaurante</th>
                  <th className="px-4 py-3 text-left  text-white/40 text-xs font-medium">Plan</th>
                  <th className="px-4 py-3 text-right text-white/40 text-xs font-medium">Pedidos</th>
                  <th className="px-4 py-3 text-right text-white/40 text-xs font-medium">Revenue</th>
                  <th className="px-4 py-3 text-right text-white/40 text-xs font-medium">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {data.top_restaurants.map(r => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/3">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-white/30 text-xs">{r.neighborhood ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs capitalize">{r.plan ?? 'free'}</td>
                    <td className="px-4 py-3 text-right font-mono">{r.orders}</td>
                    <td className="px-4 py-3 text-right font-mono text-white/70">{CLP(r.revenue)}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#FF6B35]">{CLP(r.commission)}</td>
                  </tr>
                ))}
                {data.top_restaurants.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-white/30">Sin restaurantes en el período</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reviews' && (
          <div className="space-y-2">
            {data.recent_reviews.map(r => (
              <div key={r.id} className="p-4 rounded-xl border border-white/8 bg-white/3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#FF6B35] font-mono text-sm">{'★'.repeat(r.rating)}<span className="text-white/15">{'★'.repeat(5 - r.rating)}</span></span>
                    {r.sentiment && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                        r.sentiment === 'positive' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
                        r.sentiment === 'negative' ? 'bg-red-500/10 border-red-500/30 text-red-300' :
                        'bg-white/5 border-white/10 text-white/50'
                      }`}>{r.sentiment}</span>
                    )}
                  </div>
                  <span className="text-white/25 text-xs">{new Date(r.created_at).toLocaleDateString('es-CL')}</span>
                </div>
                {r.comment && <p className="text-sm text-white/80">{r.comment}</p>}
                {r.ai_summary && <p className="text-xs text-white/40 mt-1 italic">{r.ai_summary}</p>}
              </div>
            ))}
            {data.recent_reviews.length === 0 && (
              <div className="text-center py-10 text-white/30">Sin reseñas en el período</div>
            )}
          </div>
        )}

        {tab === 'tickets' && (
          <div className="space-y-2">
            {data.recent_tickets.map(t => {
              const sevColor = t.severity === 'critical' ? 'text-red-300 bg-red-500/10 border-red-500/30'
                             : t.severity === 'medium'   ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                             : 'text-white/50 bg-white/5 border-white/10'
              const statusColor = t.status === 'open'          ? 'text-red-300'
                                : t.status === 'investigating' ? 'text-amber-300'
                                : t.status === 'resolved'      ? 'text-emerald-300'
                                : 'text-white/40'
              return (
                <div key={t.id} className="p-4 rounded-xl border border-white/8 bg-white/3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <LifeBuoy size={13} className="text-white/40" />
                      <p className="font-medium text-sm">{t.subject}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${sevColor}`}>{t.severity}</span>
                    </div>
                    <span className={`text-xs ${statusColor} capitalize`}>{t.status}</span>
                  </div>
                  <p className="text-xs text-white/50 line-clamp-2">{t.description}</p>
                  <p className="text-[10px] text-white/25 mt-2">{new Date(t.created_at).toLocaleString('es-CL')}</p>
                </div>
              )
            })}
            {data.recent_tickets.length === 0 && (
              <div className="text-center py-10 text-white/30">Sin tickets</div>
            )}
          </div>
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
    <div className={`p-4 rounded-xl border ${accent ? 'bg-[#FF6B35]/10 border-[#FF6B35]/30' : 'bg-white/3 border-white/8'}`}>
      <div className="flex items-center gap-1.5 text-white/40 text-xs mb-1">
        <Icon size={12} /> {label}
      </div>
      <p className={`text-xl font-bold ${accent ? 'text-[#FF6B35]' : 'text-white'}`}>{value}</p>
    </div>
  )
}
