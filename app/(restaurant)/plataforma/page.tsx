'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BarChart2, Store, Users, Ticket, Star, TrendingUp,
  AlertTriangle, Check, Clock, RefreshCw, ChevronRight,
  Crown, Shield, Eye,
} from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'
import { createClient } from '@/lib/supabase/client'
import { PLANS } from '@/lib/plans'

// ── Types ────────────────────────────────────────────────────────────────────

interface PlatformStats {
  totalRestaurants: number
  activeRestaurants: number
  claimedRestaurants: number
  unclaimedRestaurants: number
  totalOrders: number
  ordersToday: number
  totalRevenue: number
  revenueToday: number
  totalUsers: number
  openTickets: number
  planBreakdown: Record<string, number>
  recentRestaurants: { id: string; name: string; slug: string; plan: string; created_at: string; claimed: boolean }[]
  recentTickets: { id: string; subject: string; severity: string; status: string; created_at: string }[]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const { isSuperAdmin, loading: ctxLoading } = useRestaurant()
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  // Memoizado: evita que loadStats se recree en cada render y dispare loops
  const supabase = useMemo(() => createClient(), [])

  const loadStats = useCallback(async () => {
    setLoading(true)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    const [
      restaurantsRes,
      ordersRes,
      ordersTodayRes,
      paidRes,
      paidTodayRes,
      usersRes,
      ticketsRes,
      recentRestsRes,
      recentTicketsRes,
    ] = await Promise.all([
      supabase.from('restaurants').select('id, plan, claimed, active'),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
      supabase.from('orders').select('total').eq('status', 'paid'),
      supabase.from('orders').select('total').eq('status', 'paid').gte('created_at', todayISO),
      supabase.from('team_members').select('user_id', { count: 'exact', head: true }),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('restaurants').select('id, name, slug, plan, created_at, claimed').order('created_at', { ascending: false }).limit(8),
      supabase.from('support_tickets').select('id, subject, severity, status, created_at').order('created_at', { ascending: false }).limit(5),
    ])

    const restaurants = restaurantsRes.data ?? []
    const planBreakdown: Record<string, number> = {}
    for (const r of restaurants) {
      const plan = r.plan || 'free'
      planBreakdown[plan] = (planBreakdown[plan] || 0) + 1
    }

    const totalRevenue = (paidRes.data ?? []).reduce((s, o) => s + (o.total || 0), 0)
    const revenueToday = (paidTodayRes.data ?? []).reduce((s, o) => s + (o.total || 0), 0)

    setStats({
      totalRestaurants: restaurants.length,
      activeRestaurants: restaurants.filter(r => r.active).length,
      claimedRestaurants: restaurants.filter(r => r.claimed).length,
      unclaimedRestaurants: restaurants.filter(r => !r.claimed).length,
      totalOrders: ordersRes.count ?? 0,
      ordersToday: ordersTodayRes.count ?? 0,
      totalRevenue,
      revenueToday,
      totalUsers: usersRes.count ?? 0,
      openTickets: ticketsRes.count ?? 0,
      planBreakdown,
      recentRestaurants: (recentRestsRes.data ?? []) as PlatformStats['recentRestaurants'],
      recentTickets: (recentTicketsRes.data ?? []) as PlatformStats['recentTickets'],
    })
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadStats() }, [loadStats])

