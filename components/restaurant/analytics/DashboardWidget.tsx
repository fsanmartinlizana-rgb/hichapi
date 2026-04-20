'use client'

// ── DashboardWidget ──────────────────────────────────────────────────────────
// Render de un widget individual según su `type`. Recibe el summary payload
// del /api/analytics/summary para evitar N llamadas HTTP (una sola request
// alimenta todos los widgets de la página).
//
// Agregado Sprint 3.

import {
  DollarSign, TrendingUp, TrendingDown, Receipt, Grid3x3,
  AlertTriangle, BarChart2, Clock, Sparkles, Trash2,
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
    case 'occupancy_heatmap':
      return <OccupancyHeatmap summary={summary} />
    case 'orders_by_hour':
      return <HourlyOrders summary={summary} />
    case 'chapi_tip_of_the_day':
      return <ChapiTip summary={summary} />
    case 'waste_cost':
      return <WasteCost summary={summary} />
    case 'waste_breakdown':
      return <WasteBreakdown summary={summary} />
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

// ── Heatmap de ocupación (día de la semana × hora) ───────────────────────
// Reemplaza al gráfico de barras horario que era poco legible. Muestra una
// grilla de 7 filas × 12 columnas (horas operativas) con intensidad naranja
// proporcional al promedio de órdenes por celda. Las celdas con <35% del
// pico se marcan como "hora valle" — candidatas a promociones.

const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const
// Horas visibles por default. Si hay data fuera, el componente expande
// el rango automáticamente.
const DEFAULT_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]

