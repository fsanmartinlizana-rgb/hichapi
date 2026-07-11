'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronRight, Plus, RefreshCw,
  DollarSign, Receipt, Grid3X3, Star, TrendingUp, Users,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRestaurant } from '@/lib/restaurant-context'
import { formatCurrency, formatCompactCurrency } from '@/lib/i18n'
import TrialBanner from '@/components/restaurant/TrialBanner'
import OnboardingChecklist from '@/components/restaurant/OnboardingChecklist'

// ── Helpers ──────────────────────────────────────────────────────────────────

function clp(amount: number): string {
  if (amount >= 100_000) return formatCompactCurrency(amount)
  return formatCurrency(amount)
}

// ── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  salesToday: number
  ordersToday: number
  activeOrders: { id: string; table_label: string; status: string; total: number; items_text: string; mins: number }[]
  tables: { id: string; label: string; status: string }[]
  topDishes: { name: string; count: number }[]
  statusBreakdown: { pending: number; preparing: number; ready: number; paying: number }
  avgRating: number
  reviewCount: number
  recentReviews: { id: string; rating: number; comment: string | null; created_at: string }[]
}

// ── Data hook ────────────────────────────────────────────────────────────────

function useDashboardData(restaurantId: string | undefined) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  // Memoizado: evita re-suscripciones infinitas en el canal Realtime
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    if (!restaurantId) { setLoading(false); return }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    const [ordersRes, tablesRes, paidRes, itemsRes, reviewsRes] = await Promise.all([
      // Active orders with items
      supabase
        .from('orders')
        .select('id, table_id, status, total, created_at, order_items(name, quantity)')
        .eq('restaurant_id', restaurantId)
        .not('status', 'in', '("paid","cancelled")')
        .order('created_at', { ascending: false }),
      // Tables
      supabase
        .from('tables')
        .select('id, label, status')
        .eq('restaurant_id', restaurantId)
        .order('label'),
      // Paid orders today (for sales total)
      supabase
        .from('orders')
        .select('id, total')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'paid')
        .gte('created_at', todayISO),
      // All order items today (for top dishes)
      supabase
        .from('order_items')
        .select('name, quantity, order_id, orders!inner(restaurant_id, created_at)')
        .eq('orders.restaurant_id', restaurantId)
        .gte('orders.created_at', todayISO),
      // Reviews
      supabase
        .from('reviews')
        .select('id, rating, comment, created_at')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const activeOrders = ordersRes.data ?? []
    const tables = tablesRes.data ?? []
    const paidOrders = paidRes.data ?? []
    const allItems = itemsRes.data ?? []
    const reviews = (reviewsRes.data ?? []) as { id: string; rating: number; comment: string | null; created_at: string }[]
    const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0

    // Calculate sales
    const salesToday = paidOrders.reduce((s, o) => s + (o.total || 0), 0)
    // Add active orders' totals too
    const activeTotals = activeOrders.reduce((s, o) => s + (o.total || 0), 0)

    // Status breakdown
    const statusBreakdown = {
      pending: activeOrders.filter(o => o.status === 'pending').length,
      preparing: activeOrders.filter(o => o.status === 'preparing').length,
      ready: activeOrders.filter(o => o.status === 'ready').length,
      paying: activeOrders.filter(o => o.status === 'paying').length,
    }

    // Map active orders with table labels
    const mappedOrders = activeOrders.map(o => {
      const table = tables.find(t => t.id === o.table_id)
      const items = (o.order_items as { name: string; quantity: number }[]) || []
      const elapsed = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60_000)
      return {
        id: o.id,
        table_label: table?.label ?? 'Mesa',
        status: o.status,
        total: o.total,
        items_text: items.map(i => `${i.quantity}× ${i.name}`).join(', '),
        mins: elapsed,
      }
    })

    // Top dishes
    const dishCounts: Record<string, number> = {}
    for (const item of allItems) {
      const name = (item as { name: string }).name
      const qty = (item as { quantity: number }).quantity || 1
      dishCounts[name] = (dishCounts[name] || 0) + qty
    }
    const topDishes = Object.entries(dishCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    setData({
      salesToday: salesToday + activeTotals,
      ordersToday: paidOrders.length + activeOrders.length,
      activeOrders: mappedOrders,
      tables,
      topDishes,
      statusBreakdown,
      avgRating,
      reviewCount: reviews.length,
      recentReviews: reviews.slice(0, 5),
    })
    setLoading(false)
  }, [restaurantId, supabase])

  useEffect(() => { load() }, [load])

  // Realtime subscription
  useEffect(() => {
    if (!restaurantId) return
    const channel = supabase
      .channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [restaurantId, supabase, load])

  return { data, loading, refresh: load }
}

