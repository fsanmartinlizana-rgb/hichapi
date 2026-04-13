'use client'

import { useState } from 'react'
import { TrendingUp, ArrowUpRight, ArrowDownRight, Download, Zap } from 'lucide-react'

// ── Mock data ─────────────────────────────────────────────────────────────────

const PERIODS = ['7 días', '30 días', '3 meses', '12 meses']

const KPI_CARDS = [
  { label: 'Revenue del período', value: '$18.4M', delta: '+23%', up: true,  sub: 'vs período anterior' },
  { label: 'Ticket promedio',     value: '$17.8k', delta: '+5%',  up: true,  sub: 'por persona' },
  { label: 'Covers totales',      value: '1,842',  delta: '+17%', up: true,  sub: 'personas atendidas' },
  { label: 'Adopción Chapi',      value: '68%',    delta: '+12%', up: true,  sub: 'pedidos vía Chapi' },
]

// margin: estimated gross margin %, trend: last 5 weeks (relative units), chapi_rec codes:
// 'promote' | 'raise_price' | 'review_cost' | 'consider_remove'
const ITEM_ANALYTICS = [
  { name: 'Lomo vetado',     orders: 312, revenue: 520, margin: 65, trend: [70, 75, 80, 88, 100], chapi_rec: 'promote'         },
  { name: 'Pasta arrabiata', orders: 280, revenue: 380, margin: 72, trend: [85, 90, 88, 92, 95],  chapi_rec: 'raise_price'     },
  { name: 'Salmón grillado', orders: 245, revenue: 430, margin: 51, trend: [100, 95, 88, 80, 72], chapi_rec: 'review_cost'     },
  { name: 'Tiramisú',        orders: 290, revenue: 210, margin: 78, trend: [55, 60, 68, 75, 88],  chapi_rec: 'promote'         },
  { name: 'Ensalada César',  orders: 178, revenue: 160, margin: 44, trend: [65, 62, 60, 58, 55],  chapi_rec: 'review_cost'     },
  { name: 'Gazpacho',        orders: 42,  revenue: 58,  margin: 38, trend: [90, 72, 55, 40, 25],  chapi_rec: 'consider_remove' },
]

const MONTHLY = [
  { m: 'Oct', v: 14200, proj: false },
  { m: 'Nov', v: 15800, proj: false },
  { m: 'Dic', v: 22400, proj: false },
  { m: 'Ene', v: 11200, proj: false },
  { m: 'Feb', v: 13600, proj: false },
  { m: 'Mar', v: 18400, proj: false },
  { m: 'Abr', v: 19800, proj: true  },
  { m: 'May', v: 21200, proj: true  },
]

// Revenue by hour (thousands CLP)
const HOUR_REVENUE = [
  { h: '12h', v: 820  },
  { h: '13h', v: 1540 },
  { h: '14h', v: 1280 },
  { h: '15h', v: 420  },
  { h: '16h', v: 280  },
  { h: '17h', v: 390  },
  { h: '18h', v: 680  },
  { h: '19h', v: 2100 },
  { h: '20h', v: 2850 },
  { h: '21h', v: 3200 },
  { h: '22h', v: 1950 },
  { h: '23h', v: 740  },
]

const CHAPI_ACTIONS = [
  {
    icon: '💰',
    title: 'Precio del lomo vetado: puedes subir $500',
    body: 'Sin afectar demanda (elasticidad calculada). Genera +$156k/mes con la misma cantidad de pedidos.',
    cta: 'Aplicar',
    color: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400',
  },
  {
    icon: '📅',
    title: 'Miércoles 15–17h: activa una promoción',
    body: 'Franja de baja ocupación. Una promoción en ese horario genera ~$85k adicionales por semana según datos históricos.',
    cta: 'Crear promoción',
    color: 'border-[#FF6B35]/25 bg-[#FF6B35]/5 text-[#FF6B35]',
  },
  {
    icon: '⭐',
    title: 'Tiramisú: muévelo a "destacado" en la carta',
    body: 'Margen del 78% y tendencia en alza. Posicionarlo como destacado aumentaría ventas un 23% según datos de conversión.',
    cta: 'Actualizar carta',
    color: 'border-yellow-500/25 bg-yellow-500/5 text-yellow-400',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const MARGIN_COLORS: Record<string, string> = {
  green:  'text-emerald-400 bg-emerald-500/10',
  yellow: 'text-yellow-400 bg-yellow-500/10',
  red:    'text-red-400 bg-red-500/10',
}

function marginBucket(m: number): 'green' | 'yellow' | 'red' {
  if (m >= 60) return 'green'
  if (m >= 40) return 'yellow'
  return 'red'
}

const REC_LABELS: Record<string, string> = {
  promote:         '🔥 Promover activamente',
  raise_price:     '📈 Subir precio 10%',
  review_cost:     '⚠️ Revisar costo',
  consider_remove: '📉 Considera retirar',
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values)
  return (
    <div className="flex items-end gap-0.5 h-6">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-sm"
          style={{
            height: `${Math.round((v / max) * 24)}px`,
            backgroundColor: i === values.length - 1 ? '#FF6B35' : '#3A3A55',
          }}
        />
      ))}
    </div>
  )
}

