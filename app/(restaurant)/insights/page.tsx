'use client'

import { useState } from 'react'
import {
  Sparkles, TrendingUp, Users, Clock, Star, Zap, RefreshCw,
  ChevronRight, ArrowUpRight, MessageSquare, ShoppingCart, Heart,
} from 'lucide-react'

// ── Mock data ─────────────────────────────────────────────────────────────────

const CHAPI_STATS = [
  { label: 'Conversaciones totales', value: '1,284', sub: 'este mes', icon: <MessageSquare size={14} />, color: '#60A5FA' },
  { label: 'Pedidos generados',      value: '847',   sub: '66% de conv.',  icon: <ShoppingCart size={14} />, color: '#FF6B35' },
  { label: 'Cross-sells aceptados',  value: '312',   sub: '37% aceptación', icon: <Zap size={14} />,         color: '#FBBF24' },
  { label: 'NPS atribuido a Chapi',  value: '+8 pts',sub: 'vs sin Chapi',   icon: <Heart size={14} />,       color: '#34D399' },
]

const INTERACTIONS = [
  { text: '"¿Tienen algo sin gluten?"',         count: 142, action: 'Salmón grillado recomendado', conversion: 78 },
  { text: '"¿Qué me recomiendas?"',             count: 298, action: 'Lomo vetado / pasta arrabiata', conversion: 65 },
  { text: '"Quiero algo para compartir"',        count: 87,  action: 'Tabla de quesos recomendada', conversion: 82 },
  { text: '"La cuenta, por favor"',             count: 215, action: 'Tiramisú ofrecido antes',     conversion: 41 },
  { text: '"¿Tienen opciones veganas?"',         count: 63,  action: 'Pasta arrabiata + gazpacho',  conversion: 71 },
]

const UPSELL_PERFORMANCE = [
  { item: 'Tiramisú (postre)', offered: 215, accepted: 89,  revenue: 614100 },
  { item: 'Copa de vino',      offered: 178, accepted: 67,  revenue: 402000 },
  { item: 'Tabla de quesos',   offered: 134, accepted: 110, revenue: 1529000 },
  { item: 'Pisco sour',        offered: 92,  accepted: 45,  revenue: 265500 },
]

const SENTIMENT = [
  { label: 'Comida', score: 4.6, comments: ['Excelente sazón', 'El lomo estaba perfecto', 'Porciones generosas'] },
  { label: 'Servicio', score: 4.3, comments: ['Chapi muy útil', 'Rápido y amable', 'Buena atención'] },
  { label: 'Precio', score: 4.1, comments: ['Buena relación precio-calidad', 'Accesible para el barrio'] },
  { label: 'Ambiente', score: 4.4, comments: ['Acogedor', 'Buen ruido ambiente', 'Iluminación perfecta'] },
]

const PREDICTIONS = [
  {
    icon: <TrendingUp size={14} />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'Viernes próximo: peak proyectado',
    body: 'Basado en los últimos 4 viernes, espera 94–102% de ocupación entre 19:30–21:30. Recomendamos activar a 2 garzones adicionales.',
  },
  {
    icon: <Zap size={14} />,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    title: 'El gazpacho pierde tracción',
    body: 'Las menciones del gazpacho bajaron 40% vs el mes pasado. Considera ajustar el precio o actualizar la descripción en la carta.',
  },
  {
    icon: <Users size={14} />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    title: 'Clientes recurrentes +22%',
    body: '3 de cada 10 clientes este mes ya habían visitado antes. El tiramisú tiene la mayor tasa de retorno (87% vuelve en 30 días).',
  },
  {
    icon: <Star size={14} />,
    color: 'text-[#FF6B35]',
    bg: 'bg-[#FF6B35]/10 border-[#FF6B35]/20',
    title: 'Oportunidad: menú mediodía',
    body: 'Chapi detectó 28 conversaciones pidiendo "almuerzo rápido" este mes. No tienes un combo de mediodía — podrías capturar ese segmento.',
  },
]

function StarBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="relative w-4 h-4">
          <div className="absolute inset-0 text-white/10 text-xs">★</div>
          <div className="absolute inset-0 overflow-hidden text-yellow-400 text-xs"
            style={{ width: `${Math.min(100, Math.max(0, (score - i + 1) * 100))}%` }}>★</div>
        </div>
      ))}
      <span className="text-white/60 text-xs ml-1">{score.toFixed(1)}</span>
    </div>
  )
}

