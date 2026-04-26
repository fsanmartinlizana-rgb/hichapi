'use client'

/**
 * ActivationFunnel — visualización del funnel de onboarding de restaurantes.
 *
 * Pega contra `GET /api/admin/funnel?days=N` y muestra cada etapa con
 * barra horizontal proporcional al máximo (registered).
 *
 * Etapas:
 *   1. Se registró
 *   2. Cargó carta
 *   3. Generó QR de mesa
 *   4. Tuvo primer pedido pagado
 *
 * El "drop-off" entre etapas se muestra a la derecha en rojo cuando es
 * mayor a 30%.
 */

import { useEffect, useState } from 'react'
import { TrendingDown, Users, Utensils, QrCode, DollarSign, RefreshCw } from 'lucide-react'

interface FunnelData {
  period_days: number
  stages: {
    registered:       number
    with_menu:        number
    with_qr:          number
    first_order_paid: number
  }
  stage_pct: {
    with_menu:        number
    with_qr:          number
    first_order_paid: number
  }
  drop_off: {
    menu:  number
    qr:    number
    order: number
  }
}

interface Props {
  adminSecret: string
  days?: number
}

export default function ActivationFunnel({ adminSecret, days = 30 }: Props) {
  const [data, setData] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch(`/api/admin/funnel?days=${days}`, {
        headers: { 'x-admin-secret': adminSecret },
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setErr(j.error ?? 'Error cargando funnel')
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
      <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <RefreshCw size={14} className="animate-spin" /> Cargando funnel…
        </div>
      </div>
    )
  }
  if (err) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-red-300 text-sm">Funnel: {err}</p>
      </div>
    )
  }
  if (!data) return null

  const { stages, stage_pct, drop_off } = data
  const max = Math.max(stages.registered, 1)

  const rows = [
    {
      key: 'registered',
      icon: Users,
      label: 'Se registró',
      value: stages.registered,
      pct: 100,
      drop: null,
    },
    {
      key: 'menu',
      icon: Utensils,
      label: 'Cargó carta',
      value: stages.with_menu,
      pct: stage_pct.with_menu,
      drop: drop_off.menu,
    },
    {
      key: 'qr',
      icon: QrCode,
      label: 'Generó QR',
      value: stages.with_qr,
      pct: stage_pct.with_qr,
      drop: drop_off.qr,
    },
    {
      key: 'order',
      icon: DollarSign,
      label: 'Primer pedido pagado',
      value: stages.first_order_paid,
      pct: stage_pct.first_order_paid,
      drop: drop_off.order,
    },
  ]

  return (
    <section className="rounded-2xl border border-white/8 bg-white/3 p-5">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-bold text-lg">Funnel de activación</h2>
          <p className="text-white/40 text-xs">
            Restaurantes registrados últimos {data.period_days} días
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
          aria-label="Refrescar funnel"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refrescar
        </button>
      </header>

      {stages.registered === 0 ? (
        <p className="text-white/30 text-sm py-6 text-center">
          Sin restaurantes registrados en este período.
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row, i) => {
            const Icon = row.icon
            const widthPct = Math.max(2, Math.round((row.value / max) * 100))
            const isLow = row.pct < 50 && i > 0 // primer drop-off severo
            return (
              <div key={row.key} className="flex items-center gap-3">
                {/* Label */}
                <div className="flex items-center gap-2 w-44 shrink-0">
                  <Icon size={14} className="text-[#FF6B35]" />
                  <span className="text-white/85 text-xs font-semibold">{row.label}</span>
                </div>
                {/* Bar */}
                <div className="flex-1 relative h-7 rounded-md bg-white/5 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 transition-all duration-500 rounded-md"
                    style={{
                      width: `${widthPct}%`,
                      background: isLow
                        ? 'linear-gradient(90deg, rgba(239,68,68,0.6), rgba(239,68,68,0.4))'
                        : 'linear-gradient(90deg, #FF6B35, #FF8C5A)',
                    }}
                  />
                  <div className="relative h-full flex items-center px-2.5">
                    <span className="text-white text-xs font-bold font-mono">{row.value}</span>
                    {i > 0 && (
                      <span className="text-white/70 text-[10px] ml-1.5">({row.pct}%)</span>
                    )}
                  </div>
                </div>
                {/* Drop-off */}
                <div className="w-20 shrink-0 text-right">
                  {row.drop != null && row.drop > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-red-300 font-semibold">
                      <TrendingDown size={10} /> -{row.drop}
                    </span>
                  ) : (
                    <span className="text-white/15 text-[11px]">—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
