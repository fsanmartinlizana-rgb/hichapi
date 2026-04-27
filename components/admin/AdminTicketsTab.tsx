'use client'

/**
 * AdminTicketsTab — gestión completa de tickets para el founder dashboard.
 *
 * Lista a la izquierda + detalle a la derecha (master-detail).
 * Cada ticket abierto carga:
 *   • TicketContextPanel  → restaurant + activity + tickets previos
 *   • Sugerencia Chapi    → reply lista con clasificación 3-buckets
 *   • Acciones rápidas    → cambiar status (investigating/resolved/wont_fix)
 *
 * Auth: usa header `x-admin-secret` (mismo patrón que /admin/dashboard).
 * Los endpoints de context/suggest-reply soportan ese header como auth dual.
 */

import { useEffect, useState } from 'react'
import {
  LifeBuoy, RefreshCw, AlertCircle, Sparkles, Loader2, Copy, Check,
  CheckCircle2, Clock, MessageSquare, Code, Phone, Store, Calendar,
  LogIn, Receipt, Utensils, History, X,
} from 'lucide-react'

interface Ticket {
  id:           string
  subject:      string
  description:  string
  severity:     string
  status:       string
  created_at:   string
  resolved_at:  string | null
  restaurant_id: string | null
}

interface ContextData {
  restaurant: {
    id: string
    name: string
    slug: string
    plan: string | null
    active: boolean | null
    neighborhood: string | null
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
    created_at: string
  }>
  note?: string
}

interface Suggestion {
  reply: string
  category: string
  reasoning: string
}

const SEV_COLOR: Record<string, string> = {
  critical: 'text-red-300 bg-red-500/10 border-red-500/30',
  high:     'text-amber-300 bg-amber-500/10 border-amber-500/30',
  medium:   'text-amber-300 bg-amber-500/10 border-amber-500/30',
  low:      'text-white/50 bg-white/5 border-white/10',
}

const STATUS_COLOR: Record<string, string> = {
  open:          'text-red-300',
  investigating: 'text-amber-300',
  resolved:      'text-emerald-300',
  wont_fix:      'text-white/40',
}

const PLAN_STYLE: Record<string, string> = {
  free:       'bg-white/8 text-white/60 border border-white/10',
  starter:    'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  pro:        'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  enterprise: 'bg-violet-500/15 text-violet-400 border border-violet-500/30',
}

interface Props {
  tickets:     Ticket[]
  adminSecret: string
  /** Llamar cuando un ticket cambia de status para refrescar listado padre. */
  onRefresh?:  () => void
}