  if (ctxLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw size={20} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <Shield size={32} className="text-red-400 mx-auto" />
          <p className="text-white font-semibold">Acceso restringido</p>
          <p className="text-white/40 text-sm">Solo Super Admins pueden ver esta página.</p>
        </div>
      </div>
    )
  }

  if (!stats) return null

  function clp(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
    return `$${n}`
  }

  const severityColor: Record<string, string> = {
    critical: 'text-red-400 bg-red-500/10',
    medium: 'text-yellow-400 bg-yellow-500/10',
    low: 'text-blue-400 bg-blue-500/10',
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-[#FF6B35]" />
            <h1 className="text-white text-xl font-bold">Super Admin</h1>
          </div>
          <p className="text-white/40 text-sm mt-0.5">Vista general de la plataforma HiChapi</p>
        </div>
        <button onClick={loadStats} className="p-2 rounded-xl border border-white/10 text-white/40 hover:text-white transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Restaurantes', value: stats.totalRestaurants, sub: `${stats.claimedRestaurants} reclamados`, icon: Store, color: '#FF6B35' },
          { label: 'Pedidos hoy', value: stats.ordersToday, sub: `${stats.totalOrders} total`, icon: BarChart2, color: '#60A5FA' },
          { label: 'Revenue hoy', value: clp(stats.revenueToday), sub: `${clp(stats.totalRevenue)} total`, icon: TrendingUp, color: '#34D399' },
          { label: 'Usuarios', value: stats.totalUsers, sub: 'team members', icon: Users, color: '#A78BFA' },
          { label: 'Tickets abiertos', value: stats.openTickets, sub: 'soporte', icon: Ticket, color: stats.openTickets > 0 ? '#FBBF24' : '#6B7280' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#161622] rounded-2xl border border-white/5 p-5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-white/40 text-xs">{kpi.label}</p>
              <kpi.icon size={14} style={{ color: kpi.color }} />
            </div>
            <p className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>
              {kpi.value}
            </p>
            <p className="text-white/25 text-xs">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Middle: Plan breakdown + Recent tickets */}
      <div className="grid grid-cols-3 gap-4">
        {/* Plan breakdown */}
        <div className="bg-[#161622] rounded-2xl border border-white/5 p-5">
          <p className="text-white text-sm font-semibold mb-4">Distribución de planes</p>
          <div className="space-y-3">
            {Object.entries(PLANS).map(([planId, plan]) => {
              const count = stats.planBreakdown[planId] || 0
              const pct = stats.totalRestaurants > 0 ? Math.round((count / stats.totalRestaurants) * 100) : 0
              return (
                <div key={planId} className="flex items-center gap-3">
                  <span className="text-white/50 text-xs w-20 truncate">{plan.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: planId === 'free' ? '#6B7280' : planId === 'starter' ? '#60A5FA' : planId === 'pro' ? '#FF6B35' : '#A78BFA',
                      }}
                    />
                  </div>
                  <span className="text-white/30 text-xs w-8 text-right">{count}</span>
                </div>
              )
            })}
          </div>

          {/* Claimed vs unclaimed */}
          <div className="mt-5 pt-4 border-t border-white/5 space-y-2">
            <p className="text-white/40 text-xs font-medium">Estado de perfiles</p>
            <div className="flex items-center gap-2">
              <Check size={12} className="text-emerald-400" />
              <span className="text-white/50 text-xs flex-1">Reclamados</span>
              <span className="text-white/30 text-xs">{stats.claimedRestaurants}</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye size={12} className="text-yellow-400" />
              <span className="text-white/50 text-xs flex-1">Sin reclamar</span>
              <span className="text-white/30 text-xs">{stats.unclaimedRestaurants}</span>
            </div>
          </div>
        </div>

        {/* Recent restaurants */}
        <div className="col-span-2 bg-[#161622] rounded-2xl border border-white/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white text-sm font-semibold">Restaurantes recientes</p>
          </div>
          <div className="space-y-1">
            {stats.recentRestaurants.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/3 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-white/30 text-[10px] font-bold shrink-0">
                  {r.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{r.name}</p>
                  <p className="text-white/30 text-[10px]">{r.slug}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${
                  r.plan === 'pro' ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                    : r.plan === 'starter' ? 'bg-blue-500/15 text-blue-400'
                    : r.plan === 'enterprise' ? 'bg-violet-500/15 text-violet-400'
                    : 'bg-white/5 text-white/30'
                }`}>
                  {r.plan || 'free'}
                </span>
                {r.claimed ? (
                  <Check size={12} className="text-emerald-400 shrink-0" />
                ) : (
                  <Clock size={12} className="text-yellow-400 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Support tickets */}
      {stats.recentTickets.length > 0 && (
        <div className="bg-[#161622] rounded-2xl border border-white/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-yellow-400" />
              <p className="text-white text-sm font-semibold">Tickets recientes</p>
            </div>
            <span className="text-white/30 text-xs">{stats.openTickets} abiertos</span>
          </div>
          <div className="space-y-1">
            {stats.recentTickets.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/3 transition-colors">
                <span className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${severityColor[t.severity] || severityColor.low}`}>
                  {t.severity}
                </span>
                <p className="text-white/70 text-sm flex-1 truncate">{t.subject}</p>
                <span className={`text-[10px] font-medium ${t.status === 'open' ? 'text-yellow-400' : 'text-white/25'}`}>
                  {t.status}
                </span>
                <ChevronRight size={12} className="text-white/15" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
