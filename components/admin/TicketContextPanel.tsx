'use client'

/**
 * TicketContextPanel — carga y muestra el contexto del restaurante de un
 * ticket de soporte. Se usa al costado del TicketDetail en el panel de
 * Plataforma → Tickets.
 *
 * Llama a `GET /api/admin/support/tickets/[id]/context` que ya cruza:
 *   - restaurants (plan, signup, last_login)
 *   - orders (count total y últimos 7d)
 *   - menu_items (count)
 *   - support_tickets (previos del mismo restaurant)
 *
 * Sprint 1.7. La respuesta sugerida con LLM viene en Sprint 4.
 */

import { useEffect, useState } from 'react'
import {
  Store, Calendar, LogIn, Receipt, Utensils, History, RefreshCw, AlertCircle,
} from 'lucide-react'

interface ContextData {
  restaurant: {
    id: string
    name: string
    slug: string
    plan: string | null
    active: boolean | null
    neighborhood: string | null
    created_at: string
    days_since_signup: number | null
    last_login_at: string | null
    days_since_login: number | null
  } | null
  activity: {
    orders_total: number
    orders_last_7d: number
    menu_items_count: number
  } | null
  previous_tickets: Array<{
    id: string
    subject: string
    status: string
    severity: string | null
    priority: string | null
    created_at: string
  }>
  note?: string
}

const PLAN_STYLE: Record<string, string> = {
  free:       'bg-white/8 text-white/60',
  starter:    'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  pro:        'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  enterprise: 'bg-violet-500/15 text-violet-400 border border-violet-500/30',
}

interface Props {
  ticketId: string
}

export default function TicketContextPanel({ ticketId }: Props) {
  const [data, setData] = useState<ContextData | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/context`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErr(j.error ?? 'Error cargando contexto')
        return
      }
      setData(await res.json())
    } catch {
      setErr('Error de red')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  if (loading && !data) {
    return (
      <aside className="w-80 shrink-0 hidden lg:flex flex-col gap-3 p-4 border-l border-white/8 text-white/40 text-sm">
        <RefreshCw size={14} className="animate-spin" /> Cargando contexto…
      </aside>
    )
  }

  if (err) {
    return (
      <aside className="w-80 shrink-0 hidden lg:flex flex-col gap-2 p-4 border-l border-white/8">
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle size={14} /> {err}
        </div>
      </aside>
    )
  }

  if (!data) return null

  const { restaurant, activity, previous_tickets, note } = data

  return (
    <aside className="w-80 shrink-0 hidden lg:flex flex-col gap-3 p-4 border-l border-white/8 overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-white/70 text-xs font-bold uppercase tracking-widest">
          Contexto
        </h3>
        <button
          onClick={load}
          className="text-white/40 hover:text-white text-[10px]"
          aria-label="Refrescar contexto"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {note && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-2.5 text-amber-300 text-xs">
          {note}
        </div>
      )}

      {/* Restaurant card */}
      {restaurant && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Store size={14} className="text-[#FF6B35] mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-sm truncate">{restaurant.name}</div>
              <div className="text-white/40 text-[11px]">
                {restaurant.neighborhood ?? '—'} · /{restaurant.slug}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PLAN_STYLE[restaurant.plan ?? 'free'] ?? PLAN_STYLE.free}`}>
              {restaurant.plan ?? 'free'}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${restaurant.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/8 text-white/40'}`}>
              {restaurant.active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <div className="flex items-center gap-1 text-white/40 text-[10px]">
                <Calendar size={9} /> Signup
              </div>
              <div className="text-white text-xs font-semibold">
                {restaurant.days_since_signup ?? '—'}
                <span className="text-white/40 font-normal"> días</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-white/40 text-[10px]">
                <LogIn size={9} /> Último login
              </div>
              <div className="text-white text-xs font-semibold">
                {restaurant.days_since_login != null ? `hace ${restaurant.days_since_login}d` : 'nunca'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity card */}
      {activity && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Receipt size={13} className="text-[#FF6B35]" />
            <span className="text-white/70 text-xs font-bold">Actividad</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-white text-base font-extrabold font-mono">
                {activity.orders_total}
              </div>
              <div className="text-white/40 text-[10px] leading-tight">Total pedidos</div>
            </div>
            <div>
              <div className="text-white text-base font-extrabold font-mono">
                {activity.orders_last_7d}
              </div>
              <div className="text-white/40 text-[10px] leading-tight">Últimos 7d</div>
            </div>
            <div>
              <div className="text-white text-base font-extrabold font-mono flex items-center gap-1">
                {activity.menu_items_count}
                <Utensils size={10} className="text-white/30" />
              </div>
              <div className="text-white/40 text-[10px] leading-tight">Menu items</div>
            </div>
          </div>
        </div>
      )}

      {/* Previous tickets */}
      {previous_tickets.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <History size={13} className="text-[#FF6B35]" />
            <span className="text-white/70 text-xs font-bold">
              Tickets previos ({previous_tickets.length})
            </span>
          </div>
          <ul className="space-y-1.5">
            {previous_tickets.slice(0, 5).map(t => (
              <li key={t.id} className="text-xs">
                <div className="text-white/85 truncate font-medium">{t.subject}</div>
                <div className="text-white/35 text-[10px]">
                  {new Date(t.created_at).toLocaleDateString('es-CL')} · {t.status}
                </div>
              </li>
            ))}
            {previous_tickets.length > 5 && (
              <li className="text-white/35 text-[10px] italic">
                +{previous_tickets.length - 5} más
              </li>
            )}
          </ul>
        </div>
      )}
    </aside>
  )
}