export default function AdminTicketsTab({ tickets, adminSecret, onRefresh }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = tickets.find(t => t.id === selectedId) ?? null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-3">
      {/* Lista de tickets */}
      <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
        {tickets.length === 0 && (
          <div className="text-center py-10 text-white/30 text-sm">Sin tickets</div>
        )}
        {tickets.map(t => {
          const isSelected = t.id === selectedId
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                isSelected
                  ? 'border-[#FF6B35]/50 bg-[#FF6B35]/8'
                  : 'border-white/8 bg-white/3 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <LifeBuoy size={11} className="text-white/40 shrink-0" />
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${SEV_COLOR[t.severity] ?? SEV_COLOR.low}`}>
                    {t.severity}
                  </span>
                </div>
                <span className={`text-[10px] capitalize ${STATUS_COLOR[t.status] ?? 'text-white/40'}`}>
                  {t.status}
                </span>
              </div>
              <p className="text-sm font-medium text-white/90 line-clamp-1">{t.subject}</p>
              <p className="text-[11px] text-white/45 line-clamp-2 mt-0.5">{t.description}</p>
              <p className="text-[10px] text-white/25 mt-1.5">
                {new Date(t.created_at).toLocaleString('es-CL', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </button>
          )
        })}
      </div>

      {/* Detalle */}
      <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
        {!selected ? (
          <div className="h-full min-h-[400px] flex items-center justify-center text-center text-white/30 text-sm">
            <div className="space-y-2">
              <LifeBuoy size={26} className="mx-auto text-white/20" />
              <p>Seleccioná un ticket</p>
            </div>
          </div>
        ) : (
          <TicketDetail
            ticket={selected}
            adminSecret={adminSecret}
            onClose={() => setSelectedId(null)}
            onUpdated={() => {
              onRefresh?.()
            }}
          />
        )}
      </div>
    </div>
  )
}

/* ── TicketDetail ──────────────────────────────────────────────────── */

function TicketDetail({
  ticket, adminSecret, onClose, onUpdated,
}: {
  ticket: Ticket
  adminSecret: string
  onClose: () => void
  onUpdated: () => void
}) {
  const [context,    setContext]    = useState<ContextData | null>(null)
  const [ctxLoading, setCtxLoading] = useState(false)
  const [ctxErr,     setCtxErr]     = useState<string | null>(null)

  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [copied,     setCopied]     = useState(false)

  const [updating, setUpdating] = useState(false)

  // Cargar contexto al cambiar de ticket
  useEffect(() => {
    setSuggestion(null)
    setCopied(false)
    setContext(null)
    setCtxErr(null)
    setCtxLoading(true)

    fetch(`/api/admin/support/tickets/${ticket.id}/context`, {
      headers: { 'x-admin-secret': adminSecret },
    })
      .then(async r => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.error ?? 'Error cargando contexto')
        }
        return r.json()
      })
      .then(setContext)
      .catch(err => setCtxErr(err.message ?? 'Error'))
      .finally(() => setCtxLoading(false))
  }, [ticket.id, adminSecret])

  async function suggestReply() {
    setSuggesting(true)
    setSuggestion(null)
    setCopied(false)
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticket.id}/suggest-reply`, {
        method:  'POST',
        headers: { 'x-admin-secret': adminSecret },
      })
      const data = await res.json()
      if (data.error) {
        setSuggestion({ reply: `⚠️ ${data.error}`, category: '', reasoning: '' })
      } else {
        setSuggestion({
          reply:     data.reply ?? '',
          category:  data.category ?? '',
          reasoning: data.reasoning ?? '',
        })
      }
    } catch {
      setSuggestion({ reply: '⚠️ Error de red', category: '', reasoning: '' })
    } finally {
      setSuggesting(false)
    }
  }

  async function copyToClipboard() {
    if (!suggestion?.reply) return
    try {
      await navigator.clipboard.writeText(suggestion.reply)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard puede fallar en HTTP no seguro */
    }
  }

  async function updateStatus(status: string) {
    setUpdating(true)
    try {
      await fetch('/api/admin/support/tickets', {
        method:  'PATCH',
        headers: {
          'Content-Type':    'application/json',
          'x-admin-secret':  adminSecret,
        },
        body: JSON.stringify({ id: ticket.id, status }),
      })
      onUpdated()
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] h-full">
      {/* Detalle + Suggest reply */}
      <div className="p-5 space-y-4 overflow-y-auto max-h-[640px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${SEV_COLOR[ticket.severity] ?? SEV_COLOR.low}`}>
                {ticket.severity}
              </span>
              <span className={`text-[10px] capitalize ${STATUS_COLOR[ticket.status] ?? 'text-white/40'}`}>
                {ticket.status}
              </span>
            </div>
            <h3 className="text-white text-base font-bold leading-tight">{ticket.subject}</h3>
            <p className="text-white/40 text-[11px] mt-1">
              {new Date(ticket.created_at).toLocaleString('es-CL')}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {ticket.status !== 'investigating' && ticket.status !== 'resolved' && (
              <button
                onClick={() => updateStatus('investigating')}
                disabled={updating}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-semibold hover:bg-amber-500/20 transition-colors disabled:opacity-50"
              >
                <Clock size={11} /> Investigar
              </button>
            )}
            {ticket.status !== 'resolved' && (
              <button
                onClick={() => updateStatus('resolved')}
                disabled={updating}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 size={11} /> Resolver
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8"
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
          <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
            Descripción
          </p>
          <p className="text-white/85 text-sm whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </p>
        </div>

        {/* Chapi sugiere respuesta */}
        <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <MessageSquare size={13} className="text-emerald-400" />
              <p className="text-white font-semibold text-sm">Chapi sugiere respuesta</p>
            </div>
            {!suggestion && (
              <button
                onClick={suggestReply}
                disabled={suggesting}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
                style={{ minHeight: 32 }}
              >
                {suggesting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {suggesting ? 'Generando…' : 'Generar'}
              </button>
            )}
          </div>

          {suggestion && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                {suggestion.category === 'resolvable_now' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <CheckCircle2 size={10} /> Resolvible ahora
                  </span>
                )}
                {suggestion.category === 'needs_code_change' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <Code size={10} /> Requiere código
                  </span>
                )}
                {suggestion.category === 'needs_call' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 border border-red-500/30 text-red-400">
                    <Phone size={10} /> Requiere llamada
                  </span>
                )}
                {suggestion.reasoning && (
                  <span className="text-white/40 text-[10px]">{suggestion.reasoning}</span>
                )}
              </div>

              <div className="text-white/85 text-sm whitespace-pre-wrap leading-relaxed bg-white/[0.04] border border-white/10 rounded-lg p-3">
                {suggestion.reply}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyToClipboard}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    copied
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : 'bg-white/8 border border-white/15 text-white hover:bg-white/12'
                  }`}
                  style={{ minHeight: 32 }}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? '¡Copiado!' : 'Copiar'}
                </button>
                <button
                  onClick={suggestReply}
                  disabled={suggesting}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white/60 hover:text-white border border-white/10 hover:bg-white/5 disabled:opacity-50 transition-colors"
                  style={{ minHeight: 32 }}
                >
                  {suggesting ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Regenerar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Context panel (xl+) */}
      <div className="border-t xl:border-t-0 xl:border-l border-white/8 p-4 space-y-3 overflow-y-auto max-h-[640px]">
        <h4 className="text-white/70 text-[10px] font-bold uppercase tracking-widest">
          Contexto
        </h4>

        {ctxLoading && (
          <div className="flex items-center gap-2 text-white/40 text-xs">
            <RefreshCw size={11} className="animate-spin" /> Cargando…
          </div>
        )}
        {ctxErr && (
          <div className="flex items-center gap-2 text-red-400 text-xs">
            <AlertCircle size={11} /> {ctxErr}
          </div>
        )}

        {context?.note && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-2 text-amber-300 text-[11px]">
            {context.note}
          </div>
        )}

        {context?.restaurant && (
          <div className="rounded-lg border border-white/8 bg-white/3 p-2.5 space-y-2">
            <div className="flex items-start gap-1.5">
              <Store size={11} className="text-[#FF6B35] mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-xs truncate">{context.restaurant.name}</div>
                <div className="text-white/40 text-[10px]">
                  {context.restaurant.neighborhood ?? '—'} · /{context.restaurant.slug}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${PLAN_STYLE[context.restaurant.plan ?? 'free'] ?? PLAN_STYLE.free}`}>
                {context.restaurant.plan ?? 'free'}
              </span>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${context.restaurant.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/8 text-white/40'}`}>
                {context.restaurant.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex items-center gap-1 text-white/40 text-[9px]">
                  <Calendar size={8} /> Signup
                </div>
                <div className="text-white text-xs font-semibold">
                  {context.restaurant.days_since_signup ?? '—'}
                  <span className="text-white/40 font-normal"> días</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-white/40 text-[9px]">
                  <LogIn size={8} /> Login
                </div>
                <div className="text-white text-xs font-semibold">
                  {context.restaurant.days_since_login != null ? `hace ${context.restaurant.days_since_login}d` : 'nunca'}
                </div>
              </div>
            </div>
          </div>
        )}

        {context?.activity && (
          <div className="rounded-lg border border-white/8 bg-white/3 p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Receipt size={11} className="text-[#FF6B35]" />
              <span className="text-white/70 text-[10px] font-bold">Actividad</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <div className="text-white text-sm font-extrabold font-mono">
                  {context.activity.orders_total}
                </div>
                <div className="text-white/40 text-[9px] leading-tight">Pedidos</div>
              </div>
              <div>
                <div className="text-white text-sm font-extrabold font-mono">
                  {context.activity.orders_last_7d}
                </div>
                <div className="text-white/40 text-[9px] leading-tight">7d</div>
              </div>
              <div>
                <div className="text-white text-sm font-extrabold font-mono flex items-center gap-1">
                  {context.activity.menu_items_count}
                  <Utensils size={9} className="text-white/30" />
                </div>
                <div className="text-white/40 text-[9px] leading-tight">Items</div>
              </div>
            </div>
          </div>
        )}

        {context && context.previous_tickets.length > 0 && (
          <div className="rounded-lg border border-white/8 bg-white/3 p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <History size={11} className="text-[#FF6B35]" />
              <span className="text-white/70 text-[10px] font-bold">
                Previos ({context.previous_tickets.length})
              </span>
            </div>
            <ul className="space-y-1">
              {context.previous_tickets.slice(0, 5).map(t => (
                <li key={t.id} className="text-[11px]">
                  <div className="text-white/85 truncate font-medium">{t.subject}</div>
                  <div className="text-white/35 text-[9px]">
                    {new Date(t.created_at).toLocaleDateString('es-CL')} · {t.status}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
