'use client'

/**
 * PlanUpgrades — bar chart semanal de upgrades/downgrades + tabla de eventos.
 *
 * Pega contra `GET /api/admin/upgrades?weeks=8`. Si la migration 062 no está
 * aplicada, muestra estado vacío con mensaje claro (no rompe el dashboard).
 *
 * Sprint 4.1.
 */

import { useEffect, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, Database } from 'lucide-react'

type Kind = 'upgrade' | 'downgrade' | 'unknown'

interface WeekBucket {
  week_start: string
  upgrades:   number
  downgrades: number
}

interface Event {
  id:               string
  restaurant_id:    string
  restaurant_name:  string | null
  restaurant_slug:  string | null
  old_plan:         string | null
  new_plan:         string | null
  kind:             Kind
  changed_at:       string
}

interface ApiResponse {
  period_weeks:      number
  migration_pending: boolean
  note?:             string
  totals:            { upgrades: number; downgrades: number }
  by_week:           WeekBucket[]
  events:            Event[]
}

const PLAN_STYLE: Record<string, string> = {
  free:       'bg-white/8 text-white/60 border border-white/10',
  starter:    'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  pro:        'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  enterprise: 'bg-violet-500/15 text-violet-400 border border-violet-500/30',
}

function PlanPill({ plan }: { plan: string | null }) {
  const v = plan ?? 'free'
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${PLAN_STYLE[v] ?? PLAN_STYLE.free}`}>
      {v}
    </span>
  )
}

interface Props {
  adminSecret: string
  weeks?:      number
}

export default function PlanUpgrades({ adminSecret, weeks = 8 }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch(`/api/admin/upgrades?weeks=${weeks}`, {
        headers: { 'x-admin-secret': adminSecret },
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setErr(j.error ?? 'Error cargando upgrades')
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
  }, [adminSecret, weeks])

  if (!data && loading) {
    return (
      <section className="rounded-2xl border border-white/8 bg-white/3 p-6">
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <RefreshCw size={14} className="animate-spin" /> Cargando upgrades…
        </div>
      </section>
    )
  }
  if (err) {
    return (
      <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-red-300 text-sm">Upgrades: {err}</p>
      </section>
    )
  }
  if (!data) return null

  // Si la migration 062 no se aplicó, mostramos hint y nada más
  if (data.migration_pending) {
    return (
      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-5">
        <div className="flex items-start gap-3">
          <Database size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-white font-bold text-base mb-1">Upgrades de plan</h2>
            <p className="text-amber-200 text-sm leading-relaxed">
              {data.note ?? 'Migration pendiente.'}
            </p>
            <p className="text-amber-300/70 text-xs mt-2 font-mono">
              Aplicá <code className="bg-black/30 px-1.5 py-0.5 rounded">supabase/migrations/20260427_062_restaurant_audit.sql</code> en el SQL Editor de Supabase.
            </p>
          </div>
        </div>
      </section>
    )
  }

  const maxBar = Math.max(
    1,
    ...data.by_week.map(w => Math.max(w.upgrades, w.downgrades)),
  )

  return (
    <section className="rounded-2xl border border-white/8 bg-white/3 p-5">
      <header className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ArrowUpRight size={18} className="text-emerald-400" />
          <div>
            <h2 className="text-white font-bold text-lg">Upgrades de plan</h2>
            <p className="text-white/40 text-xs">Últimas {data.period_weeks} semanas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-emerald-300 text-sm font-bold">
            <ArrowUpRight size={13} />
            <span className="font-mono">{data.totals.upgrades}</span>
            <span className="text-emerald-300/60 text-[10px] font-normal ml-0.5">up</span>
          </div>
          <div className="flex items-center gap-1 text-red-300 text-sm font-bold">
            <ArrowDownRight size={13} />
            <span className="font-mono">{data.totals.downgrades}</span>
            <span className="text-red-300/60 text-[10px] font-normal ml-0.5">down</span>
          </div>
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

      {/* Bar chart por semana */}
      <div className="flex items-end gap-1.5 h-24 mb-4">
        {data.by_week.map(w => {
          const upH = (w.upgrades   / maxBar) * 100
          const dnH = (w.downgrades / maxBar) * 100
          const label = w.week_start.slice(5) // MM-DD
          return (
            <div key={w.week_start} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`Semana del ${w.week_start}: +${w.upgrades} / -${w.downgrades}`}>
              <div className="flex-1 w-full flex items-end justify-center gap-0.5">
                <div
                  className="flex-1 bg-emerald-500/70 rounded-t-sm transition-all"
                  style={{ height: `${upH}%`, minHeight: w.upgrades > 0 ? 2 : 0 }}
                />
                <div
                  className="flex-1 bg-red-500/70 rounded-t-sm transition-all"
                  style={{ height: `${dnH}%`, minHeight: w.downgrades > 0 ? 2 : 0 }}
                />
              </div>
              <span className="text-[9px] text-white/40 font-mono whitespace-nowrap">{label}</span>
            </div>
          )
        })}
      </div>

      {/* Tabla de eventos */}
      {data.events.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-4">
          Sin cambios de plan registrados en este período.
        </p>
      ) : (
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/3 border-b border-white/8">
              <tr>
                <th className="px-3 py-2 text-left text-white/40 text-[10px] font-medium uppercase tracking-wider">Restaurante</th>
                <th className="px-3 py-2 text-left text-white/40 text-[10px] font-medium uppercase tracking-wider">Cambio</th>
                <th className="px-3 py-2 text-right text-white/40 text-[10px] font-medium uppercase tracking-wider">Cuándo</th>
              </tr>
            </thead>
            <tbody>
              {data.events.slice(0, 15).map(e => (
                <tr key={e.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-white text-sm">{e.restaurant_name ?? '—'}</p>
                    {e.restaurant_slug && (
                      <p className="text-white/30 text-[10px]">/{e.restaurant_slug}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <PlanPill plan={e.old_plan} />
                      {e.kind === 'upgrade' ? (
                        <ArrowUpRight size={11} className="text-emerald-400" />
                      ) : e.kind === 'downgrade' ? (
                        <ArrowDownRight size={11} className="text-red-400" />
                      ) : (
                        <AlertCircle size={11} className="text-white/30" />
                      )}
                      <PlanPill plan={e.new_plan} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-white/60 text-xs">
                    {new Date(e.changed_at).toLocaleString('es-CL', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.events.length > 15 && (
            <p className="text-white/30 text-[11px] text-center py-2 bg-white/[0.02]">
              Mostrando 15 de {data.events.length} eventos.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
