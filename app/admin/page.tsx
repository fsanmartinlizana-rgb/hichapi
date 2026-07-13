'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle, XCircle, Clock, RefreshCw, LogIn, ExternalLink,
  ChevronDown, ChevronUp, Image as ImageIcon, TrendingUp, Store,
  ShoppingBag, DollarSign, Star, AlertTriangle
} from 'lucide-react'

import ActivationFunnel from '@/components/admin/ActivationFunnel'
import AdminTicketsTab from '@/components/admin/AdminTicketsTab'
import RestaurantsAtRisk from '@/components/admin/RestaurantsAtRisk'
import RegistrationsByDay from '@/components/admin/RegistrationsByDay'
import PlanUpgrades from '@/components/admin/PlanUpgrades'
import AnalyticsTab from '@/components/admin/AnalyticsTab'

// ── Types ────────────────────────────────────────────────────────────────────

const STATUSES = ['pending', 'approved', 'rejected'] as const
type Status = typeof STATUSES[number]

interface Submission {
  id: string
  name: string
  address: string
  neighborhood: string
  cuisine_type: string
  price_range: string
  owner_name: string
  owner_email: string
  owner_phone?: string
  description?: string
  instagram_url?: string
  status: Status
  notes?: string
  created_at: string
}

interface RiderProfile {
  id: string
  user_id: string
  full_name: string
  phone: string
  national_id: string
  vehicle_type: string
  vehicle_model?: string
  license_plate?: string
  document_status: 'documents_submitted' | 'approved' | 'rejected'
  doc_national_id_url?: string
  doc_license_url?: string
  doc_insurance_url?: string
  doc_permit_url?: string
  doc_inspection_url?: string
  doc_driver_record_url?: string
  updated_at: string
}

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

const STATUS_STYLES: Record<Status, string> = {
  pending:  'bg-amber-500/10 text-amber-700 border-amber-500/30',
  approved: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  rejected: 'bg-red-500/10 text-red-700 border-red-500/30',
}

const RIDER_STATUS_STYLES: Record<string, string> = {
  documents_submitted: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  approved:            'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  rejected:            'bg-red-500/10 text-red-700 border-red-500/30',
}

const RIDER_STATUS_LABELS: Record<string, string> = {
  documents_submitted: 'Por revisar',
  approved:            'Aprobado',
  rejected:            'Rechazado',
}

const VEHICLE_LABELS: Record<string, string> = {
  bicycle:    'Bicicleta',
  motorcycle: 'Moto',
  car:        'Auto',
  cargo_bike: 'Cargo bike',
}

const PRICE_LABELS: Record<string, string> = {
  economico: 'Económico',
  medio:     'Precio medio',
  premium:   'Premium',
}