export default function InsightsPage() {
  const [activeTab, setActiveTab] = useState<'chapi' | 'clientes' | 'predicciones'>('chapi')

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Chapi Insights</h1>
          <p className="text-white/40 text-sm mt-0.5">Inteligencia generada por tus interacciones</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/25 text-xs flex items-center gap-1.5">
            <RefreshCw size={11} /> Actualizado hace 2 horas
          </span>
          <div className="flex gap-1 bg-white/3 border border-white/6 rounded-xl p-1">
            {(['chapi', 'clientes', 'predicciones'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all
                  ${activeTab === t ? 'bg-[#FF6B35] text-white font-medium' : 'text-white/35 hover:text-white/60'}`}>
                {t === 'chapi' ? 'Chapi' : t === 'clientes' ? 'Clientes' : 'Predicciones'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chapi tab */}
      {activeTab === 'chapi' && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {CHAPI_STATS.map(s => (
              <div key={s.label} className="bg-[#161622] border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: s.color + '20', color: s.color }}>
                    {s.icon}
                  </div>
                </div>
                <p className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>{s.value}</p>
                <p className="text-white/35 text-xs mt-0.5">{s.label}</p>
                <p className="text-white/20 text-[10px]">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Top interactions */}
            <div className="bg-[#161622] border border-white/5 rounded-2xl p-5">
              <p className="text-white font-semibold text-sm mb-4">Frases más frecuentes</p>
              <div className="space-y-3">
                {INTERACTIONS.map((i, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-white/70 text-xs italic">{i.text}</p>
                      <span className="text-white/25 text-[10px] shrink-0 ml-2">{i.count}×</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#FF6B35]/60"
                          style={{ width: `${i.conversion}%` }} />
                      </div>
                      <span className="text-[#FF6B35]/70 text-[9px] font-mono shrink-0">{i.conversion}% conv.</span>
                    </div>
                    <p className="text-white/25 text-[9px]">→ {i.action}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Upsell performance */}
            <div className="bg-[#161622] border border-white/5 rounded-2xl p-5">
              <p className="text-white font-semibold text-sm mb-4">Cross-sells de Chapi</p>
              <div className="space-y-4">
                {UPSELL_PERFORMANCE.map(u => {
                  const rate = Math.round((u.accepted / u.offered) * 100)
                  return (
                    <div key={u.item} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-white/70 text-sm">{u.item}</p>
                        <span className="text-emerald-400 text-xs font-semibold">+${(u.revenue / 1000).toFixed(0)}k</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${rate}%`, backgroundColor: rate > 70 ? '#34D399' : rate > 40 ? '#FBBF24' : '#FF6B35' }} />
                        </div>
                        <span className="text-white/40 text-[10px] font-mono w-10 text-right shrink-0">
                          {u.accepted}/{u.offered}
                        </span>
                        <span className="text-white/50 text-[10px] w-8 shrink-0">{rate}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clientes tab */}
      {activeTab === 'clientes' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            {/* Sentiment */}
            <div className="bg-[#161622] border border-white/5 rounded-2xl p-5">
              <p className="text-white font-semibold text-sm mb-4">Análisis de sentimiento (NPS)</p>
              <div className="space-y-4">
                {SENTIMENT.map(s => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-white/70 text-sm">{s.label}</p>
                      <StarBar score={s.score} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {s.comments.map(c => (
                        <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-white/35">
                          "{c}"
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Retention */}
            <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
              <p className="text-white font-semibold text-sm">Retención de clientes</p>
              <div className="flex items-center justify-center py-4">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#FF6B35" strokeWidth="3"
                      strokeDasharray={`${30 * 2.51} ${100 * 2.51}`} strokeLinecap="round" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#34D399" strokeWidth="3"
                      strokeDasharray={`${22 * 2.51} ${100 * 2.51}`} strokeLinecap="round"
                      strokeDashoffset={`-${30 * 2.51}`} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-white font-bold text-xl">52%</p>
                    <p className="text-white/30 text-[9px]">retención</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Primera visita',    pct: 48, color: 'bg-white/20' },
                  { label: 'Volvieron 1 vez',   pct: 30, color: 'bg-[#FF6B35]' },
                  { label: 'Clientes frecuentes', pct: 22, color: 'bg-emerald-400' },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.color} shrink-0`} />
                    <span className="text-white/50 text-xs flex-1">{s.label}</span>
                    <span className="text-white/40 text-xs font-mono">{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Predicciones tab */}
      {activeTab === 'predicciones' && (
        <div className="space-y-4">
          <p className="text-white/35 text-sm">Basado en historial de las últimas 8 semanas · Modelo Claude Sonnet</p>
          <div className="grid grid-cols-2 gap-4">
            {PREDICTIONS.map((p, i) => (
              <div key={i} className={`border rounded-2xl p-5 space-y-3 ${p.bg}`}>
                <div className="flex items-center gap-2">
                  <span className={p.color}>{p.icon}</span>
                  <p className="text-white font-semibold text-sm">{p.title}</p>
                </div>
                <p className="text-white/55 text-sm leading-relaxed">{p.body}</p>
                <button className={`flex items-center gap-1 text-xs font-semibold ${p.color}`}>
                  Ver detalle <ChevronRight size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
