'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Sparkles, Download, ChevronRight, AlertCircle, Lightbulb, Target, Check, X } from 'lucide-react'

// ── Mock data ─────────────────────────────────────────────────────────────────

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]

// Occupancy heatmap: 0–100%
const HEATMAP: Record<string, number[]> = {
  Lun: [20, 55, 82, 75, 30, 18, 22, 45, 78, 65, 40, 15],
  Mar: [15, 60, 88, 80, 28, 15, 20, 50, 82, 70, 45, 20],
  Mié: [18, 52, 78, 72, 25, 12, 18, 42, 75, 68, 38, 12],
  Jue: [22, 58, 85, 78, 32, 20, 25, 55, 88, 72, 48, 22],
  Vie: [25, 65, 90, 88, 42, 35, 45, 72, 92, 88, 75, 55],
  Sáb: [30, 70, 95, 92, 60, 48, 62, 80, 95, 92, 82, 65],
  Dom: [28, 65, 88, 85, 55, 40, 35, 55, 72, 65, 48, 20],
}

const DEAD_TIMES = [
  { day: 'Lunes–Jueves', range: '15:00–17:00', occupancy: 22, potential: '$85k', confidence: 0.87 },
  { day: 'Lunes–Miércoles', range: '11:00–12:00', occupancy: 18, potential: '$52k', confidence: 0.75 },
]

const WEEKLY_REVENUE = [
  { week: 'Sem 1', v: 4200 },
  { week: 'Sem 2', v: 3800 },
  { week: 'Sem 3', v: 4600 },
  { week: 'Sem 4', v: 5100 },
]

const AI_INSIGHTS = [
  {
    type: 'warning',
    icon: <AlertCircle size={14} />,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    title: 'Horario muerto identificado',
    body: 'Entre semana de 15:00–17:00 tienes 22% de ocupación promedio en las últimas 4 semanas. Son ~6 mesas vacías cada tarde.',
    action: 'Crear promoción de tarde',
  },
  {
    type: 'insight',
    icon: <Lightbulb size={14} />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    title: 'Tu mejor día es el sábado',
    body: 'El sábado genera 2.3× más revenue que el lunes. El peak es entre 19:00–21:00 con 92% de ocupación.',
    action: 'Ver analytics del sábado',
  },
  {
    type: 'opportunity',
    icon: <Target size={14} />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'El tiramisú tiene 87% de retorno',
    body: 'El 87% de quienes lo piden vuelven al restaurante. Chapi ya lo está recomendando como postre cuando detecta un plato principal.',
    action: 'Ver estadísticas del plato',
  },
]

const REPORT_TEXT = `**Martes 31 de marzo — Resumen generado por Chapi**

Fue un día sólido. Las ventas totales llegaron a $847k, un 12% más que ayer y un 8% sobre tu promedio de los últimos 30 días.

**Lo que funcionó bien:**
El lomo vetado fue el plato estrella con 18 pedidos, generando $286k solo ese ítem. Las órdenes vía Chapi representaron el 71% del total, lo que confirma que los clientes están adoptando bien el sistema.

**Área de atención:**
Tuviste 3 mesas que esperaron más de 45 minutos para recibir su pedido entre las 13:30 y 14:15. Ese fue tu peak más intenso del día y coincide con históricamente tu hora más cargada.

**Para mañana:**
Miércoles suele ser 15% más lento que martes. Considera activar la promoción de mediodía para el bloque 15:00–17:00 donde históricamente tienes capacidad ociosa.`

// ── HeatMap cell ──────────────────────────────────────────────────────────────

function HeatCell({ value }: { value: number }) {
  const opacity = value / 100
  const isDead  = value < 35
  return (
    <div
      className={`h-8 rounded flex items-center justify-center text-[9px] font-mono transition-all cursor-default
        ${isDead ? 'ring-1 ring-red-500/30' : ''}`}
      style={{ backgroundColor: `rgba(255, 107, 53, ${opacity * 0.85 + 0.05})` }}
      title={`${value}%`}
    >
      <span className={value > 50 ? 'text-white/80' : 'text-white/30'}>{value}%</span>
    </div>
  )
}

// ── PromoForm ─────────────────────────────────────────────────────────────────

