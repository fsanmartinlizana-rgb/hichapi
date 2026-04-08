'use client'

import { useState } from 'react'
import {
  TrendingUp, TrendingDown, Users, Star,
  ChevronRight, ArrowUpRight, Zap, AlertCircle, Info,
  Plus, FileText, Clock, Check,
} from 'lucide-react'
import Link from 'next/link'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats a Chilean peso amount.
 * >= 100 000 → "$847K"  (compact, no decimals)
 *  < 100 000 → "$18.400" (es-CL full thousands separator)
 */
function clp(amount: number): string {
  if (amount >= 100_000) {
    const k = Math.round(amount / 1_000)
    return `$${k}K`
  }
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ── Mock data ───────────────────────────────────────────────────────────────

const KPIS = [
  {
    label: 'Ventas hoy',
    value: clp(847_000),
    delta: '+12%',
    sub: 'vs lunes típico',
    showTooltip: true,
    up: true,
    color: '#FF6B35',
  },
  {
    label: 'Ticket promedio',
    value: clp(18_400),
    delta: '+4%',
    sub: 'vs promedio',
    showTooltip: false,
    up: true,
    color: '#60A5FA',
  },
  {
    label: 'Pedidos activos',
    value: '7',
    delta: null,
    sub: null,
    showTooltip: false,
    up: null,
    color: '#FBBF24',
    statusBreakdown: [
      { label: 'en espera', count: 2, color: '#94A3B8',  bg: 'bg-slate-500/15'  },
      { label: 'en cocina', count: 3, color: '#FBBF24',  bg: 'bg-yellow-500/15' },
      { label: 'listos',    count: 1, color: '#34D399',  bg: 'bg-emerald-500/15'},
      { label: 'entregados',count: 1, color: '#60A5FA',  bg: 'bg-blue-500/15'   },
    ],
  },
  {
    label: 'NPS del día',
    value: '74',
    delta: '↑ 8 pts',
    sub: 'vs semana',
    showTooltip: false,
    up: true,
    color: '#34D399',
  },
]

const ORDERS = [
  {
    id: 'M-4',
    table: 'Mesa 4',
    pax: '3 personas',
    items: 'Lomo vetado, Ensalada César, Pasta arrabiata',
    amount: 54_200,
    mins: 12,
    via: true,
    status: 'active',
    color: '#FF6B35',
  },
  {
    id: 'M-7',
    table: 'Mesa 7',
    pax: '2 personas',
    items: 'Salmón grillado (sin gluten), Gazpacho',
    amount: 38_900,
    mins: 3,
    via: true,
    status: 'active',
    color: '#60A5FA',
  },
  {
    id: 'M-2',
    table: 'Mesa 2',
    pax: '4 personas',
    items: 'Pizza napolitana ×2, Risotto, Tiramisú',
    amount: 71_600,
    mins: 28,
    via: true,
    status: 'active',
    color: '#FF6B35',
  },
  {
    id: 'M-11',
    table: 'Mesa 11',
    pax: '5 personas',
    items: 'Solicitando cuenta · split en proceso',
    amount: 112_400,
    mins: 52,
    via: true,
    status: 'cuenta',
    color: '#FBBF24',
  },
  {
    id: 'M-9',
    table: 'Mesa 9',
    pax: '2 personas',
    items: 'Ceviche, Pisco sour ×2, Pan de ajo',
    amount: 29_800,
    mins: 8,
    via: true,
    status: 'active',
    color: '#60A5FA',
  },
]

const MESAS = [
  { id: '01', status: 'ocupada' },
  { id: '02', status: 'cuenta'  },
  { id: '03', status: 'libre'   },
  { id: '04', status: 'ocupada' },
  { id: '05', status: 'libre'   },
  { id: '06', status: 'libre'   },
  { id: '07', status: 'ocupada' },
  { id: '08', status: 'reserva' },
  { id: '09', status: 'ocupada' },
  { id: '10', status: 'libre'   },
  { id: '11', status: 'cuenta'  },
  { id: '12', status: 'libre'   },
]

const MESA_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  ocupada: { bg: 'bg-[#FF6B35]/10', border: 'border-[#FF6B35]/30', text: 'text-[#FF6B35]' },
  cuenta:  { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  libre:   { bg: 'bg-white/3',       border: 'border-white/8',       text: 'text-white/30'  },
  reserva: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400'},
}

const CHAPI_TIPS = [
  {
    icon: <ArrowUpRight size={14} />,
    color: '#34D399',
    bg: 'bg-emerald-500/10',
    title: 'Sugerencia del chef',
    text: 'El lomo vetado tiene stock para 4 porciones más y es tu plato más pedido de la tarde.',
  },
  {
    icon: <AlertCircle size={14} />,
    color: '#FBBF24',
    bg: 'bg-yellow-500/10',
    title: 'Peak en 45 min',
    text: 'Históricamente recibes 6–8 mesas entre las 13:15 y 14:00. Tienes 5 mesas libres.',
  },
  {
    icon: <Zap size={14} />,
    color: '#60A5FA',
    bg: 'bg-blue-500/10',
    title: 'Cross-sell activo',
    text: 'Chapi ofrece tiramisú de postre. 3 de 4 mesas lo aceptaron hoy.',
  },
]

const TOP_PLATOS = [
  { name: 'Lomo vetado',    count: 18, max: 18 },
  { name: 'Pasta arrabiata', count: 13, max: 18 },
  { name: 'Salmón grillado', count: 11, max: 18 },
  { name: 'Tiramisú',        count: 8,  max: 18 },
  { name: 'Ensalada César',  count: 6,  max: 18 },
]

const HOURLY = [
  { h: '11h', v: 3  },
  { h: '12h', v: 8  },
  { h: '13h', v: 15 },
  { h: '14h', v: 11 },
  { h: '15h', v: 7  },
  { h: '16h', v: 5  },
  { h: '17h', v: 9  },
  { h: '18h', v: 13 },
  { h: '19h', v: 10 },
  { h: '20h', v: 6  },
]

// state: 'ok' | 'warning' | 'bottleneck'
const TIEMPOS = [
  {
    label: 'Tiempo en cocina',
    actual: 14,
    target: 12,
    unit: 'min',
    state: 'warning' as const,
    stateLabel: 'Atención',
  },
  {
    label: 'Tiempo de espera',
    actual: 22,
    target: 20,
    unit: 'min',
    state: 'warning' as const,
    stateLabel: 'Atención',
  },
  {
    label: 'Tiempo de entrega',
    actual: 3,
    target: 5,
    unit: 'min',
    state: 'ok' as const,
    stateLabel: 'OK',
  },
]

const STATE_COLORS = {
  ok:         { bar: '#34D399', badge: 'bg-emerald-500/15 text-emerald-400', dot: 'bg-emerald-400' },
  warning:    { bar: '#FBBF24', badge: 'bg-yellow-500/15 text-yellow-400',   dot: 'bg-yellow-400'  },
  bottleneck: { bar: '#F87171', badge: 'bg-red-500/15 text-red-400',         dot: 'bg-red-400'     },
}

// ── Components ───────────────────────────────────────────────────────────────

function KpiCard({ kpi }: { kpi: typeof KPIS[0] }) {
  const [tip, setTip] = useState(false)

  return (
    <div className="bg-[#161622] rounded-2xl border border-white/5 p-5 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <p className="text-white/40 text-xs">{kpi.label}</p>
        <div className="w-0.5 h-8 rounded-full" style={{ backgroundColor: kpi.color + '60' }} />
      </div>

      <p className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>
        {kpi.value}
      </p>

      {/* Status breakdown for "Pedidos activos" */}
      {'statusBreakdown' in kpi && kpi.statusBreakdown ? (
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {kpi.statusBreakdown.map(s => (
            <span
              key={s.label}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold ${s.bg}`}
              style={{ color: s.color }}
            >
              <span
                className="w-1 h-1 rounded-full inline-block shrink-0"
                style={{ backgroundColor: s.color }}
              />
              {s.label} ({s.count})
            </span>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {kpi.up !== null && (
            kpi.up
              ? <TrendingUp size={11} className="text-emerald-400" />
              : <TrendingDown size={11} className="text-red-400" />
          )}
          <span className={`text-xs font-medium ${kpi.up === true ? 'text-emerald-400' : kpi.up === false ? 'text-red-400' : 'text-white/50'}`}>
            {kpi.delta}
          </span>
          {kpi.sub && (
            <span className="text-white/25 text-xs flex items-center gap-1">
              {kpi.sub}
              {kpi.showTooltip && (
                <span className="relative inline-flex">
                  <button
                    onMouseEnter={() => setTip(true)}
                    onMouseLeave={() => setTip(false)}
                    className="text-white/25 hover:text-white/50 transition-colors"
                  >
                    <Info size={10} />
                  </button>
                  {tip && (
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50
                                     bg-[#1E1E2E] border border-white/10 rounded-lg px-2.5 py-1.5
                                     text-white/70 text-[10px] leading-snug whitespace-nowrap shadow-xl pointer-events-none">
                      Compara con el promedio de<br />todos los lunes de este mes
                    </span>
                  )}
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function ChapiTipCard({ tip }: { tip: typeof CHAPI_TIPS[0] }) {
  return (
    <div className="bg-[#161622] rounded-2xl border border-white/5 p-4 flex-1 min-w-0 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-lg ${tip.bg} shrink-0 flex items-center justify-center`}
          style={{ color: tip.color }}
        >
          {tip.icon}
        </div>
        <p className="text-white text-xs font-semibold">{tip.title}</p>
      </div>
      <p className="text-white/50 text-xs leading-relaxed">{tip.text}</p>
    </div>
  )
}

function OrderRow({ order }: { order: typeof ORDERS[0] }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-white/3 transition-colors group cursor-pointer">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold border"
           style={{ backgroundColor: order.color + '15', borderColor: order.color + '30', color: order.color }}>
        {order.id}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-white text-sm font-semibold">{order.table} — {order.pax}</p>
        </div>
        <p className="text-white/35 text-xs truncate">
          {order.items}
          {order.via && (
            <span className="ml-2 text-[#FF6B35]/70 text-[10px] font-medium
                             px-1.5 py-0.5 rounded bg-[#FF6B35]/10">vía Chapi</span>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-white font-semibold text-sm" style={{ fontFamily: 'var(--font-dm-mono)' }}>
          {clp(order.amount)}
        </p>
        <p className="text-white/30 text-[10px]">{order.mins} min</p>
      </div>
    </div>
  )
}

function MesaCell({ mesa }: { mesa: typeof MESAS[0] }) {
  const s = MESA_STYLES[mesa.status]
  return (
    <div className={`${s.bg} border ${s.border} rounded-xl p-3 flex flex-col items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity`}>
      <p className="text-white font-bold text-lg leading-none" style={{ fontFamily: 'var(--font-dm-mono)' }}>
        {mesa.id}
      </p>
      <p className={`text-[9px] font-medium ${s.text}`}>{mesa.status}</p>
    </div>
  )
}

function TiemposPanel() {
  return (
    <div className="bg-[#161622] rounded-2xl border border-white/5 p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Clock size={13} className="text-white/40" />
        <p className="text-white text-sm font-semibold">Tiempos operacionales</p>
      </div>
      <div className="space-y-4">
        {TIEMPOS.map((t) => {
          const colors = STATE_COLORS[t.state]
          // Progress: actual vs target. Cap bar at 120% for overflow display.
          const pct = Math.min((t.actual / (t.target * 1.5)) * 100, 100)
          const targetPct = (t.target / (t.target * 1.5)) * 100

          return (
            <div key={t.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-xs">{t.label}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-bold"
                    style={{ fontFamily: 'var(--font-dm-mono)', color: colors.bar }}
                  >
                    {t.actual} {t.unit}
                  </span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${colors.badge}`}>
                    {t.stateLabel}
                  </span>
                </div>
              </div>

              {/* Progress bar with target marker */}
              <div className="relative h-1.5 bg-white/5 rounded-full overflow-visible">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: colors.bar }}
                />
                {/* Target tick */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-white/30 rounded-full"
                  style={{ left: `${targetPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white/20 text-[9px]">0 {t.unit}</span>
                <span className="text-white/20 text-[9px]">objetivo: {t.target} {t.unit}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── PromocionesCard ──────────────────────────────────────────────────────────

function PromocionesCard() {
  const [comboActivo, setComboActivo] = useState(false)

  return (
    <div className="bg-[#161622] rounded-2xl border border-white/5 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-[#FF6B35]/15 flex items-center justify-center shrink-0">
          <Zap size={12} className="text-[#FF6B35]" />
        </div>
        <p className="text-white text-sm font-semibold flex-1">Promociones activas</p>
      </div>

      {/* Promo pills */}
      <div className="space-y-2">
        {/* Active promo */}
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-[11px] font-semibold truncate">🎯 Happy Hour tarde</p>
            <p className="text-white/35 text-[9px]">15:00–17:00 · Activa</p>
          </div>
          <span className="text-emerald-400 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 shrink-0">
            Activa
          </span>
        </div>

        {/* Inactive promo */}
        <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/3 border border-white/8">
          <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white/40 text-[11px] font-semibold truncate">🍽 Combo mediodía</p>
            <p className="text-white/25 text-[9px]">Inactiva</p>
          </div>
          {comboActivo ? (
            <span className="flex items-center gap-1 text-emerald-400 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 shrink-0">
              <Check size={8} strokeWidth={3} /> Activada
            </span>
          ) : (
            <button
              onClick={() => setComboActivo(true)}
              className="text-[#FF6B35] text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FF6B35]/10 hover:bg-[#FF6B35]/20 transition-colors shrink-0 whitespace-nowrap"
            >
              Activar →
            </button>
          )}
        </div>
      </div>

      {/* Loyalty section */}
      <div className="pt-2 border-t border-white/5 space-y-1.5">
        <p className="text-white/25 text-[9px] uppercase tracking-widest font-semibold">Beneficios para clientes frecuentes</p>
        <div className="flex items-center gap-2">
          <span className="text-sm">💎</span>
          <p className="text-white/60 text-[11px] flex-1">3 clientes con canje disponible hoy</p>
          <button className="text-[10px] text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 px-2 py-0.5 rounded-lg transition-colors shrink-0">
            Ver
          </button>
        </div>
      </div>

      {/* Footer link */}
      <Link
        href="/reporte"
        className="flex items-center justify-center gap-1 text-[#FF6B35] text-[10px] font-semibold hover:text-[#ff8255] transition-colors pt-0.5"
      >
        <Plus size={10} />
        Nueva promoción
      </Link>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [orderTab, setOrderTab] = useState<'activas' | 'hoy' | 'historial'>('activas')
  const maxH = Math.max(...HOURLY.map(h => h.v))

  return (
    <div className="p-6 space-y-5 min-h-full">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Resumen del día</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-white/40 text-sm">Lunes 6 abr</p>
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              En vivo
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/reporte"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10
                       text-white/60 text-sm hover:border-white/20 hover:text-white transition-colors"
          >
            <FileText size={13} />
            Ver reporte completo
          </Link>
          <Link
            href="/comandas?nueva=1"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B35]
                       text-white text-sm font-semibold hover:bg-[#e85d2a] transition-colors"
          >
            <Plus size={14} />
            Nueva comanda
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {KPIS.map(k => <KpiCard key={k.label} kpi={k} />)}
      </div>

      {/* Chapi recomienda — horizontal row of 3 cards */}
      <div>
        <p className="text-white/30 text-[10px] uppercase tracking-widest font-semibold mb-2.5 px-0.5">
          Chapi recomienda
        </p>
        <div className="flex gap-4">
          {CHAPI_TIPS.map((tip, i) => (
            <ChapiTipCard key={i} tip={tip} />
          ))}
        </div>
      </div>

      {/* Middle row — orders (2 cols) + right column (mesa grid + promos) */}
      <div className="grid grid-cols-3 gap-4">

        {/* Orders — 2 cols */}
        <div className="col-span-2 bg-[#161622] rounded-2xl border border-white/5 overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 pt-4 pb-0">
            {(['activas', 'hoy', 'historial'] as const).map(t => (
              <button
                key={t}
                onClick={() => setOrderTab(t)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                  orderTab === t
                    ? 'bg-white/10 text-white'
                    : 'text-white/35 hover:text-white/60',
                ].join(' ')}
              >
                {t === 'activas' ? `Activas (${ORDERS.length})` : t === 'hoy' ? 'Hoy (46)' : 'Historial'}
              </button>
            ))}
          </div>
          <div className="p-2 space-y-0.5 mt-2">
            {ORDERS.map(o => <OrderRow key={o.id} order={o} />)}
          </div>
        </div>

        {/* Right column — mesa grid + promociones */}
        <div className="flex flex-col gap-4">
          {/* Mesa grid */}
          <div className="bg-[#161622] rounded-2xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white text-sm font-semibold">Estado de mesas</p>
              <button className="text-white/35 text-xs hover:text-white/60 flex items-center gap-0.5">
                Ver todas <ChevronRight size={11} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MESAS.map(m => <MesaCell key={m.id} mesa={m} />)}
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {[
                { color: 'bg-[#FF6B35]', label: '4 ocupadas' },
                { color: 'bg-yellow-400', label: '2 por pagar' },
                { color: 'bg-violet-400', label: '1 reserva' },
                { color: 'bg-white/20', label: '5 libres' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
                  <span className="text-white/35 text-[10px]">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Promociones activas */}
          <PromocionesCard />
        </div>
      </div>

      {/* Bottom row — charts + tiempos */}
      <div className="grid grid-cols-4 gap-4">

        {/* Pedidos por hora */}
        <div className="bg-[#161622] rounded-2xl border border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white text-sm font-semibold">Pedidos por hora</p>
            <span className="text-[#FF6B35] text-xs font-medium px-2 py-0.5 rounded bg-[#FF6B35]/10">hoy</span>
          </div>
          <div className="flex items-end gap-1.5 h-20">
            {HOURLY.map(({ h, v }) => {
              const pct = v / maxH
              const isPeak = v >= 11
              return (
                <div key={h} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-white/30 text-[8px]">{v}</span>
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{
                      height: `${pct * 52}px`,
                      backgroundColor: isPeak ? '#FF6B35' : '#3A3A55',
                    }}
                  />
                  <span className="text-white/20 text-[8px]">{h}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top platos */}
        <div className="bg-[#161622] rounded-2xl border border-white/5 p-5">
          <p className="text-white text-sm font-semibold mb-4">Top platos hoy</p>
          <div className="space-y-2.5">
            {TOP_PLATOS.map((p, i) => (
              <div key={p.name} className="flex items-center gap-2.5">
                <span className="text-white/25 text-xs w-3 shrink-0">{i + 1}</span>
                <span className="text-white/70 text-xs flex-1 truncate">{p.name}</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(p.count / p.max) * 100}%`,
                        backgroundColor: i === 0 ? '#FF6B35' : '#3A3A55',
                      }}
                    />
                  </div>
                  <span className="text-white/30 text-[10px] w-4 text-right">{p.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NPS */}
        <div className="bg-[#161622] rounded-2xl border border-white/5 p-5">
          <p className="text-white text-sm font-semibold mb-3">NPS · satisfacción</p>
          <div className="flex items-center justify-center my-2">
            <div className="text-center">
              <p className="text-5xl font-bold" style={{ color: '#34D399', fontFamily: 'var(--font-dm-mono)' }}>
                74
              </p>
              <p className="text-white/30 text-xs mt-1">Net Promoter Score</p>
            </div>
          </div>
          {/* Bar */}
          <div className="flex rounded-full overflow-hidden h-2 mt-3">
            <div className="bg-emerald-400" style={{ width: '70%' }} />
            <div className="bg-yellow-400/60" style={{ width: '20%' }} />
            <div className="bg-red-400/50" style={{ width: '10%' }} />
          </div>
          <div className="flex justify-between mt-1.5">
            {[['70%', 'promotores', 'text-emerald-400'], ['20%', 'neutros', 'text-yellow-400/60'], ['10%', 'detrac.', 'text-red-400/60']].map(([pct, label, cls]) => (
              <span key={label} className={`text-[9px] ${cls}`}>{pct} {label}</span>
            ))}
          </div>
          {/* Quote */}
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-white/30 text-[10px] leading-relaxed italic">
              "El salmón estaba perfecto, volveré el viernes" — Mesa 6, hace 1h
            </p>
          </div>
        </div>

        {/* Tiempos operacionales */}
        <TiemposPanel />
      </div>
    </div>
  )
}
