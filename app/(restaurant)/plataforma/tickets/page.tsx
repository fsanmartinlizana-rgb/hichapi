'use client'

// ── /plataforma/tickets — Bandeja de soporte con agente IA ─────────────────
// Super admin only. Lista todos los tickets de la plataforma ordenados por
// priority, permite filtrar, responder y consultar al agente IA.
//
// Sprint 4 (2026-04-19).

import { useCallback, useEffect, useState } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  Ticket, RefreshCw, AlertTriangle, Clock, CheckCircle2, Crown,
  Sparkles, Loader2, Send, Shield, FileText, ChevronRight, Filter,
} from 'lucide-react'

interface SupportTicket {
  id:             string
  subject:        string
  description:    string
  severity:       'low' | 'medium' | 'critical'
  priority:       'low' | 'normal' | 'high' | 'urgent'
  status:         'open' | 'investigating' | 'resolved' | 'wont_fix'
  assigned_to:    string | null
  ai_analysis:    { category?: string; matched_keywords?: string[] }
  restaurant_id:  string | null
  user_id:        string | null
  page_url:       string | null
  plan_at_open:   string | null
  created_at:     string
  updated_at:     string
  resolved_at:    string | null
  restaurants:    { name: string; slug: string } | null
}

interface ConversationTurn {
  role: 'agent' | 'admin' | 'system'
  text: string
  ts:   string
}

const PRIORITY_RANK: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 }

const PRIORITY_STYLE: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-400 border-red-500/30',
  high:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  normal: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  low:    'bg-white/5 text-white/40 border-white/10',
}

const STATUS_STYLE: Record<string, string> = {
  open:          'bg-red-500/10 text-red-400',
  investigating: 'bg-amber-500/10 text-amber-400',
  resolved:      'bg-emerald-500/10 text-emerald-400',
  wont_fix:      'bg-white/5 text-white/40',
}

const PLAN_STYLE: Record<string, string> = {
  enterprise: 'bg-violet-500/15 text-violet-300',
  pro:        'bg-[#FF6B35]/15 text-[#FF6B35]',
  starter:    'bg-blue-500/15 text-blue-400',
  free:       'bg-white/5 text-white/40',
}