type PromoType = '2x1' | 'descuento' | 'combo'

interface PromoFormProps {
  slot: typeof DEAD_TIMES[0]
  onActivate: () => void
  onCancel: () => void
}

function PromoForm({ slot, onActivate, onCancel }: PromoFormProps) {
  const [nombre, setNombre] = useState('Happy Hour de tarde')
  const [tipo, setTipo] = useState<PromoType>('descuento')
  const [descuento, setDescuento] = useState('20')
  const [horario, setHorario] = useState(`${slot.range} ${slot.day}`)
  const [desde, setDesde] = useState('2026-04-07')
  const [hasta, setHasta] = useState('2026-04-30')
  const [mensaje, setMensaje] = useState(
    `¡Aprovecha nuestro happy hour de tarde! De ${slot.range} tienes 20% de descuento en toda la carta`
  )
  const [canales, setCanales] = useState({
    mesa: true,
    espera: true,
    discovery: true,
  })

  const tipoLabels: Record<PromoType, string> = {
    '2x1': '2×1',
    descuento: 'Descuento %',
    combo: 'Combo especial',
  }

  const toggleCanal = (key: keyof typeof canales) => {
    setCanales(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="mt-2 bg-[#1A1A2E] border border-[#FF6B35]/25 rounded-xl p-4 space-y-3.5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-white text-xs font-semibold">Nueva promoción</p>
        <button onClick={onCancel} className="text-white/30 hover:text-white/60 transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Nombre */}
      <div className="space-y-1">
        <label className="text-white/40 text-[10px] font-medium uppercase tracking-wide">Nombre de la promoción</label>
        <input
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
          placeholder="Ej. Happy Hour de tarde"
        />
      </div>

      {/* Tipo */}
      <div className="space-y-1">
        <label className="text-white/40 text-[10px] font-medium uppercase tracking-wide">Tipo</label>
        <div className="flex gap-1.5">
          {(['2x1', 'descuento', 'combo'] as PromoType[]).map(t => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all
                ${tipo === t
                  ? 'bg-[#FF6B35] border-[#FF6B35] text-white'
                  : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                }`}
            >
              {tipoLabels[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Descuento */}
      {tipo !== 'combo' && (
        <div className="space-y-1">
          <label className="text-white/40 text-[10px] font-medium uppercase tracking-wide">
            {tipo === '2x1' ? 'Precio mínimo aplicable ($)' : 'Descuento (%)'}
          </label>
          <input
            value={descuento}
            onChange={e => setDescuento(e.target.value)}
            type="number"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
            placeholder={tipo === '2x1' ? '0' : '20'}
          />
        </div>
      )}

      {/* Horario */}
      <div className="space-y-1">
        <label className="text-white/40 text-[10px] font-medium uppercase tracking-wide">Horario aplicable</label>
        <input
          value={horario}
          onChange={e => setHorario(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
        />
      </div>

      {/* Vigencia */}
      <div className="space-y-1">
        <label className="text-white/40 text-[10px] font-medium uppercase tracking-wide">Vigencia</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-0.5">
            <p className="text-white/25 text-[9px]">Desde</p>
            <input
              type="date"
              value={desde}
              onChange={e => setDesde(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-[10px] focus:outline-none focus:border-[#FF6B35]/50 transition-colors [color-scheme:dark]"
            />
          </div>
          <span className="text-white/20 text-xs mt-4">→</span>
          <div className="flex-1 space-y-0.5">
            <p className="text-white/25 text-[9px]">Hasta</p>
            <input
              type="date"
              value={hasta}
              onChange={e => setHasta(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-[10px] focus:outline-none focus:border-[#FF6B35]/50 transition-colors [color-scheme:dark]"
            />
          </div>
        </div>
      </div>

      {/* Mensaje para Chapi */}
      <div className="space-y-1">
        <label className="text-white/40 text-[10px] font-medium uppercase tracking-wide">Mensaje para Chapi</label>
        <textarea
          value={mensaje}
          onChange={e => setMensaje(e.target.value)}
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors resize-none leading-relaxed"
          placeholder="Lo que Chapi dirá cuando recomiende esta promo..."
        />
        <p className="text-white/20 text-[9px]">Chapi usará este mensaje cuando recomiende la promo a tus clientes.</p>
      </div>

      {/* Canal */}
      <div className="space-y-1.5">
        <label className="text-white/40 text-[10px] font-medium uppercase tracking-wide">Canal</label>
        <div className="flex flex-col gap-1.5">
          {[
            { key: 'mesa' as const, label: 'Chapi en mesa' },
            { key: 'espera' as const, label: 'Lista de espera' },
            { key: 'discovery' as const, label: 'HiChapi Discovery' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer group">
              <div
                onClick={() => toggleCanal(key)}
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all shrink-0
                  ${canales[key]
                    ? 'bg-[#FF6B35] border-[#FF6B35]'
                    : 'bg-white/5 border-white/15 group-hover:border-white/25'
                  }`}
              >
                {canales[key] && <Check size={8} className="text-white" strokeWidth={3} />}
              </div>
              <span
                onClick={() => toggleCanal(key)}
                className="text-white/55 text-[10px] group-hover:text-white/70 transition-colors"
              >
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onActivate}
          className="flex-1 py-2 rounded-lg bg-[#FF6B35] text-white text-[11px] font-semibold hover:bg-[#e85d2a] transition-colors"
        >
          Activar promoción
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-lg border border-white/10 text-white/40 text-[11px] hover:border-white/20 hover:text-white/60 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportePage() {
  const [period, setPeriod] = useState<'dia' | 'semana' | 'mes'>('dia')
  const [expandedPromo, setExpandedPromo] = useState<string | null>(null)
  const [activePromos, setActivePromos] = useState<Set<string>>(new Set())

  const maxRev = Math.max(...WEEKLY_REVENUE.map(r => r.v))

  const handleActivate = (key: string) => {
    setActivePromos(prev => new Set([...prev, key]))
    setExpandedPromo(null)
  }

  return (
    <div className="p-6 space-y-6">

      {/* Demo banner — los datos de esta página son mock mientras conectamos
          queries reales. Se reemplaza por el dashboard unificado en Sprint 3. */}
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
        <AlertCircle size={16} className="text-amber-400 shrink-0" />
        <p className="text-amber-200/90 text-xs">
          <span className="font-semibold">Modo demo.</span> Los datos de esta página son de muestra. Pronto vas a ver reportes reales conectados a tu operación.
        </p>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Reporte del día</h1>
          <p className="text-white/40 text-sm mt-0.5">Generado por Chapi · Martes 31 mar · 23:58</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white/3 border border-white/6 rounded-xl p-1">
            {(['dia', 'semana', 'mes'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all
                  ${period === p ? 'bg-[#FF6B35] text-white font-medium' : 'text-white/35 hover:text-white/60'}`}>
                {p === 'dia' ? 'Hoy' : p === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-white/40 text-xs hover:border-white/20 transition-colors">
            <Download size={12} /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">

        {/* Left: AI report + insights */}
        <div className="col-span-2 space-y-5">

          {/* AI narrative report */}
          <div className="bg-[#161622] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-[#FF6B35]/20 flex items-center justify-center">
                <Sparkles size={12} className="text-[#FF6B35]" />
              </div>
              <p className="text-white font-semibold text-sm">Análisis de Chapi</p>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">Claude Sonnet</span>
            </div>
            <div className="space-y-3 text-white/60 text-sm leading-relaxed">
              {REPORT_TEXT.split('\n\n').map((para, i) => (
                <p key={i} className={para.startsWith('**') && para.endsWith('**') ? 'text-white/80 font-semibold' : ''}>
                  {para.replace(/\*\*/g, '')}
                </p>
              ))}
            </div>
          </div>

          {/* Heatmap */}
          <div className="bg-[#161622] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-semibold text-sm">Ocupación por día y hora</p>
                <p className="text-white/25 text-[10px] mt-0.5">Promedio de los últimos 7 días</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-white/30">
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#FF6B35]/10 inline-block" />0%</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#FF6B35]/60 inline-block" />60%</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-[#FF6B35] inline-block" />100%</span>
                <span className="flex items-center gap-1 ml-1"><span className="w-3 h-2 rounded-sm bg-transparent ring-1 ring-red-500/50 inline-block" />horario muerto</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div style={{ minWidth: 560 }}>
                {/* Hour labels */}
                <div className="flex gap-1 mb-1 pl-10">
                  {HOURS.map(h => (
                    <div key={h} className="flex-1 text-center text-[9px] text-white/20">{h}h</div>
                  ))}
                </div>
                {/* Rows */}
                {DAYS.map(day => (
                  <div key={day} className="flex items-center gap-1 mb-1">
                    <span className="w-9 text-[10px] text-white/30 shrink-0">{day}</span>
                    {HEATMAP[day].map((v, i) => (
                      <div key={i} className="flex-1"><HeatCell value={v} /></div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Weekly revenue bar */}
          <div className="bg-[#161622] border border-white/5 rounded-2xl p-5">
            <p className="text-white font-semibold text-sm mb-4">Revenue últimas 4 semanas</p>
            <div className="flex items-end gap-4 h-24">
              {WEEKLY_REVENUE.map(({ week, v }) => (
                <div key={week} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-white/40 text-xs font-mono">${(v/1000).toFixed(0)}k</span>
                  <div className="w-full rounded-t-lg" style={{ height: `${(v / maxRev) * 64}px`, backgroundColor: '#FF6B35' }} />
                  <span className="text-white/25 text-[10px]">{week}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5">
              <TrendingUp size={13} className="text-emerald-400" />
              <span className="text-emerald-400 text-xs font-semibold">+21% vs hace 4 semanas</span>
            </div>
          </div>
        </div>

        {/* Right: insights + dead times */}
        <div className="space-y-4">

          {/* Chapi insights */}
          <div className="bg-[#161622] border border-white/5 rounded-2xl p-4">
            <p className="text-white font-semibold text-sm mb-3">Chapi recomienda</p>
            <div className="space-y-3">
              {AI_INSIGHTS.map((insight, i) => (
                <div key={i} className={`border rounded-xl p-3.5 space-y-2 ${insight.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className={insight.color}>{insight.icon}</span>
                    <p className="text-white text-xs font-semibold">{insight.title}</p>
                  </div>
                  <p className="text-white/50 text-xs leading-relaxed">{insight.body}</p>
                  <button className={`flex items-center gap-1 text-[10px] font-semibold ${insight.color}`}>
                    {insight.action} <ChevronRight size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Dead times */}
          <div className="bg-[#161622] border border-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">Horarios muertos</p>
              <span className="text-[10px] text-white/25">Últimas 4 sem.</span>
            </div>
            <div className="space-y-3">
              {DEAD_TIMES.map((slot, i) => {
                const key = String(i)
                const isActive = activePromos.has(key)
                const isExpanded = expandedPromo === key

                return (
                  <div key={i}>
                    <div className="bg-red-500/6 border border-red-500/15 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/70 text-xs font-medium">{slot.day}</p>
                          <p className="text-white/40 text-[10px]">{slot.range}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-red-400 text-sm font-bold font-mono">{slot.occupancy}%</p>
                          <p className="text-white/25 text-[9px]">ocupación</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/30 text-[10px]">Potencial sin explotar: <span className="text-emerald-400/80">{slot.potential}/semana</span></span>
                        <div className="w-12 h-1 rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-emerald-400/60" style={{ width: `${slot.confidence * 100}%` }} />
                        </div>
                      </div>

                      {isActive ? (
                        /* Success state */
                        <div className="w-full py-1.5 px-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center gap-1.5">
                          <Check size={10} className="text-emerald-400" strokeWidth={2.5} />
                          <span className="text-emerald-400 text-[10px] font-semibold">Promoción activa — Chapi ya la está ofreciendo</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => setExpandedPromo(isExpanded ? null : key)}
                          className="w-full py-1.5 rounded-lg bg-[#FF6B35]/15 text-[#FF6B35] text-[10px] font-semibold border border-[#FF6B35]/20 hover:bg-[#FF6B35]/25 transition-colors"
                        >
                          {isExpanded ? 'Ocultar formulario ↑' : 'Crear promoción →'}
                        </button>
                      )}
                    </div>

                    {/* Inline promo form */}
                    {isExpanded && !isActive && (
                      <PromoForm
                        slot={slot}
                        onActivate={() => handleActivate(key)}
                        onCancel={() => setExpandedPromo(null)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
