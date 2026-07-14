/**
 * /delivery/analiticas — Metrics, charts, heat map
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */
'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Clock, Star, DollarSign, Truck, AlertCircle } from 'lucide-react'
import type { DeliveryAnalytics } from '@/lib/delivery/types'
import { useRestaurant } from '@/lib/restaurant-context'

export default function DeliveryAnaliticasPage() {
  const [analytics, setAnalytics] = useState<DeliveryAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0])

  const { restaurant } = useRestaurant()

  useEffect(() => {
    if (!restaurant?.id) return
    setLoading(true)
    setError('')
    fetch(`/api/delivery/analytics?from=${from}&to=${to}`, {
      headers: { 'x-restaurant-id': restaurant.id }
    })
      .then(r => {
        if (!r.ok) return r.json().then(d => { throw new Error(d.error ?? 'Error') })
        return r.json()
      })
      .then(setAnalytics)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [from, to, restaurant?.id])

  const kpis = analytics ? [
    { label: 'Entregas completadas', value: analytics.total_completed,                                    icon: Truck,       color: 'text-[var(--success-text)]' },
    { label: 'Tiempo promedio',      value: analytics.avg_delivery_minutes ? `${analytics.avg_delivery_minutes} min` : '—', icon: Clock, color: 'text-[var(--info-text)]' },
    { label: 'Rating promedio',      value: analytics.avg_rider_rating ? `${analytics.avg_rider_rating}★` : '—',            icon: Star,  color: 'text-[var(--warning-text)]' },
    { label: 'Total pagado riders',  value: `$${analytics.total_fees_paid_clp.toLocaleString('es-CL')}`,  icon: DollarSign,  color: 'text-[var(--accent-violet-text)]' },
    { label: 'Tasa de éxito',        value: `${Math.round(analytics.success_rate * 100)}%`,               icon: TrendingUp,  color: 'text-[#E55A2B]' },
  ] : []

  const maxVolume = analytics
    ? Math.max(...analytics.daily_volumes.map(d => d.count), 1)
    : 1

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)]">Analíticas de Delivery</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Métricas de tu operación de última milla</p>
        </div>
        {/* Date range picker */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]"
          />
          <span className="text-[var(--text-muted)] text-sm">→</span>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-[var(--danger-text)] text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="bg-[var(--surface-sunken)] rounded-xl h-20 animate-pulse" />)}
        </div>
      ) : analytics && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {kpis.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon size={14} className={color} />
                  <span className="text-[var(--text-muted)] text-xs">{label}</span>
                </div>
                <p className="text-[var(--text-strong)] text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>

          {/* Daily volume chart */}
          <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-5">
            <h2 className="text-[var(--text-strong)] font-semibold mb-4">Volumen diario</h2>
            {analytics.daily_volumes.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm text-center py-8">
                No hay datos de entregas para el período seleccionado
              </p>
            ) : (
              <div className="flex items-end gap-1 h-32 overflow-x-auto">
                {analytics.daily_volumes.map(({ date, count }) => (
                  <div key={date} className="flex flex-col items-center gap-1 min-w-[28px]">
                    <div
                      className="w-5 bg-[#FF6B35] rounded-t transition-all"
                      style={{ height: `${Math.max(4, (count / maxVolume) * 100)}%` }}
                      title={`${date}: ${count}`}
                    />
                    <span className="text-[var(--text-muted)] text-[9px] rotate-45 origin-left">
                      {date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status breakdown + Top riders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status breakdown */}
            <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-5">
              <h2 className="text-[var(--text-strong)] font-semibold mb-4">Por estado</h2>
              <div className="space-y-3">
                {[
                  { label: 'Entregados',  value: analytics.status_breakdown.delivered, color: 'bg-green-500' },
                  { label: 'Fallidos',    value: analytics.status_breakdown.failed,    color: 'bg-red-500' },
                  { label: 'Cancelados',  value: analytics.status_breakdown.cancelled, color: 'bg-[var(--surface-sunken)]' },
                ].map(({ label, value, color }) => {
                  const total = analytics.total_completed + analytics.status_breakdown.failed + analytics.status_breakdown.cancelled
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--text-muted)]">{label}</span>
                        <span className="text-[var(--text-strong)]">{value} <span className="text-[var(--text-muted)]">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-[var(--surface-sunken)] rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top riders */}
            <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-5">
              <h2 className="text-[var(--text-strong)] font-semibold mb-4">Top riders</h2>
              {analytics.top_riders.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm">Sin datos en el período</p>
              ) : (
                <div className="space-y-3">
                  {analytics.top_riders.map(({ rider, completed_count }, i) => (
                    <div key={rider.id} className="flex items-center gap-3">
                      <span className="text-[var(--text-muted)] text-sm w-4">{i + 1}</span>
                      <div className="w-7 h-7 rounded-full bg-[#FF6B35]/20 flex items-center justify-center text-[#E55A2B] text-xs font-bold shrink-0">
                        {rider.full_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--text-strong)] text-sm truncate">{rider.full_name}</p>
                        {rider.avg_rating && (
                          <p className="text-[var(--text-muted)] text-xs">{rider.avg_rating}★</p>
                        )}
                      </div>
                      <span className="text-[var(--text-muted)] text-sm shrink-0">{completed_count} entregas</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