// ── Components ───────────────────────────────────────────────────────────────

// Circular KPI hero card — SVG ring + value at center
function CircularKPI({
  label, value, sublabel, percent, color, icon: Icon, accent,
}: {
  label:    string
  value:    string
  sublabel?: React.ReactNode
  percent:  number               // 0–100
  color:    string               // ring color
  accent:   string               // background tint hex
  icon:     React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}) {
  const size       = 132
  const stroke     = 9
  const radius     = (size - stroke) / 2
  const circumf    = 2 * Math.PI * radius
  const clamped    = Math.max(0, Math.min(100, percent))
  const dashOffset = circumf - (clamped / 100) * circumf

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5 self-start">
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center"
          style={{ background: accent }}
        >
          <Icon size={11} strokeWidth={2.4} className="text-[var(--text-strong)]" />
        </div>
        <p className="text-[var(--text-muted)] text-[11px] font-medium uppercase tracking-wide">{label}</p>
      </div>

      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="rgba(26, 26, 46, 0.07)" strokeWidth={stroke} fill="none"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeLinecap="round"
            strokeDasharray={circumf}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 600ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p
            className="text-[var(--text-strong)] text-[22px] font-bold leading-none"
            style={{ fontFamily: 'var(--font-dm-mono)' }}
          >
            {value}
          </p>
        </div>
      </div>

      <div className="text-center min-h-[18px]">{sublabel}</div>
    </div>
  )
}

const MESA_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  ocupada:   { bg: 'bg-[#FF6B35]/10', border: 'border-[#FF6B35]/30', text: 'text-[#E55A2B]' },
  cuenta:    { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-700' },
  libre:     { bg: 'bg-[var(--surface-sunken)]',       border: 'border-[var(--border-subtle)]',       text: 'text-[var(--text-muted)]'  },
  reservada: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-700' },
  bloqueada: { bg: 'bg-[var(--surface-sunken)]',       border: 'border-[var(--border-subtle)]',      text: 'text-[var(--text-muted)]'  },
}

function MesaCell({ mesa }: { mesa: { id: string; label: string; status: string } }) {
  const s = MESA_STYLES[mesa.status] ?? MESA_STYLES.libre
  return (
    <div className={`${s.bg} border ${s.border} rounded-xl p-3 flex flex-col items-center gap-1`}>
      <p className="text-[var(--text-strong)] font-bold text-lg leading-none" style={{ fontFamily: 'var(--font-dm-mono)' }}>
        {mesa.label.replace('Mesa ', '')}
      </p>
      <p className={`text-[9px] font-medium ${s.text}`}>{mesa.status}</p>
    </div>
  )
}

