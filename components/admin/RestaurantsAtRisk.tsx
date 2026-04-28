'use client'

/**
 * RestaurantsAtRisk — tabla de restaurantes en riesgo de churn / atasco.
 *
 * Pega contra `GET /api/admin/risks`. Permite filtrar por flag y ordena
 * por urgencia descendente.
 *
 * Cada fila es accionable: el founder ve a quién llamar mañana antes de
 * que se vaya.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  AlertOctagon, RefreshCw, Phone, Calendar, ShoppingBag,
  Utensils, QrCode, PowerOff, ExternalLink,
} from 'lucide-react'

type FlagKey = 'no_orders_3d' | 'no_orders_7d' | 'incomplete_menu' | 'no_qr' | 'inactive'

interface RestaurantRisk {
  id:                    string
  name:                  string
  slug:                  string
  plan:                  string
  active:                boolean
  neighborhood:          string | null
  days_since_signup:     number
  last_paid_order_at:    string | null
  days_since_last_order: number | null
  menu_items_count:      number
  tables_count:          number
  flags:                 Record<FlagKey, boolean>
  flags_active:          FlagKey[]
  urgency:               number
}

interface ApiResponse {
  total:           number
  total_evaluated: number
  restaurants:     RestaurantRisk[]
}

const FLAG_META: Record<FlagKey, { label: string; short: string; color: string; icon: React.ElementType }> = {
  no_orders_3d:    { label: 'Sin pedidos 3d', short: '3d',  color: 'bg-red-500/15 text-red-300 border-red-500/30',       icon: ShoppingBag },
  no_orders_7d:    { label: 'Sin pedidos 7d', short: '7d',  color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: ShoppingBag },
  incomplete_menu: { label: 'Carta incompleta', short: 'menu', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Utensils },
  no_qr:           { label: 'Sin QR',         short: 'qr',  color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: QrCode },
  inactive:        { label: 'Desactivado',    short: 'off', color: 'bg-white/8 text-white/50 border-white/15',           icon: PowerOff },
}

const PLAN_STYLE: Record<string, string> = {
  free:       'bg-white/8 text-white/60 border border-white/10',
  starter:    'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  pro:        'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  enterprise: 'bg-violet-500/15 text-violet-400 border border-violet-500/30',
}

interface Props {
  adminSecret: string
}

export default function RestaurantsAtRisk({ adminSecret }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<FlagKey | 'all'>('all')

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch(`/api/admin/risks`, {
        headers: { 'x-admin-secret': adminSecret },
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setErr(j.error ?? 'Error cargando riesgos')
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
  }, [adminSecret])

  const filtered = useMemo(() => {
    if (!data) return []
    if (filter === 'all') return data.restaurants
    return data.restaurants.filter(r => r.flags[filter])
  }, [data, filter])

  // Counts por flag — para badges de filtro
  const flagCounts = useMemo(() => {
    const c: Record<FlagKey, number> = {
      no_orders_3d: 0, no_orders_7d: 0, incomplete_menu: 0, no_qr: 0, inactive: 0,
    }
    for (const r of data?.restaurants ?? []) {
      for (const f of r.flags_active) c[f]++
    }
    return c
  }, [data])

  if (!data && loading) {
    return (
      <section className="rounded-2xl border border-white/8 bg-white/3 p-6">
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <RefreshCw size={14} className="animate-spin" /> Cargando restaurantes en riesgo…
        </div>
      </section>
    )
  }
  if (err) {
    return (
      <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
        <p className="text-red-300 text-sm">Riesgos: {err}</p>
      </section>
    )
  }
  if (!data) return null

  return (
    <section className="rounded-2xl border border-white/8 bg-white/3 p-5">
      <header className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <AlertOctagon size={18} className="text-red-400" />
          <div>
            <h2 className="text-white font-bold text-lg">Restaurantes en riesgo</h2>
            <p className="text-white/40 text-xs">
              {data.total} de {data.total_evaluated} restaurantes con flag activo
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
          aria-label="Refrescar riesgos"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refrescar
        </button>
      </header>

      {/* Filtros */}
      {data.total > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <FilterPill
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="Todos"
            count={data.total}
          />
          {(Object.keys(FLAG_META) as FlagKey[]).map(k => (
            flagCounts[k] > 0 && (
              <FilterPill
                key={k}
                active={filter === k}
                onClick={() => setFilter(k)}
                label={FLAG_META[k].label}
                count={flagCounts[k]}
                color={FLAG_META[k].color}
              />
            )
          ))}
        </div>
      )}

      {/* Tabla */}
      {filtered.length === 0 ? (
        <p className="text-white/30 text-sm py-8 text-center">
          {data.total === 0
            ? '🎉 Ningún restaurante en riesgo. Todo en verde.'
            : 'Sin resultados para este filtro.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/8">
          <table className="w-full text-sm">
            <thead className="bg-white/3 border-b border-white/8">
              <tr>
                <th className="px-3 py-2 text-left  text-white/40 text-[10px] font-medium uppercase tracking-wider">Urg.</th>
                <th className="px-3 py-2 text-left  text-white/40 text-[10px] font-medium uppercase tracking-wider">Restaurante</th>
                <th className="px-3 py-2 text-left  text-white/40 text-[10px] font-medium uppercase tracking-wider">Plan</th>
                <th className="px-3 py-2 text-left  text-white/40 text-[10px] font-medium uppercase tracking-wider">Flags</th>
                <th className="px-3 py-2 text-right text-white/40 text-[10px] font-medium uppercase tracking-wider">Último pedido</th>
                <th className="px-3 py-2 text-right text-white/40 text-[10px] font-medium uppercase tracking-wider">Signup</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-3 py-3">
                    <UrgencyBadge value={r.urgency} />
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-white text-sm">{r.name}</p>
                    <p className="text-white/30 text-[11px]">{r.neighborhood ?? '—'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${PLAN_STYLE[r.plan] ?? PLAN_STYLE.free}`}>
                      {r.plan}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.flags_active.map(f => {
                        const meta = FLAG_META[f]
                        const Icon = meta.icon
                        return (
                          <span
                            key={f}
                            title={meta.label}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${meta.color}`}
                          >
                            <Icon size={9} /> {meta.short}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {r.days_since_last_order != null ? (
                      <span className={`font-mono text-xs ${r.days_since_last_order > 7 ? 'text-red-300' : 'text-white/70'}`}>
                        hace {r.days_since_last_order}d
                      </span>
                    ) : (
                      <span className="text-white/30 text-xs italic">nunca</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-mono text-xs text-white/50 inline-flex items-center gap-1">
                      <Calendar size={10} /> {r.days_since_signup}d
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigator.clipboard?.writeText(r.name).catch(() => {})}
                        className="p-1.5 rounded-lg text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        title="Marcar como contactado (copia nombre)"
                      >
                        <Phone size={12} />
                      </button>
                      <a
                        href={`/r/${r.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-white/40 hover:text-[#FF6B35] hover:bg-[#FF6B35]/10 transition-colors"
                        title="Ver perfil público"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function FilterPill({ active, onClick, label, count, color }: {
  active: boolean
  onClick: () => void
  label:  string
  count:  number
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
        active
          ? 'bg-[#FF6B35] border-[#FF6B35] text-white'
          : color ?? 'border-white/10 text-white/60 hover:bg-white/5'
      }`}
    >
      {label} <span className="opacity-70 ml-1">{count}</span>
    </button>
  )
}

function UrgencyBadge({ value }: { value: number }) {
  const tone = value >= 90 ? 'bg-red-500/20 text-red-300 border-red-500/40'
             : value >= 70 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
             : value >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
             :               'bg-white/8 text-white/50 border-white/15'
  return (
    <span className={`inline-block min-w-[34px] text-center px-1.5 py-0.5 rounded border font-mono font-bold text-[11px] ${tone}`}>
      {value}
    </span>
  )
}