// ── Upcoming events advisor ──────────────────────────────────────────────────

const CHILE_EVENTS = [
  { month: 1, day: 1,  name: 'Año Nuevo', tip: 'Brunch especial post-celebración', impact: 'medio' as const },
  { month: 2, day: 14, name: 'San Valentín', tip: 'Menú para parejas, reservas llenas', impact: 'alto' as const },
  { month: 3, day: 8,  name: 'Día de la Mujer', tip: 'Promociones especiales, alta demanda', impact: 'medio' as const },
  { month: 5, day: 11, name: 'Día de la Madre', tip: 'Mayor demanda del año, refuerza personal', impact: 'alto' as const },
  { month: 5, day: 21, name: 'Día de las Glorias Navales', tip: 'Feriado largo, turismo alto', impact: 'medio' as const },
  { month: 6, day: 15, name: 'Día del Padre', tip: 'Almuerzos familiares, menú especial', impact: 'alto' as const },
  { month: 7, day: 16, name: 'Día de la Virgen del Carmen', tip: 'Feriado religioso, flujo turístico', impact: 'bajo' as const },
  { month: 9, day: 18, name: 'Fiestas Patrias', tip: 'Semana completa de alta demanda, menú criollo', impact: 'alto' as const },
  { month: 10, day: 31, name: 'Halloween', tip: 'Eventos temáticos, cócteles especiales', impact: 'medio' as const },
  { month: 12, day: 24, name: 'Nochebuena', tip: 'Cenas familiares, reservas con anticipación', impact: 'alto' as const },
  { month: 12, day: 31, name: 'Año Nuevo', tip: 'Cena de fin de año, precios premium', impact: 'alto' as const },
]

