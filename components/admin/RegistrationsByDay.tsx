'use client'

/**
 * RegistrationsByDay — gráfico de área de nuevos restaurantes por día.
 *
 * Pega contra `GET /api/admin/registrations-by-day?days=N`. Renderiza
 * un mini-area chart en SVG inline (sin recharts — bundle delgado).
 *
 * Sprint 4.3.
 */

import { useEffect, useState } from 'react'
import { TrendingUp, Calendar, RefreshCw } from 'lucide-react'

interface Series {
  date:  string
  count: number
}

interface ApiResponse {
  period_days: number
  total:       number
  max_per_day: number
  avg_per_day: number
  series:      Series[]
}

interface Props {
  adminSecret: string
  days?:       number
}

export default function RegistrationsByDay({ adminSecret, days = 30 }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch(`/api/admin/registrations-by-day?days=${days}`, {
        headers: { 'x-admin-secret': adminSecret },
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setErr(j.error ?? 'Error cargando registraciones')
        return
      }
      setData(await r.json())
    } catch {
      setErr('Error de red')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (adminSecret) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSecret, days])

  if (!data && loading) {
    return (
      <section className="rounded-2xl border border-white/8 bg-white/3 p-6">
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <RefreshCw size={14} className="animate-spin" /> Cargando registraciones…
        </div>
      </section>
    )
  }
  if (err) {
    return (
      <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-red-300 text-sm">Registraciones: {err}</p>
      </section>
    )
  }
  if (!data) return null

  const { series, max_per_day, total, avg_per_day, period_days } = data

  // Geometría del SVG
  const W = 760
  const H = 110
  const PAD_X = 8
  const PAD_Y = 12
  const innerW = W - PAD_X * 2
  const innerH = H - PAD_Y * 2
  const stepX = series.length > 1 ? innerW / (series.length - 1) : innerW
  const yMax = Math.max(max_per_day, 1)

  const points = series.map((d, i) => {
    const x = PAD_X + i * stepX
    const y = PAD_Y + innerH - (d.count / yMax) * innerH
    return { x, y, d }
  })

  // Path línea
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  // Path área (cierra al baseline)
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(PAD_Y + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PAD_Y + innerH).toFixed(1)} Z`
    : ''

  return (
    <section className="rounded-2xl border border-white/8 bg-white/3 p-5">
      <header className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-[#FF6B35]" />
          <div>
            <h2 className="text-white font-bold text-lg">Nuevos restaurantes</h2>
            <p className="text-white/40 text-xs">Últimos {period_days} días</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Stat label="Total"   value={total.toString()} />
          <Stat label="Prom/d"  value={avg_per_day.toString()} />
          <Stat label="Máx/d"   value={max_per_day.toString()} />
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Refrescar"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {total === 0 ? (
        <div className="flex items-center justify-center gap-2 text-white/30 text-sm py-8">
          <Calendar size={14} /> Sin registraciones en este período.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[110px]"
          preserveAspectRatio="none"
          role="img"
          aria-label="Gráfico de nuevos restaurantes por día"
        >
          <defs>
            <linearGradient id="reg-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#FF6B35" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#FF6B35" stopOpacity="0" />
            </linearGradient>
          </defs>
          {areaPath && <path d={areaPath} fill="url(#reg-gradient)" />}
          {linePath && (
            <path d={linePath} fill="none" stroke="#FF6B35" strokeWidth="1.5" strokeLinejoin="round" />
          )}
          {points.map((p, i) => (
            p.d.count > 0 && (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="2.5"
                fill="#FF6B35"
              >
                <title>{`${p.d.date}: ${p.d.count} ${p.d.count === 1 ? 'registro' : 'registros'}`}</title>
              </circle>
            )
          ))}
        </svg>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[9px] text-white/40 uppercase tracking-wider leading-none">{label}</div>
      <div className="text-white font-bold font-mono text-sm leading-none mt-0.5">{value}</div>
    </div>
  )
}