const CLP = (v: number) => `$${v.toLocaleString('es-CL')}`

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [secret, setSecret]             = useState('')
  const [authed, setAuthed]             = useState(false)
  const [authError, setAuthError]       = useState(false)
  const [view, setView]                 = useState<'inicio' | 'submissions' | 'riders'>('inicio')
  const [tab, setTab]                   = useState<Status>('pending')
  const [riderTab, setRiderTab]         = useState<'documents_submitted' | 'approved' | 'rejected'>('documents_submitted')
  const [dashboardTab, setDashboardTab] = useState<'restaurants' | 'reviews' | 'tickets' | 'analytics'>('restaurants')

  const [period, setPeriod]             = useState('30d')
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null)
  const [submissions, setSubmissions]   = useState<Submission[]>([])
  const [riders, setRiders]             = useState<RiderProfile[]>([])

  const [loading, setLoading]           = useState(false)
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading]   = useState(false)
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async (s = secret) => {
    setLoading(true)
    try {
      if (view === 'inicio') {
        const res = await fetch(`/api/admin/dashboard?period=${period}`, {
          headers: { 'x-admin-secret': s },
        })
        if (res.status === 401) { setAuthed(false); setAuthError(true); setLoading(false); return }
        const json = await res.json()
        setDashboardData(json)
      } else if (view === 'submissions') {
        const res = await fetch(`/api/admin/submissions?status=${tab}`, {
          headers: { 'x-admin-secret': s },
        })
        if (res.status === 401) { setAuthed(false); setAuthError(true); setLoading(false); return }
        const json = await res.json()
        setSubmissions(json.data ?? [])
      } else {
        const res = await fetch(`/api/admin/riders?status=${riderTab}`, {
          headers: { 'x-admin-secret': s },
        })
        if (res.status === 401) { setAuthed(false); setAuthError(true); setLoading(false); return }
        const json = await res.json()
        setRiders(json.data ?? [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [secret, view, tab, riderTab, period])

  async function handleLogin() {
    setAuthError(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/dashboard?period=30d`, {
        headers: { 'x-admin-secret': secret },
      })
      if (res.status === 401) { setAuthError(true); setLoading(false); return }
      const json = await res.json()
      setDashboardData(json)
      setAuthed(true)
    } catch (err) {
      setAuthError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authed) load()
  }, [view, tab, riderTab, period, authed, load])

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setActionLoading(id + action)
    const res = await fetch('/api/admin/submissions', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body:    JSON.stringify({ id, action }),
    })
    const json = await res.json()
    setActionLoading(null)
    if (res.ok || res.status === 207) {
      showToast(
        action === 'approve'
          ? `✅ ${json.submission?.name ?? ''} aprobado`
          : `❌ Solicitud rechazada`,
        res.ok
      )
      setSubmissions(prev => prev.filter(s => s.id !== id))
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    } else {
      showToast('Error: ' + (json.error ?? 'algo salió mal'), false)
    }
  }

  async function handleRiderAction(id: string, action: 'approve' | 'reject') {
    setActionLoading(id + action)
    try {
      const res = await fetch('/api/admin/riders', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body:    JSON.stringify({ id, action }),
      })
      const json = await res.json()
      if (res.ok) {
        showToast(
          action === 'approve'
            ? `✅ Repartidor aprobado con éxito`
            : `❌ Documentos rechazados`,
          true
        )
        setRiders(prev => prev.filter(r => r.id !== id))
      } else {
        showToast('Error: ' + (json.error ?? 'algo salió mal'), false)
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, false)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleBulkApprove() {
    if (selected.size === 0) return
    setBulkLoading(true)
    const ids = [...selected]
    let ok = 0
    for (const id of ids) {
      const res = await fetch('/api/admin/submissions', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body:    JSON.stringify({ id, action: 'approve' }),
      })
      if (res.ok || res.status === 207) ok++
    }
    setSubmissions(prev => prev.filter(s => !selected.has(s.id)))
    setSelected(new Set())
    setBulkLoading(false)
    showToast(`✅ ${ok} solicitud${ok > 1 ? 'es' : ''} aprobada${ok > 1 ? 's' : ''}`)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    const pendingIds = submissions.filter(s => s.status === 'pending').map(s => s.id)
    if (selected.size === pendingIds.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pendingIds))
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-strong)]">
        <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold mb-1">
            hi<span className="text-[#E55A2B]">chapi</span> · admin
          </h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">Panel de administración</p>

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
            {authError && (
              <p className="text-xs text-red-700">Clave incorrecta</p>
            )}
            <button
              onClick={handleLogin}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                         bg-[#FF6B35] hover:bg-[#e55a2b] text-white font-semibold text-sm
                         transition-colors"
            >
              <LogIn size={15} />
              Entrar
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-strong)]">
      {/* Header */}
      <header className="bg-[var(--surface-card)] border-b border-[var(--border-subtle)] px-6 py-4 flex items-center justify-between sticky top-0 z-10 flex-wrap gap-4">
        <div className="flex items-center gap-6 flex-wrap">
          <h1 className="font-bold text-[var(--text-strong)] text-lg">
            hi<span className="text-[#E55A2B]">chapi</span>
            <span className="text-[var(--text-muted)] font-normal ml-2 text-sm">· Centro de Control</span>
          </h1>

          {/* View Selector Menu */}
          <nav className="flex gap-1 bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-1 text-xs">
            <button
              onClick={() => { setView('inicio'); setExpanded(null) }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                view === 'inicio'
                  ? 'bg-[#FF6B35] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
              }`}
            >
              Inicio
            </button>
            <button
              onClick={() => { setView('submissions'); setExpanded(null) }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                view === 'submissions'
                  ? 'bg-[#FF6B35] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
              }`}
            >
              Solicitudes de Locales
            </button>
            <button
              onClick={() => { setView('riders'); setExpanded(null) }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                view === 'riders'
                  ? 'bg-[#FF6B35] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
              }`}
            >
              Verificación de Repartidores
            </button>
          </nav>
        </div>

        <div className="flex gap-3 items-center">
          {view === 'inicio' && (
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
          )}

          <a
            href="/"
            target="_blank"
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[#E55A2B] transition-colors"
          >
            Ver app <ExternalLink size={11} />
          </a>
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full
                       border border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[#FF6B35]
                       hover:text-[#E55A2B] transition-colors"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {view === 'inicio' && dashboardData && (() => {
          const k = dashboardData.kpis
          return (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <KpiCard icon={Store}        label="Restaurantes activos" value={`${k.restaurants_active} / ${k.restaurants_total}`} />
                <KpiCard icon={ShoppingBag}  label="Pedidos pagados"      value={k.orders_paid.toLocaleString('es-CL')} />
                <KpiCard icon={TrendingUp}   label="Revenue total"        value={CLP(k.revenue_clp)}  accent />
                <KpiCard icon={DollarSign}   label="Comisión 1% HiChapi"  value={CLP(k.commission_clp)} accent />
                <KpiCard icon={Star}         label="Rating promedio"      value={k.avg_rating !== null ? `${k.avg_rating} ★` : '—'} />
              </div>

              {/* Ticket alerts */}
              {(() => {
                const stale = dashboardData.recent_tickets.filter(t =>
                  t.severity === 'critical'
                  && (t.status === 'open' || t.status === 'investigating')
                  && Date.now() - new Date(t.created_at).getTime() > 24 * 3600 * 1000
                )
                if (stale.length > 0) {
                  return (
                    <button
                      onClick={() => setDashboardTab('tickets')}
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

              {/* Registrations */}
              <RegistrationsByDay
                adminSecret={secret}
                days={period === '7d' ? 7 : period === '90d' ? 90 : period === 'all' ? 90 : 30}
              />

              {/* Activation funnel */}
              <ActivationFunnel
                adminSecret={secret}
                days={period === '7d' ? 7 : period === '90d' ? 90 : period === 'all' ? 365 : 30}
              />

              {/* Upgrades */}
              <PlanUpgrades adminSecret={secret} weeks={8} />

              {/* Restaurants at Risk */}
              <RestaurantsAtRisk adminSecret={secret} />

              {/* Sub-tabs Selector */}
              <div className="flex gap-1 bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-1 w-fit flex-wrap">
                {([
                  { id: 'restaurants', label: `Top restaurantes (${dashboardData.top_restaurants.length})` },
                  { id: 'reviews',     label: `Feedback (${k.reviews_count})` },
                  { id: 'tickets',     label: `Soporte (${k.tickets_open} abiertos)` },
                  { id: 'analytics',   label: `Analytics` },
                ] as const).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setDashboardTab(t.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dashboardTab === t.id ? 'bg-[#FF6B35] text-white' : 'text-[var(--text-muted)] hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Sub-tab content */}
              {dashboardTab === 'restaurants' && (
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
                      {dashboardData.top_restaurants.map(r => (
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
                      {dashboardData.top_restaurants.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">Sin restaurantes en el período</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {dashboardTab === 'reviews' && (
                <div className="space-y-2">
                  {dashboardData.recent_reviews.map(r => (
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
                  {dashboardData.recent_reviews.length === 0 && (
                    <div className="text-center py-10 text-[var(--text-muted)]">Sin reseñas en el período</div>
                  )}
                </div>
              )}

              {dashboardTab === 'tickets' && (
                <AdminTicketsTab
                  tickets={dashboardData.recent_tickets}
                  adminSecret={secret}
                  onRefresh={() => load()}
                />
              )}

              {dashboardTab === 'analytics' && (
                <AnalyticsTab adminSecret={secret} period={period} />
              )}
            </div>
          )
        })()}

        {view === 'submissions' && (
          <>
            {/* Tabs for Submissions */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div className="flex gap-1 bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-1 w-fit">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => { setTab(s); setExpanded(null); setSelected(new Set()) }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                      tab === s
                        ? 'bg-[#FF6B35] text-white shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                    }`}
                  >
                    {s === 'pending' ? 'Pendientes' : s === 'approved' ? 'Aprobados' : 'Rechazados'}
                  </button>
                ))}
              </div>

              {/* Bulk controls — only on pending tab */}
              {tab === 'pending' && submissions.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs px-3 py-1.5 rounded-full border border-[var(--border-subtle)]
                               text-[var(--text-muted)] hover:border-[#FF6B35] hover:text-[#E55A2B] transition-colors"
                  >
                    {selected.size === submissions.filter(s => s.status === 'pending').length
                      ? 'Deseleccionar todo'
                      : 'Seleccionar todo'}
                  </button>
                  {selected.size > 0 && (
                    <button
                      onClick={handleBulkApprove}
                      disabled={bulkLoading}
                      className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full
                                 bg-green-600 hover:bg-green-500 disabled:bg-[var(--surface-sunken)]
                                 text-[var(--text-strong)] font-semibold transition-colors"
                    >
                      <CheckCircle size={12} />
                      {bulkLoading ? 'Aprobando…' : `Aprobar ${selected.size}`}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Submissions List */}
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-2xl h-20 animate-pulse" />
                ))}
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-20 border border-[var(--border-subtle)] bg-[var(--surface-sunken)] rounded-2xl text-[var(--text-muted)]">
                <Clock size={40} className="mx-auto mb-3" strokeWidth={1} />
                <p className="text-sm">No hay solicitudes {tab === 'pending' ? 'pendientes' : tab === 'approved' ? 'aprobadas' : 'rechazadas'}</p>
              </div>
            ) : (
              <div className="space-y-3 pb-12">
                {submissions.map(sub => {
                  const isOpen   = expanded === sub.id
                  const isActing = actionLoading?.startsWith(sub.id)

                  return (
                    <div key={sub.id} className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
                      {/* Row header */}
                      <div className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[var(--surface-sunken)] transition-colors">
                        {/* Checkbox — only for pending */}
                        {sub.status === 'pending' && (
                          <input
                            type="checkbox"
                            checked={selected.has(sub.id)}
                            onChange={() => toggleSelect(sub.id)}
                            onClick={e => e.stopPropagation()}
                            className="w-4 h-4 rounded border-[var(--border-subtle)] bg-[var(--surface-sunken)] accent-[#FF6B35] shrink-0 cursor-pointer"
                          />
                        )}
                        <button
                          className="flex-1 flex items-center gap-4 text-left min-w-0"
                          onClick={() => setExpanded(isOpen ? null : sub.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="font-semibold text-[var(--text-strong)] text-sm truncate">{sub.name}</p>
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[sub.status]}`}>
                                {sub.status}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] truncate">
                              {sub.neighborhood} · {sub.cuisine_type} · {PRICE_LABELS[sub.price_range] ?? sub.price_range}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <p className="text-xs text-[var(--text-muted)] hidden sm:block">
                              {new Date(sub.created_at).toLocaleDateString('es-CL')}
                            </p>
                            {isOpen ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
                          </div>
                        </button>
                      </div>

                      {/* Detail panel */}
                      {isOpen && (
                        <div className="px-5 pb-5 border-t border-[var(--border-subtle)] bg-black/20">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 mt-4 mb-5">
                            <Detail label="Dirección"   value={sub.address} />
                            <Detail label="Barrio"      value={sub.neighborhood} />
                            <Detail label="Cocina"      value={sub.cuisine_type} />
                            <Detail label="Precio"      value={PRICE_LABELS[sub.price_range] ?? sub.price_range} />
                            <Detail label="Dueño"       value={sub.owner_name} />
                            <Detail label="Email"       value={sub.owner_email} />
                            {sub.owner_phone   && <Detail label="Teléfono"   value={sub.owner_phone} />}
                            {sub.instagram_url && (
                              <div>
                                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-medium mb-0.5">Instagram</p>
                                <a href={sub.instagram_url} target="_blank" rel="noopener noreferrer"
                                   className="text-sm text-[#E55A2B] hover:underline break-all">
                                  {sub.instagram_url}
                                </a>
                              </div>
                            )}
                            {sub.description && (
                              <div className="sm:col-span-2">
                                <Detail label="Descripción" value={sub.description} />
                              </div>
                            )}
                          </div>

                          {/* Actions — only for pending */}
                          {sub.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAction(sub.id, 'approve')}
                                disabled={!!isActing}
                                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold
                                           bg-green-600 hover:bg-green-500 disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-muted)]
                                           text-[var(--text-strong)] transition-colors shadow-sm"
                              >
                                <CheckCircle size={14} />
                                {actionLoading === sub.id + 'approve' ? 'Aprobando…' : 'Aprobar y publicar'}
                              </button>
                              <button
                                onClick={() => handleAction(sub.id, 'reject')}
                                disabled={!!isActing}
                                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold
                                           border border-red-500/30 text-red-700 hover:bg-red-500/10
                                           disabled:opacity-50 transition-colors bg-transparent shadow-sm"
                              >
                                <XCircle size={14} />
                                {actionLoading === sub.id + 'reject' ? 'Rechazando…' : 'Rechazar'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {view === 'riders' && (
          <>
            {/* Tabs for Riders */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div className="flex gap-1 bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-1 w-fit">
                {(['documents_submitted', 'approved', 'rejected'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => { setRiderTab(s); setExpanded(null) }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                      riderTab === s
                        ? 'bg-[#FF6B35] text-white'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                    }`}
                  >
                    {RIDER_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Riders List */}
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-2xl h-20 animate-pulse" />
                ))}
              </div>
            ) : riders.length === 0 ? (
              <div className="text-center py-20 border border-[var(--border-subtle)] bg-[var(--surface-sunken)] rounded-2xl text-[var(--text-muted)]">
                <Clock size={40} className="mx-auto mb-3" strokeWidth={1} />
                <p className="text-sm">No hay repartidores con documentos en estado {RIDER_STATUS_LABELS[riderTab].toLowerCase()}</p>
              </div>
            ) : (
              <div className="space-y-3 pb-12">
                {riders.map(rider => {
                  const isOpen   = expanded === rider.id
                  const isActing = actionLoading?.startsWith(rider.id)

                  return (
                    <div key={rider.id} className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
                      {/* Row Header */}
                      <button
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface-sunken)] transition-colors text-left"
                        onClick={() => setExpanded(isOpen ? null : rider.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center justify-center text-[#E55A2B] font-bold text-sm shrink-0">
                            {rider.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="font-semibold text-[var(--text-strong)] text-sm truncate">{rider.full_name}</p>
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${RIDER_STATUS_STYLES[rider.document_status]}`}>
                                {RIDER_STATUS_LABELS[rider.document_status]}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] truncate">
                              Vehículo: {VEHICLE_LABELS[rider.vehicle_type] ?? rider.vehicle_type}
                              {rider.vehicle_model ? ` (${rider.vehicle_model})` : ''}
                              {rider.license_plate ? ` · Patente: ${rider.license_plate}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-xs text-[var(--text-muted)] hidden sm:block">
                            Actualizado: {new Date(rider.updated_at).toLocaleDateString('es-CL')}
                          </p>
                          {isOpen ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
                        </div>
                      </button>

                      {/* Detail Panel */}
                      {isOpen && (
                        <div className="px-5 pb-5 border-t border-[var(--border-subtle)] bg-black/20">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 mb-5">
                            <Detail label="RUT" value={rider.national_id} />
                            <Detail label="Teléfono" value={rider.phone} />
                            <Detail label="ID de Usuario Supabase" value={rider.user_id} />
                          </div>

                          {/* Documents Grid */}
                          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-bold mb-3">Documentos Cargados</p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <DocumentCard label="RUT (Cédula de Identidad)" url={rider.doc_national_id_url} />
                            <DocumentCard label="Licencia de Conducir" url={rider.doc_license_url} />
                            <DocumentCard label="Seguro / Padrón" url={rider.doc_insurance_url} />
                            <DocumentCard label="Permiso de Circulación" url={rider.doc_permit_url} />
                            <DocumentCard label="Revisión Técnica" url={rider.doc_inspection_url} />
                            <DocumentCard label="Hoja de Vida del Conductor" url={rider.doc_driver_record_url} />
                          </div>

                          {/* Actions */}
                          {rider.document_status === 'documents_submitted' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRiderAction(rider.id, 'approve')}
                                disabled={!!isActing}
                                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold
                                           bg-green-600 hover:bg-green-500 disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-muted)]
                                           text-[var(--text-strong)] transition-colors shadow-sm"
                              >
                                <CheckCircle size={14} />
                                {actionLoading === rider.id + 'approve' ? 'Aprobando…' : 'Aprobar Repartidor'}
                              </button>
                              <button
                                onClick={() => handleRiderAction(rider.id, 'reject')}
                                disabled={!!isActing}
                                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold
                                           border border-red-500/30 text-red-700 hover:bg-red-500/10
                                           disabled:opacity-50 transition-colors bg-transparent shadow-sm"
                              >
                                <XCircle size={14} />
                                {actionLoading === rider.id + 'reject' ? 'Rechazando…' : 'Rechazar Documentos'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={[
          'fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium shadow-lg',
          'transition-all duration-200 z-50',
          toast.ok ? 'bg-[#FF6B35] text-white' : 'bg-red-500 text-white',
        ].join(' ')}>
          {toast.msg}
        </div>
      )}
    </main>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-medium mb-0.5">{label}</p>
      <p className="text-sm text-[var(--text-strong)] font-medium">{value}</p>
    </div>
  )
}

function DocumentCard({ label, url }: { label: string; url?: string }) {
  return (
    <div className="bg-[var(--surface-sunken)] rounded-xl p-3 border border-[var(--border-subtle)] shadow-sm flex flex-col h-64">
      <p className="text-xs text-[var(--text-muted)] font-semibold mb-2">{label}</p>
      {url ? (
        <div className="relative flex-1 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-black/10 flex items-center justify-center group">
          <img
            src={url}
            alt={label}
            className="max-h-full max-w-full object-contain"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[var(--text-strong)] text-xs font-semibold transition-opacity"
          >
            Abrir original <ExternalLink size={12} className="ml-1" />
          </a>
        </div>
      ) : (
        <div className="flex-1 rounded-lg border border-dashed border-[var(--border-subtle)] flex flex-col items-center justify-center bg-black/5">
          <ImageIcon className="text-[var(--text-muted)] mb-1" size={24} />
          <p className="text-[11px] text-[var(--text-muted)]">No cargado</p>
        </div>
      )}
    </div>
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
        <Icon size={12} className={accent ? 'text-[#E55A2B]' : 'text-[var(--text-muted)]'} /> {label}
      </div>
      <p className={`text-xl font-bold ${accent ? 'text-[#E55A2B]' : 'text-[var(--text-strong)]'}`}>{value}</p>
    </div>
  )
}