export default function SupportTicketsPage() {
  const { isSuperAdmin, loading: ctxLoading } = useRestaurant()

  const [tickets, setTickets]   = useState<SupportTicket[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'open' | 'investigating' | 'resolved' | 'all'>('open')
  const [selected, setSelected] = useState<SupportTicket | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/support/tickets?status=${filter}`)
    const data = await res.json()
    const sorted = (data.tickets ?? []) as SupportTicket[]
    sorted.sort((a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0))
    setTickets(sorted)
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  if (ctxLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <Shield size={32} className="text-red-400 mx-auto" />
          <p className="text-white font-semibold">Acceso restringido</p>
          <p className="text-white/40 text-sm">Solo super admins.</p>
        </div>
      </div>
    )
  }

  const counts = {
    open:          tickets.filter(t => t.status === 'open').length,
    investigating: tickets.filter(t => t.status === 'investigating').length,
    urgent:        tickets.filter(t => t.priority === 'urgent').length,
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left — ticket list */}
      <div className="w-96 border-r border-white/5 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 space-y-3">
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-[#FF6B35]" />
            <h1 className="text-white text-sm font-bold flex-1">Bandeja de soporte</h1>
            <button
              onClick={load}
              className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white transition-colors"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex gap-1 text-[10px]">
            {([
              ['open',          `Abiertos · ${counts.open}`],
              ['investigating', `Invest. · ${counts.investigating}`],
              ['resolved',      'Resueltos'],
              ['all',           'Todos'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex-1 px-2 py-1.5 rounded-lg font-medium transition-colors ${
                  filter === key
                    ? 'bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/30'
                    : 'bg-white/3 text-white/40 border border-white/5 hover:text-white/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {counts.urgent > 0 && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle size={12} className="text-red-400" />
              <p className="text-red-300 text-[11px] flex-1">{counts.urgent} urgentes requieren atención</p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="text-[#FF6B35] animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-center text-white/30 text-xs py-10">No hay tickets en este filtro</p>
          ) : (
            tickets.map(t => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`w-full text-left px-4 py-3 border-b border-white/3 transition-colors ${
                  selected?.id === t.id ? 'bg-white/5' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-start gap-2 mb-1">
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${PRIORITY_STYLE[t.priority]}`}>
                    {t.priority}
                  </span>
                  {t.plan_at_open && (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${PLAN_STYLE[t.plan_at_open] ?? PLAN_STYLE.free}`}>
                      {t.plan_at_open}
                    </span>
                  )}
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ml-auto ${STATUS_STYLE[t.status]}`}>
                    {t.status}
                  </span>
                </div>
                <p className="text-white text-xs font-semibold line-clamp-1 mb-0.5">{t.subject}</p>
                <p className="text-white/40 text-[10px] line-clamp-1 mb-1">
                  {t.restaurants?.name ?? 'Sin restaurant'} · {new Date(t.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-white/30 text-[10px] line-clamp-2">{t.description}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right — detail + AI agent */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-center text-white/30 text-sm">
            <div className="space-y-2">
              <Ticket size={24} className="mx-auto text-white/20" />
              <p>Seleccioná un ticket a la izquierda</p>
            </div>
          </div>
        ) : (
          <TicketDetail ticket={selected} onUpdated={(t) => {
            setSelected(t)
            setTickets(prev => prev.map(x => x.id === t.id ? t : x))
          }} />
        )}
      </div>
    </div>
  )
}

function TicketDetail({ ticket, onUpdated }: {
  ticket:    SupportTicket
  onUpdated: (t: SupportTicket) => void
}) {
  const [question,   setQuestion]   = useState('')
  const [asking,     setAsking]     = useState(false)
  const [answer,     setAnswer]     = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationTurn[]>([])

  useEffect(() => {
    setAnswer(null)
    setConversation([])
    setQuestion('')
  }, [ticket.id])

  async function updateStatus(status: SupportTicket['status']) {
    const res = await fetch('/api/admin/support/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ticket.id, status }),
    })
    const data = await res.json()
    if (data.ticket) onUpdated(data.ticket)
  }

  async function askAgent() {
    setAsking(true)
    try {
      const res = await fetch('/api/admin/support/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ticket_id: ticket.id, question: question || undefined }),
      })
      const data = await res.json()
      if (data.error) {
        setAnswer(`⚠️ ${data.error}`)
      } else {
        setAnswer(data.answer as string)
        if (Array.isArray(data.conversation)) setConversation(data.conversation as ConversationTurn[])
      }
      setQuestion('')
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${PRIORITY_STYLE[ticket.priority]}`}>
              {ticket.priority}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${STATUS_STYLE[ticket.status]}`}>
              {ticket.status}
            </span>
            {ticket.plan_at_open && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${PLAN_STYLE[ticket.plan_at_open] ?? PLAN_STYLE.free}`}>
                {ticket.plan_at_open}
              </span>
            )}
          </div>
          <h2 className="text-white text-lg font-bold">{ticket.subject}</h2>
          <div className="flex items-center gap-2 mt-1 text-xs text-white/40 flex-wrap">
            {ticket.restaurants && <span>{ticket.restaurants.name}</span>}
            <span>·</span>
            <span>{new Date(ticket.created_at).toLocaleString('es-CL')}</span>
            {ticket.page_url && <>
              <span>·</span>
              <a href={ticket.page_url} target="_blank" rel="noreferrer" className="text-[#FF6B35] hover:underline truncate">
                {ticket.page_url}
              </a>
            </>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ticket.status !== 'investigating' && (
            <button
              onClick={() => updateStatus('investigating')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
            >
              <Clock size={12} /> Investigar
            </button>
          )}
          {ticket.status !== 'resolved' && (
            <button
              onClick={() => updateStatus('resolved')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors"
            >
              <CheckCircle2 size={12} /> Resolver
            </button>
          )}
        </div>
      </div>

      {/* Descripción del cliente */}
      <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-5 space-y-2">
        <p className="text-white/40 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
          <FileText size={11} /> Descripción del cliente
        </p>
        <p className="text-white/85 text-sm whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
        {ticket.ai_analysis?.category && (
          <div className="flex items-center gap-2 pt-2 mt-2 border-t border-white/5">
            <span className="text-white/30 text-[10px]">Categoría IA: </span>
            <span className="text-white/60 text-[10px] bg-white/5 px-2 py-0.5 rounded">{ticket.ai_analysis.category}</span>
            {ticket.ai_analysis.matched_keywords && ticket.ai_analysis.matched_keywords.length > 0 && (
              <span className="text-white/30 text-[10px]">
                · Keywords: {ticket.ai_analysis.matched_keywords.slice(0, 4).join(', ')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Agente IA */}
      <div className="bg-gradient-to-br from-[#FF6B35]/5 to-transparent border border-[#FF6B35]/20 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#FF6B35]" />
          <p className="text-white font-semibold text-sm">Agente IA</p>
          <span className="text-white/30 text-[10px]">analiza el ticket y sugiere solución</span>
        </div>

        {/* Conversation history */}
        {conversation.length > 0 && (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {conversation.map((turn, i) => (
              <div key={i} className={turn.role === 'admin' ? 'pl-6' : 'pr-6'}>
                <p className={`text-[10px] font-medium mb-1 ${turn.role === 'admin' ? 'text-blue-400' : 'text-[#FF6B35]'}`}>
                  {turn.role === 'admin' ? 'Vos' : 'Agente IA'} · {new Date(turn.ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className={`text-sm whitespace-pre-wrap leading-relaxed px-3 py-2 rounded-lg ${
                  turn.role === 'admin'
                    ? 'bg-blue-500/5 border border-blue-500/15 text-white/80'
                    : 'bg-white/5 border border-white/8 text-white/85'
                }`}>
                  {turn.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Latest answer (when not in conversation yet) */}
        {answer && conversation.length === 0 && (
          <div className="text-white/85 text-sm whitespace-pre-wrap leading-relaxed bg-white/5 border border-white/8 rounded-lg p-3">
            {answer}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !asking && askAgent()}
            placeholder={answer || conversation.length > 0 ? 'Preguntale algo más al agente...' : 'Click "Analizar" o preguntá algo específico'}
            className="flex-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/8 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#FF6B35]/40"
          />
          <button
            onClick={askAgent}
            disabled={asking}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] disabled:opacity-50 transition-colors"
          >
            {asking ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {asking ? 'Pensando' : (answer || conversation.length > 0 ? 'Preguntar' : 'Analizar')}
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-xs text-white/50 space-y-1">
        <p><strong className="text-white/70">ID:</strong> <span className="font-mono">{ticket.id}</span></p>
        {ticket.user_id && <p><strong className="text-white/70">User ID:</strong> <span className="font-mono">{ticket.user_id}</span></p>}
        {ticket.restaurant_id && <p><strong className="text-white/70">Restaurant ID:</strong> <span className="font-mono">{ticket.restaurant_id}</span></p>}
        <p><strong className="text-white/70">Creado:</strong> {new Date(ticket.created_at).toLocaleString('es-CL')}</p>
        {ticket.resolved_at && <p><strong className="text-white/70">Resuelto:</strong> {new Date(ticket.resolved_at).toLocaleString('es-CL')}</p>}
      </div>
    </div>
  )
}
