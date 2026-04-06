'use client'

import { useState } from 'react'
import { TrendingUp, Users, Clock, Star, ArrowUpRight, ArrowDownRight } from 'lucide-react'

const PERIODS = ['7 días', '30 días', '3 meses', '12 meses']

const KPI_CARDS = [
  { label: 'Revenue total',       value: '$18.4M', delta: '+23%', up: true,  sub: 'vs período anterior' },
  { label: 'Covers totales',      value: '1,842',  delta: '+17%', up: true,  sub: 'personas atendidas' },
  { label: 'Ticket promedio',     value: '$17.8k',  delta: '+5%',  up: true,  sub: 'por persona' },
  { label: 'NPS promedio',        value: '72',     delta: '+3 pts', up: true, sub: 'satisfacción' },
  { label: 'Tiempo mesa promedio',value: '58 min',  delta: '-4 min', up: true,  sub: 'eficiencia' },
  { label: 'Pedidos vía Chapi',   value: '68%',    delta: '+12%', up: true,  sub: 'adopción digital' },
]

const TOP_ITEMS = [
  { name: 'Lomo vetado',     rev: 520, count: 312, trend: 8  },
  { name: 'Pasta arrabiata', rev: 380, count: 280, trend: 3  },
  { name: 'Salmón grillado', rev: 430, count: 245, trend: -2 },
  { name: 'Tiramisú',        rev: 210, count: 290, trend: 15 },
  { name: 'Ensalada César',  rev: 160, count: 178, trend: 5  },
  { name: 'Pisco sour',      rev: 140, count: 224, trend: 22 },
]

const MONTHLY = [
  { m: 'Oct', v: 14200 }, { m: 'Nov', v: 15800 }, { m: 'Dic', v: 22400 },
  { m: 'Ene', v: 11200 }, { m: 'Feb', v: 13600 }, { m: 'Mar', v: 18400 },
]

const DAYS_PERF = [
  { d: 'Lun', v: 65 }, { d: 'Mar', v: 72 }, { d: 'Mié', v: 61 },
  { d: 'Jue', v: 78 }, { d: 'Vie', v: 92 }, { d: 'Sáb', v: 100 }, { d: 'Dom', v: 85 },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30 días')

  const maxMonthly = Math.max(...MONTHLY.map(m => m.v))
  const maxDay     = Math.max(...DAYS_PERF.map(d => d.v))
  const maxItem    = Math.max(...TOP_ITEMS.map(i => i.rev))

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Analytics</h1>
          <p className="text-white/40 text-sm mt-0.5">Datos agregados de tu restaurante</p>
        </div>
        <div className="flex gap-1 bg-white/3 border border-white/6 rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all
                ${period === p ? 'bg-[#FF6B35] text-white font-medium' : 'text-white/35 hover:text-white/60'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {KPI_CARDS.map(k => (
          <div key={k.label} className="bg-[#161622] border border-white/5 rounded-2xl p-4">
            <p className="text-white/40 text-xs mb-2">{k.label}</p>
            <p className="text-white text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-dm-mono)' }}>{k.value}</p>
            <div className="flex items-center gap-1.5">
              {k.up ? <ArrowUpRight size={11} className="text-emerald-400" /> : <ArrowDownRight size={11} className="text-red-400" />}
              <span className={`text-xs font-medium ${k.up ? 'text-emerald-400' : 'text-red-400'}`}>{k.delta}</span>
              <span className="text-white/25 text-xs">{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">

        {/* Revenue chart */}
        <div className="col-span-2 bg-[#161622] border border-white/5 rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-4">Revenue mensual (CLP miles)</p>
          <div className="flex items-end gap-3 h-32">
            {MONTHLY.map(({ m, v }) => (
              <div key={m} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-white/40 text-[10px] font-mono">{(v/1000).toFixed(0)}M</span>
                <div className="w-full rounded-t-lg transition-all hover:opacity-90"
                  style={{ height: `${(v / maxMonthly) * 96}px`, backgroundColor: m === 'Mar' ? '#FF6B35' : '#3A3A55' }} />
                <span className="text-white/25 text-[10px]">{m}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
            <TrendingUp size={13} className="text-emerald-400" />
            <span className="text-emerald-400 text-xs font-semibold">+30% vs Oct–Dic</span>
            <span className="text-white/25 text-xs">· Tendencia positiva sostenida</span>
          </div>
        </div>

        {/* Day of week */}
        <div className="bg-[#161622] border border-white/5 rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-4">Rendimiento por día</p>
          <div className="space-y-2">
            {DAYS_PERF.map(({ d, v }) => (
              <div key={d} className="flex items-center gap-3">
                <span className="text-white/40 text-xs w-6 shrink-0">{d}</span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${v}%`, backgroundColor: v === maxDay ? '#FF6B35' : v > 75 ? '#FF6B35AA' : '#3A3A55' }} />
                </div>
                <span className="text-white/30 text-[10px] font-mono w-7 text-right">{v}%</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-white/5">
            <p className="text-white/30 text-[10px]">
              Sábado es tu día pico. Viernes tu mejor día entre semana.
            </p>
          </div>
        </div>

        {/* Top items */}
        <div className="col-span-3 bg-[#161622] border border-white/5 rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-4">Top platos por revenue</p>
          <div className="grid grid-cols-3 gap-4">
            {TOP_ITEMS.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="text-white/20 text-sm font-bold w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${(item.rev / maxItem) * 100}%`, backgroundColor: i === 0 ? '#FF6B35' : '#4A4A6A' }} />
                    </div>
                    <span className="text-white/30 text-[10px] font-mono shrink-0">${item.rev}k</span>
                  </div>
                </div>
                <div className={`flex items-center gap-0.5 text-[10px] font-semibold shrink-0 ${item.trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {item.trend > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {Math.abs(item.trend)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