function OccupancyHeatmap({ summary }: { summary: AnalyticsSummary }) {
  const rawHeatmap = summary.heatmap
  if (!rawHeatmap || rawHeatmap.length !== 7) {
    return (
      <div className="h-full rounded-2xl border border-white/8 bg-[#161622] p-5 flex items-center justify-center">
        <p className="text-white/30 text-xs italic">Sin datos de ocupación en el período</p>
      </div>
    )
  }

  // Re-index: en JS Date.getDay() devuelve 0=Dom..6=Sab. Queremos mostrar
  // Lun..Dom. heatmapByDayEs[0]=Lunes .. [6]=Domingo.
  const heatmapByDayEs: number[][] = [1, 2, 3, 4, 5, 6, 0].map(dow => rawHeatmap[dow])

  // Determinar rango de horas con actividad para expandir si es necesario
  let minHour = 24
  let maxHour = 0
  let hasAnyData = false
  for (const row of rawHeatmap) {
    for (let h = 0; h < 24; h++) {
      if (row[h] > 0) {
        hasAnyData = true
        if (h < minHour) minHour = h
        if (h > maxHour) maxHour = h
      }
    }
  }
  const hours = hasAnyData
    ? Array.from(
        { length: Math.max(maxHour - minHour + 1, 8) },
        (_, i) => Math.min(minHour + i, 23),
      )
    : DEFAULT_HOURS

  // Max global para escalar intensidades
  let max = 0
  for (const row of heatmapByDayEs) for (const h of hours) if (row[h] > max) max = row[h]
  if (max === 0) max = 1

  // "Hora valle" = celda con actividad entre 5% y 35% del pico (no 0 para
  // no marcar horarios cerrados como si fueran una oportunidad de promoción)
  const isValley = (v: number) => {
    const pct = v / max
    return pct > 0.05 && pct < 0.35
  }

  // Conteo total de horas valle para el insight-texto
  let valleyCount = 0
  for (const row of heatmapByDayEs) for (const h of hours) if (isValley(row[h])) valleyCount++

  return (
    <div className="h-full rounded-2xl border border-white/8 bg-[#161622] p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <p className="text-white font-semibold text-sm">Ocupación por día y hora</p>
          <p className="text-white/35 text-[10px]">
            Promedio de órdenes · {summary.period}
            {valleyCount > 0 && ` · ${valleyCount} horas valle detectadas`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-white/40 shrink-0 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: 'rgba(255,107,53,0.08)' }} />0</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#FF6B35]/60 inline-block" /></span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#FF6B35] inline-block" />pico</span>
          <span className="flex items-center gap-1 ml-1"><span className="w-3 h-2 rounded-sm ring-1 ring-red-500/50 inline-block" />valle</span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-x-auto">
        <div className="min-w-full">
          {/* Header row con horas */}
          <div className="flex gap-[3px] mb-1 pl-10">
            {hours.map(h => (
              <div key={h} className="flex-1 text-center text-[9px] text-white/30 font-mono min-w-[22px]">
                {h}h
              </div>
            ))}
          </div>
          {/* Day rows */}
          {heatmapByDayEs.map((row, dayIdx) => (
            <div key={dayIdx} className="flex items-center gap-[3px] mb-[3px]">
              <span className="w-9 text-[10px] text-white/40 shrink-0 font-semibold">{DAYS_ES[dayIdx]}</span>
              {hours.map(h => {
                const v = row[h] ?? 0
                const intensity = v / max
                const valley = isValley(v)
                return (
                  <div
                    key={h}
                    title={`${DAYS_ES[dayIdx]} ${String(h).padStart(2, '0')}:00 — ${v.toFixed(1)} pedidos promedio`}
                    className={`flex-1 h-7 rounded transition-all cursor-default flex items-center justify-center min-w-[22px] group relative
                      ${valley ? 'ring-1 ring-red-500/40' : ''}`}
                    style={{
                      backgroundColor: v === 0
                        ? 'rgba(255,255,255,0.03)'
                        : `rgba(255,107,53,${0.1 + intensity * 0.8})`,
                    }}
                  >
                    {intensity > 0.4 && (
                      <span className="text-[9px] font-mono text-white/90">{Math.round(v)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Insight footer */}
      {valleyCount > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-start gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
          <p className="text-white/50 text-[11px] leading-relaxed">
            Las celdas con borde rojo son <span className="text-red-300">horas valle</span> (5-35% del pico).
            Son oportunidades para activar promociones y balancear la demanda.
          </p>
        </div>
      )}
    </div>
  )
}

function HourlyOrders({ summary }: { summary: AnalyticsSummary }) {
  // Recortamos a horas típicas de operación (10:00-00:00). Las 01-09 suelen
  // estar vacías y solo agregan ruido visual. Si hay data fuera de este
  // rango, ampliamos dinámicamente al mínimo necesario.
  const full = summary.by_hour
  const anyBeforeTen = full.slice(0, 10).some(d => d.orders > 0)
  const startHour = anyBeforeTen ? 0 : 10
  const data = full.slice(startHour)

  const max = Math.max(...data.map(d => d.orders), 1)
  const peak = data.reduce<{ hour: number; orders: number } | null>(
    (acc, d) => (acc && acc.orders >= d.orders ? acc : d), null,
  )
  const totalOrders = data.reduce((s, d) => s + d.orders, 0)

  // Ticks del eje Y (4 líneas): 25% 50% 75% 100% del max
  const yTicks = [0.25, 0.5, 0.75, 1].map(f => Math.ceil(max * f))

  return (
    <div className="h-full rounded-2xl border border-white/8 bg-[#161622] p-5 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-white font-semibold text-sm">Órdenes por hora</p>
          <p className="text-white/35 text-[10px]">
            {totalOrders} pedido{totalOrders === 1 ? '' : 's'} en el período
            {peak && peak.orders > 0 && ` · pico ${String(peak.hour).padStart(2, '0')}:00 con ${peak.orders}`}
          </p>
        </div>
        <Clock size={14} className="text-white/30" />
      </div>

      {/* Chart area: eje Y izquierdo con ticks + barras */}
      <div className="flex-1 flex gap-2 min-h-[160px] mt-3">
        {/* Y axis labels */}
        <div className="flex flex-col justify-between py-1 pr-1 text-right">
          {[...yTicks].reverse().map(t => (
            <span key={t} className="text-[9px] text-white/30 font-mono leading-none">{t}</span>
          ))}
          <span className="text-[9px] text-white/30 font-mono leading-none">0</span>
        </div>

        {/* Bars + grid */}
        <div className="flex-1 relative">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[...yTicks, 0].reverse().map((_, i) => (
              <div key={i} className="border-t border-white/5" />
            ))}
          </div>

          {/* Bars */}
          <div className="relative h-full flex items-end gap-[3px]">
            {data.map(d => {
              const isPeak = peak && d.hour === peak.hour && d.orders > 0
              const h = (d.orders / max) * 100
              return (
                <div
                  key={d.hour}
                  className="flex-1 flex flex-col items-center gap-1 group relative"
                >
                  {/* Tooltip */}
                  {d.orders > 0 && (
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-medium px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                      {String(d.hour).padStart(2, '0')}:00
                      <span className="text-white/50"> · </span>
                      {d.orders} pedido{d.orders === 1 ? '' : 's'}
                      <span className="text-white/50"> · </span>
                      {clp(d.revenue)}
                    </div>
                  )}
                  <div
                    className={`w-full rounded-t transition-all ${
                      isPeak
                        ? 'bg-[#FF6B35] group-hover:bg-[#ff7a4a]'
                        : d.orders > 0
                        ? 'bg-[#FF6B35]/60 group-hover:bg-[#FF6B35]'
                        : 'bg-white/5 group-hover:bg-white/10'
                    }`}
                    style={{ height: `${Math.max(h, d.orders > 0 ? 3 : 0)}%` }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* X axis — horas cada 2 */}
      <div className="flex gap-[3px] mt-1 pl-[26px]">
        {data.map(d => (
          <div key={d.hour} className="flex-1 text-center">
            {(d.hour - startHour) % 2 === 0 && (
              <span className="text-[9px] text-white/35 font-mono">{String(d.hour).padStart(2, '0')}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function WasteCost({ summary }: { summary: AnalyticsSummary }) {
  const total  = summary.waste?.total_cost   ?? 0
  const events = summary.waste?.events_count ?? 0
  return (
    <div className={`h-full rounded-2xl border p-5 flex flex-col justify-between ${total > 0 ? 'border-red-500/20 bg-red-500/5' : 'border-white/8 bg-[#161622]'}`}>
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-[11px] uppercase tracking-wider">Pérdidas ({summary.period})</p>
        <Trash2 size={14} className={total > 0 ? 'text-red-400' : 'text-white/30'} />
      </div>
      <p className={`text-2xl font-bold ${total > 0 ? 'text-red-300' : 'text-white'}`} style={{ fontFamily: 'var(--font-dm-mono)' }}>
        {clp(total)}
      </p>
      <p className="text-white/30 text-[10px]">
        {events} evento{events === 1 ? '' : 's'} registrado{events === 1 ? '' : 's'}
      </p>
    </div>
  )
}

const REASON_LABEL: Record<string, string> = {
  vencimiento: 'Vencimiento',
  deterioro:   'Deterioro',
  rotura:      'Rotura',
  error_prep:  'Error de prep.',
  sobras:      'Sobras',
  devolucion:  'Devolución',
  merma:       'Merma',
  perdida:     'Pérdida',
  otro:        'Otro',
}

function WasteBreakdown({ summary }: { summary: AnalyticsSummary }) {
  const reasons = summary.waste?.top_reasons ?? []
  const max     = Math.max(...reasons.map(r => r.cost), 1)
  const total   = summary.waste?.total_cost ?? 0
  return (
    <div className="h-full rounded-2xl border border-white/8 bg-[#161622] p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white font-semibold text-sm">Mermas por razón</p>
          <p className="text-white/35 text-[10px]">Costo total: {clp(total)}</p>
        </div>
        <Trash2 size={14} className="text-white/30" />
      </div>
      {reasons.length === 0 ? (
        <p className="text-white/30 text-xs italic">Sin mermas en el período. Bien ahí.</p>
      ) : (
        <div className="space-y-2">
          {reasons.map(r => (
            <div key={r.reason} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/80">{REASON_LABEL[r.reason] ?? r.reason}</span>
                <span className="text-white/40 font-mono">
                  {r.count} · {clp(r.cost)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-red-400/70" style={{ width: `${(r.cost / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
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
