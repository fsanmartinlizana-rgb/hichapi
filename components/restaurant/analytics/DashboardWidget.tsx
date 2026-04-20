'use client'

// ── DashboardWidget ──────────────────────────────────────────────────────────
// Render de un widget individual según su `type`. Recibe el summary payload
// del /api/analytics/summary para evitar N llamadas HTTP (una sola request
// alimenta todos los widgets de la página).
//
// Agregado Sprint 3.

import {
  DollarSign, TrendingUp, TrendingDown, Receipt, Grid3x3,
  AlertTriangle, BarChart2, Clock, Sparkles,
} from 'lucide-react'
import type { AnalyticsSummary } from './types'

function clp(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

export function DashboardWidget({ type, summary }: { type: string; summary: AnalyticsSummary | null }) {
  if (!summary) {
    return (
      <div className="h-full rounded-2xl border border-white/5 bg-white/[0.02] animate-pulse" />
    )
  }

  switch (type) {
    case 'revenue_today':
    case 'revenue_week':
      return <RevenueKpi summary={summary} />
    case 'avg_ticket':
      return <AvgTicket summary={summary} />
    case 'open_tables_now':
      return <OpenTables summary={summary} />
    case 'inventory_low_stock':
      return <LowStock summary={summary} />
    case 'top_items_week':
      return <TopItems summary={summary} />
    case 'peak_hours_heatmap':
    case 'orders_by_hour':
      return <HourlyOrders summary={summary} />
    case 'chapi_tip_of_the_day':
      return <ChapiTip summary={summary} />
    default:
      return (
        <div className="h-full flex items-center justify-center rounded-2xl border border-white/8 bg-[#161622] text-white/40 text-xs">
          Widget desconocido: {type}
        </div>
      )
  }
}

// ─── Widgets ──────────────────────────────────────────────────────────────

function RevenueKpi({ summary }: { summary: AnalyticsSummary }) {
  const delta = summary.comparison.delta_pct
  const positive = delta >= 0
  return (
    <div className="h-full rounded-2xl border border-white/8 bg-[#161622] p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-[11px] uppercase tracking-wider">Ingresos ({summary.period})</p>
        <DollarSign size={14} className="text-emerald-400" />
      </div>
      <div className="space-y-1">
        <p className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>
          {clp(summary.revenue.total_paid)}
        </p>
        <p className={`text-[11px] flex items-center gap-1 ${positive ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
          {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {positive ? '+' : ''}{delta}% vs período anterior
        </p>
      </div>
      <p className="text-white/30 text-[10px]">{summary.revenue.orders_count} pedidos pagados</p>
    </div>
  )
}

function AvgTicket({ summary }: { summary: AnalyticsSummary }) {
  return (
    <div className="h-full rounded-2xl border border-white/8 bg-[#161622] p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-[11px] uppercase tracking-wider">Ticket promedio</p>
        <Receipt size={14} className="text-[#60A5FA]" />
      </div>
      <p className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>
        {clp(summary.revenue.avg_ticket)}
      </p>
      <p className="text-white/30 text-[10px]">{summary.revenue.orders_count} pedidos pagados · {summary.period}</p>
    </div>
  )
}

function OpenTables({ summary }: { summary: AnalyticsSummary }) {
  return (
    <div className="h-full rounded-2xl border border-white/8 bg-[#161622] p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-[11px] uppercase tracking-wider">Mesas ocupadas</p>
        <Grid3x3 size={14} className="text-[#FF6B35]" />
      </div>
      <p className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>
        {summary.open_tables}
      </p>
      <p className="text-white/30 text-[10px]">En este momento</p>
    </div>
  )
}

function LowStock({ summary }: { summary: AnalyticsSummary }) {
  const count = summary.stock_alerts
  const alert = count > 0
  return (
    <div className={`h-full rounded-2xl border p-5 flex flex-col justify-between ${alert ? 'border-amber-500/25 bg-amber-500/5' : 'border-white/8 bg-[#161622]'}`}>
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-[11px] uppercase tracking-wider">Stock bajo</p>
        <AlertTriangle size={14} className={alert ? 'text-amber-400' : 'text-white/30'} />
      </div>
      <p className={`text-2xl font-bold ${alert ? 'text-amber-300' : 'text-white'}`} style={{ fontFamily: 'var(--font-dm-mono)' }}>
        {count}
      </p>
      <p className="text-white/30 text-[10px]">Insumos bajo el umbral mínimo</p>
    </div>
  )
}

function TopItems({ summary }: { summary: AnalyticsSummary }) {
  const items = summary.top_items
  const max = Math.max(...items.map(i => i.qty), 1)
  return (
    <div className="h-full rounded-2xl border border-white/8 bg-[#161622] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white font-semibold text-sm">Top productos</p>
        <TrendingUp size={14} className="text-white/30" />
      </div>
      {items.length === 0 ? (
        <p className="text-white/30 text-xs italic">Sin datos en el período</p>
      ) : (
        <div className="space-y-2">
          {items.map(i => (
            <div key={i.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/80 truncate flex-1 mr-3">{i.name}</span>
                <span className="text-white/40 font-mono shrink-0">{i.qty} · {clp(i.revenue)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-[#FF6B35]" style={{ width: `${(i.qty / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HourlyOrders({ summary }: { summary: AnalyticsSummary }) {
  const data = summary.by_hour
  const max = Math.max(...data.map(d => d.orders), 1)
  return (
    <div className="h-full rounded-2xl border border-white/8 bg-[#161622] p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white font-semibold text-sm">Órdenes por hora</p>
        <Clock size={14} className="text-white/30" />
      </div>
      <div className="flex-1 flex items-end gap-0.5">
        {data.map(d => {
          const h = (d.orders / max) * 100
          return (
            <div key={d.hour} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.hour}:00 — ${d.orders} pedidos, ${clp(d.revenue)}`}>
              <div
                className="w-full rounded-t bg-[#FF6B35]/80 group-hover:bg-[#FF6B35] transition-colors"
                style={{ height: `${h}%`, minHeight: d.orders > 0 ? 2 : 0 }}
              />
              {d.hour % 3 === 0 && (
                <span className="text-[9px] text-white/30">{d.hour}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChapiTip({ summary }: { summary: AnalyticsSummary }) {
  // Tip heurístico básico — sin llamada adicional a LLM. Si querés fanciness,
  // Sprint 4 lo cablea al endpoint /api/insights/chat.
  const topItem = summary.top_items[0]
  const bestHour = summary.by_hour.reduce<{ hour: number; orders: number } | null>(
    (acc, h) => (acc && acc.orders >= h.orders ? acc : h),
    null,
  )
  let tip = 'Agregá órdenes para recibir tips contextuales de Chapi.'
  if (summary.revenue.orders_count > 0) {
    if (summary.comparison.delta_pct >= 10) {
      tip = `Vas +${summary.comparison.delta_pct}% vs el período anterior. Aprovechá el momentum para probar un plato nuevo en la carta.`
    } else if (summary.comparison.delta_pct <= -10) {
      tip = `Bajaste ${summary.comparison.delta_pct}% vs el período anterior. Revisá tickets cancelados y tiempos de cocina.`
    } else if (topItem) {
      tip = `${topItem.name} es tu top seller (${topItem.qty} unidades). ${bestHour && bestHour.orders > 0 ? `Hora pico: ${bestHour.hour}:00.` : ''} Considerá destacarlo en la carta digital.`
    }
  }
  return (
    <div className="h-full rounded-2xl border border-[#FF6B35]/20 bg-gradient-to-br from-[#FF6B35]/10 to-transparent p-5 flex flex-col justify-between">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-[#FF6B35]" />
        <p className="text-white font-semibold text-sm">Chapi dice</p>
      </div>
      <p className="text-white/80 text-sm leading-relaxed">{tip}</p>
      <p className="text-white/30 text-[10px]">Actualizado ahora</p>
    </div>
  )
}