function getUpcomingEvents() {
  const now = new Date()
  const upcoming: { date: string; name: string; tip: string; impact: string; daysUntil: number }[] = []

  for (const evt of CHILE_EVENTS) {
    let evtDate = new Date(now.getFullYear(), evt.month - 1, evt.day)
    if (evtDate < now) evtDate = new Date(now.getFullYear() + 1, evt.month - 1, evt.day)
    const daysUntil = Math.ceil((evtDate.getTime() - now.getTime()) / 86400000)
    if (daysUntil <= 60) {
      upcoming.push({
        date: `En ${daysUntil} días · ${evtDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`,
        name: evt.name,
        tip: evt.tip,
        impact: evt.impact,
        daysUntil,
      })
    }
  }

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 3)
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30 días')

  const maxMonthly = Math.max(...MONTHLY.map(m => m.v))
  const maxHour    = Math.max(...HOUR_REVENUE.map(h => h.v))

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Analytics</h1>
          <p className="text-white/40 text-sm mt-0.5">Inteligencia de negocio de tu restaurante</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-white/3 border border-white/6 rounded-xl p-1">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all
                  ${period === p ? 'bg-[#FF6B35] text-white font-medium' : 'text-white/35 hover:text-white/60'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/8 transition-colors">
            <Download size={12} /> Exportar PDF
          </button>
        </div>
      </div>

      {/* ── Row 1: KPI cards ── */}
      <div className="grid grid-cols-4 gap-4">
        {KPI_CARDS.map(k => (
          <div key={k.label} className="bg-[#161622] border border-white/5 rounded-2xl p-4">
            <p className="text-white/40 text-xs mb-2">{k.label}</p>
            <p className="text-white text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-dm-mono)' }}>{k.value}</p>
            <div className="flex items-center gap-1.5">
              {k.up
                ? <ArrowUpRight size={11} className="text-emerald-400" />
                : <ArrowDownRight size={11} className="text-red-400" />}
              <span className={`text-xs font-medium ${k.up ? 'text-emerald-400' : 'text-red-400'}`}>{k.delta}</span>
              <span className="text-white/25 text-xs">{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Rentabilidad table ── */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold text-sm">Análisis de rentabilidad</p>
          <span className="text-white/25 text-[10px] flex items-center gap-1"><Zap size={10} className="text-[#FF6B35]" /> Impulsado por Chapi</span>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_2fr] gap-3 pb-2 border-b border-white/5 text-white/30 text-[10px] font-semibold uppercase tracking-wider">
          <span>Plato</span>
          <span className="text-right">Pedidos</span>
          <span className="text-right">Revenue</span>
          <span className="text-center">Margen</span>
          <span className="text-center">Tendencia</span>
          <span>Recomendación Chapi</span>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {ITEM_ANALYTICS.map(item => {
            const bucket = marginBucket(item.margin)
            const marginCls = MARGIN_COLORS[bucket]
            return (
              <div
                key={item.name}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_2fr] gap-3 py-3 items-center"
              >
                <span className="text-white/80 text-sm font-medium">{item.name}</span>
                <span className="text-right text-white/50 text-sm font-mono">{item.orders}</span>
                <span className="text-right text-white/70 text-sm font-mono">${item.revenue}k</span>
                <div className="flex justify-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${marginCls}`}>
                    {item.margin}%
                  </span>
                </div>
                <div className="flex justify-center">
                  <Sparkline values={item.trend} />
                </div>
                <span className="text-white/40 text-[11px]">{REC_LABELS[item.chapi_rec]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Row 3: Revenue chart + Hour heatmap ── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Revenue mensual + proyección */}
        <div className="bg-[#161622] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-semibold text-sm">Revenue mensual (CLP miles)</p>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#3A3A55] inline-block" /> Real</span>
              <span className="flex items-center gap-1 text-white/40"><span className="w-2.5 h-2.5 rounded-sm bg-[#FF6B35]/30 inline-block border border-dashed border-[#FF6B35]/50" /> Proyección</span>
            </div>
          </div>
          <div className="flex items-end gap-2.5 h-32">
            {MONTHLY.map(({ m, v, proj }) => (
              <div key={m} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-white/35 text-[10px] font-mono">{(v / 1000).toFixed(0)}M</span>
                <div
                  className="w-full rounded-t-lg transition-all hover:opacity-90"
                  style={{
                    height: `${(v / maxMonthly) * 96}px`,
                    backgroundColor: proj ? 'transparent' : m === 'Mar' ? '#FF6B35' : '#3A3A55',
                    border: proj ? '1.5px dashed rgba(255,107,53,0.45)' : 'none',
                    backgroundImage: proj ? 'linear-gradient(to top, rgba(255,107,53,0.15), rgba(255,107,53,0.05))' : 'none',
                  }}
                />
                <span className={`text-[10px] ${proj ? 'text-[#FF6B35]/50' : 'text-white/25'}`}>{m}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
            <TrendingUp size={13} className="text-emerald-400" />
            <span className="text-emerald-400 text-xs font-semibold">+30% vs Oct–Dic</span>
            <span className="text-white/25 text-xs">· Proyección Abr–May: +8%</span>
          </div>
        </div>

        {/* Horas de mayor valor */}
        <div className="bg-[#161622] border border-white/5 rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-1">Horas de mayor valor</p>
          <p className="text-white/30 text-[10px] mb-4">Revenue promedio por hora del día (CLP)</p>
          <div className="flex items-end gap-1.5 h-28">
            {HOUR_REVENUE.map(({ h, v }) => {
              const pct = (v / maxHour) * 100
              const isTop = v === maxHour
              const isHigh = pct > 60
              return (
                <div key={h} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{
                      height: `${pct * 0.96}px`,
                      backgroundColor: isTop ? '#FF6B35' : isHigh ? '#FF6B3570' : '#3A3A55',
                    }}
                  />
                  <span className="text-white/20 text-[8px]">{h}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-white/5">
            <p className="text-white/30 text-[10px]">
              21h es tu hora pico · Mediodía (13h) es el segundo peak · 16h es el valle del día
            </p>
          </div>
        </div>
      </div>

      {/* ── Advisor: Fechas importantes ── */}
      <div className="bg-gradient-to-r from-purple-500/10 to-[#FF6B35]/10 border border-purple-500/20 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-purple-400" />
          <p className="text-white font-semibold text-sm">Fechas importantes para tu negocio</p>
        </div>
        <p className="text-white/40 text-xs">Prepárate con anticipación para estos eventos que impactan la demanda</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {getUpcomingEvents().map(evt => (
            <div key={evt.name} className="bg-white/5 border border-white/8 rounded-xl p-3 space-y-1">
              <p className="text-white/60 text-[10px] font-mono">{evt.date}</p>
              <p className="text-white font-semibold text-xs">{evt.name}</p>
              <p className="text-white/30 text-[10px]">{evt.tip}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${evt.impact === 'alto' ? 'bg-red-500/15 text-red-400' : evt.impact === 'medio' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-white/5 text-white/30'}`}>
                  Impacto {evt.impact}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 4: Acciones recomendadas por Chapi ── */}
      <div>
        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">
          Acciones recomendadas por Chapi
        </p>
        <div className="grid grid-cols-3 gap-4">
          {CHAPI_ACTIONS.map(a => (
            <div key={a.title} className={`border rounded-2xl p-5 space-y-3 ${a.color.split(' ').slice(0, 2).join(' ')}`}>
              <div className="flex items-start gap-2.5">
                <span className="text-xl shrink-0 mt-0.5">{a.icon}</span>
                <p className="text-white font-semibold text-sm leading-snug">{a.title}</p>
              </div>
              <p className="text-white/50 text-xs leading-relaxed">{a.body}</p>
              <button className={`w-full py-2 rounded-xl text-xs font-semibold transition-colors border ${a.color.split(' ').slice(2).join(' ')} border-current/30 hover:opacity-80`}>
                {a.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