function OrderRow({ order }: { order: DashboardData['activeOrders'][0] }) {
  const statusColor = order.status === 'pending' ? '#60A5FA'
    : order.status === 'preparing' ? '#FBBF24'
    : order.status === 'ready' ? '#34D399'
    : order.status === 'paying' ? '#FBBF24'
    : '#94A3B8'

  return (
    <Link
      href="/garzon"
      className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-[var(--surface-sunken)] transition-colors"
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-bold border"
        style={{ backgroundColor: statusColor + '15', borderColor: statusColor + '30', color: statusColor }}
      >
        {order.table_label.replace('Mesa ', 'M')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[var(--text-strong)] text-sm font-semibold">{order.table_label}</p>
        <p className="text-[var(--text-muted)] text-xs truncate">{order.items_text || 'Sin ítems'}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[var(--text-strong)] font-semibold text-sm" style={{ fontFamily: 'var(--font-dm-mono)' }}>
          {clp(order.total)}
        </p>
        <p className="text-[var(--text-muted)] text-[10px]">{order.mins} min</p>
      </div>
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { restaurant, loading: ctxLoading } = useRestaurant()
  const restId = restaurant?.id
  const { data, loading, refresh } = useDashboardData(restId)

  const today = new Date()
  const dateStr = today.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' })

  if (loading || ctxLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw size={20} className="text-[#E55A2B] animate-spin" />
      </div>
    )
  }

  if (!restaurant || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#FF6B35]/15 flex items-center justify-center">
          <DollarSign size={28} className="text-[#E55A2B]" />
        </div>
        <h2 className="text-[var(--text-strong)] text-xl font-bold">Sin restaurante asociado</h2>
        <p className="text-[var(--text-muted)] text-sm max-w-sm">
          Tu cuenta aún no está vinculada a un restaurante. Pide al administrador que te agregue al equipo o registra tu restaurante.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e55a2b] transition-colors"
        >
          Registrar mi restaurante
        </Link>
      </div>
    )
  }

  const ticketPromedio = data.ordersToday > 0 ? Math.round(data.salesToday / data.ordersToday) : 0
  const totalActive = data.statusBreakdown.pending + data.statusBreakdown.preparing + data.statusBreakdown.ready + data.statusBreakdown.paying

  const mesaStats = {
    ocupadas:  data.tables.filter(t => t.status === 'ocupada').length,
    libres:    data.tables.filter(t => t.status === 'libre').length,
    pagando:   data.tables.filter(t => t.status === 'cuenta').length,
    reservadas: data.tables.filter(t => t.status === 'reservada').length,
  }

  // Ring percentages — visual progress indicators for the circular KPIs
  // Sales: rough "progress through the day" assuming ops 11:00–23:00 (12h shift)
  const now      = new Date()
  const minutes  = now.getHours() * 60 + now.getMinutes()
  const dayStart = 11 * 60
  const dayEnd   = 23 * 60
  const salesProgressPct = Math.max(0, Math.min(100,
    Math.round(((minutes - dayStart) / (dayEnd - dayStart)) * 100)
  ))
  // Ticket: full ring if avg > 25K CLP (a healthy mid-range ticket)
  const ticketRingPct  = Math.min(100, Math.round((ticketPromedio / 25_000) * 100))
  // Active orders: ring fills relative to table count (1 active per table = 100%)
  const activeRingPct  = data.tables.length > 0
    ? Math.min(100, Math.round((totalActive / data.tables.length) * 100))
    : 0
  // Occupation: real % of tables occupied
  const occupationPct  = data.tables.length > 0
    ? Math.round((mesaStats.ocupadas / data.tables.length) * 100)
    : 0

  return (
    <div className="p-6 space-y-5 min-h-full">

      {/* Trial banner — solo aparece si el restaurant esta en trial activo */}
      <TrialBanner />

      {/* Primeros pasos — onboarding guiado, se oculta solo al completarse */}
      <OnboardingChecklist restaurantId={restId} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[var(--text-strong)] text-xl font-bold">Resumen del dia</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[var(--text-muted)] text-sm capitalize">{dateStr}</p>
            <span className="flex items-center gap-1 text-emerald-700 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              En vivo
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="p-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors">
            <RefreshCw size={14} />
          </button>
          <Link
            href="/comandas?nueva=1"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] transition-colors"
          >
            <Plus size={14} />
            Nueva comanda
          </Link>
        </div>
      </div>

      {/* KPI Cards — flat values */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Ventas hoy', value: clp(data.salesToday), sub: `${data.ordersToday} pedidos`, icon: DollarSign, color: '#E55A2B' },
          { label: 'Ticket promedio', value: clp(ticketPromedio), sub: 'por pedido', icon: Receipt, color: '#1D4ED8' },
          { label: 'Ocupación', value: `${occupationPct}%`, sub: `${mesaStats.ocupadas}/${data.tables.length} mesas`, icon: Grid3X3, color: '#15803D' },
          { label: 'NPS / Rating', value: data.avgRating > 0 ? data.avgRating.toFixed(1) : '—', sub: `${data.reviewCount} opiniones`, icon: Star, color: '#B45309' },
          { label: 'En cocina', value: String(data.statusBreakdown.preparing), sub: `${data.statusBreakdown.ready} listos`, icon: TrendingUp, color: '#6D28D9' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: kpi.color + '25' }}>
                <kpi.icon size={11} strokeWidth={2.4} style={{ color: kpi.color }} />
              </div>
              <p className="text-[var(--text-muted)] text-[10px] font-medium uppercase tracking-wide">{kpi.label}</p>
            </div>
            <p className="text-[var(--text-strong)] text-2xl font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>{kpi.value}</p>
            <p className="text-[var(--text-muted)] text-[11px]">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Middle row — mesa grid + NPS/reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Mesa grid + top dishes */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[var(--text-strong)] text-sm font-semibold">Estado de mesas</p>
              <Link href="/mesas" className="text-[var(--text-muted)] text-xs hover:text-[var(--text-muted)] flex items-center gap-0.5">
                Ver todas <ChevronRight size={11} />
              </Link>
            </div>
            {data.tables.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm text-center py-4">Sin mesas configuradas</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {data.tables.map(m => <MesaCell key={m.id} mesa={m} />)}
              </div>
            )}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {[
                { color: 'bg-[#FF6B35]', label: `${mesaStats.ocupadas} ocupadas` },
                { color: 'bg-yellow-400', label: `${mesaStats.pagando} pagando` },
                { color: 'bg-violet-400', label: `${mesaStats.reservadas} reservadas` },
                { color: 'bg-[var(--surface-sunken)]', label: `${mesaStats.libres} libres` },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
                  <span className="text-[var(--text-muted)] text-[10px]">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top platos */}
          <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5">
            <p className="text-[var(--text-strong)] text-sm font-semibold mb-4">Top platos hoy</p>
            {data.topDishes.length === 0 ? (
              <p className="text-[var(--text-muted)] text-xs text-center py-3">Sin datos aun</p>
            ) : (
              <div className="space-y-2.5">
                {data.topDishes.map((p, i) => {
                  const maxCount = data.topDishes[0]?.count || 1
                  return (
                    <div key={p.name} className="flex items-center gap-2.5">
                      <span className="text-[var(--text-muted)] text-xs w-3 shrink-0">{i + 1}</span>
                      <span className="text-[var(--text-body)] text-xs flex-1 truncate">{p.name}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-20 h-1.5 rounded-full bg-[var(--surface-sunken)] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(p.count / maxCount) * 100}%`,
                              backgroundColor: i === 0 ? '#FF6B35' : '#3A3A55',
                            }}
                          />
                        </div>
                        <span className="text-[var(--text-muted)] text-[10px] w-4 text-right">{p.count}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column — NPS & Reviews */}
        <div className="flex flex-col gap-4">
          {/* NPS Card */}
          <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Star size={14} className="text-[#B45309]" />
              <p className="text-[var(--text-strong)] text-sm font-semibold">NPS del restaurante</p>
            </div>
            <div className="text-center py-3">
              <p className="text-4xl font-bold text-[var(--text-strong)]" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                {data.avgRating > 0 ? data.avgRating.toFixed(1) : '—'}
              </p>
              <div className="flex items-center justify-center gap-0.5 mt-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} size={14} className={s <= Math.round(data.avgRating) ? 'text-[#B45309] fill-[#FBBF24]' : 'text-[var(--text-muted)]'} />
                ))}
              </div>
              <p className="text-[var(--text-muted)] text-xs mt-1">{data.reviewCount} opiniones</p>
            </div>
          </div>

          {/* Recent reviews */}
          <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-5 space-y-3">
            <p className="text-[var(--text-strong)] text-sm font-semibold">Opiniones recientes</p>
            {data.recentReviews.length === 0 ? (
              <p className="text-[var(--text-muted)] text-xs text-center py-3">Sin opiniones aún</p>
            ) : (
              <div className="space-y-2.5">
                {data.recentReviews.map(r => (
                  <div key={r.id} className="bg-[var(--surface-sunken)] rounded-xl p-3 space-y-1">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={10} className={s <= r.rating ? 'text-[#B45309] fill-[#FBBF24]' : 'text-[var(--text-muted)]'} />
                      ))}
                      <span className="text-[var(--text-muted)] text-[9px] ml-auto">
                        {new Date(r.created_at).toLocaleDateString('es-CL')}
                      </span>
                    </div>
                    {r.comment && <p className="text-[var(--text-muted)] text-xs leading-relaxed">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
