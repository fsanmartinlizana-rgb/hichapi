'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Send, Loader2, X, Wrench, Maximize2, Minimize2 } from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'

/**
 * ChapiAssistant — widget flotante de Chapi disponible en todas las páginas
 * del panel de restaurante.
 *
 * - Botón flotante en la esquina inferior derecha.
 * - Al abrirlo despliega un panel de chat compacto con starters.
 * - Usa el mismo endpoint que /insights (`POST /api/insights/chat`) y por
 *   tanto puede consultar ventas, reseñas, stock y caja en tiempo real.
 * - Persiste mensajes por restaurante en sessionStorage para no perder la
 *   conversación al cambiar de página.
 * - Sirve también como ayuda contextual: el personal puede preguntar cómo
 *   hacer X dentro del panel y Chapi responde.
 */

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role:        ChatRole
  content:     string
  tools_used?: Array<{ tool: string; input: unknown }>
}

const STARTERS: { text: string; category: 'data' | 'help' }[] = [
  { text: '¿Cuánto vendí hoy?',                     category: 'data' },
  { text: '¿Plato más vendido esta semana?',        category: 'data' },
  { text: '¿Insumos por quebrarme?',                category: 'data' },
  { text: '¿Cómo agrego un plato a la carta?',      category: 'help' },
  { text: '¿Cómo invito a un garzón al equipo?',    category: 'help' },
  { text: '¿Cómo configuro PedidosYa?',             category: 'help' },
]

function storageKey(restaurantId: string | undefined) {
  return restaurantId ? `chapi_assistant_${restaurantId}` : 'chapi_assistant_anon'
}

function loadHistory(restaurantId: string | undefined): ChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId))
    if (!raw) return []
    return JSON.parse(raw) as ChatMessage[]
  } catch { return [] }
}

function saveHistory(restaurantId: string | undefined, messages: ChatMessage[]) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(storageKey(restaurantId), JSON.stringify(messages))
  } catch { /* */ }
}

function ChatText({ text }: { text: string }) {
  const lines = text.split(/\r?\n/)
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} className="h-1" />
        if (/^[•\-*]\s/.test(trimmed)) {
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[#FF6B35] mt-0.5">•</span>
              <span className="flex-1">{trimmed.replace(/^[•\-*]\s/, '')}</span>
            </div>
          )
        }
        if (/^\*\*(.+)\*\*/.test(trimmed)) {
          return <p key={i} className="font-semibold">{trimmed.replace(/\*\*/g, '')}</p>
        }
        return <p key={i}>{trimmed}</p>
      })}
    </div>
  )
}

export function ChapiAssistant() {
  const { restaurant } = useRestaurant()
  const [open, setOpen]         = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)

  // Cargar historial al cambiar de restaurante
  useEffect(() => {
    setMessages(loadHistory(restaurant?.id))
    setError(null)
  }, [restaurant?.id])

  // Persistir historial
  useEffect(() => {
    if (messages.length === 0) return
    saveHistory(restaurant?.id, messages)
  }, [messages, restaurant?.id])

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      // focus input al abrir
      setTimeout(() => textareaRef.current?.focus(), 80)
    }
  }, [open, messages, loading])

  const send = useCallback(async (text: string) => {
    const prompt = text.trim()
    if (!prompt || loading || !restaurant) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: prompt }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/insights/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al consultar a Chapi')
        return
      }
      // Typewriter effect — reveal the reply progressively
      const fullReply = data.reply as string
      const toolsUsed = data.tools_used
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '', tools_used: toolsUsed },
      ])
      const CHUNK = 3
      const DELAY = 18
      for (let i = CHUNK; i <= fullReply.length; i += CHUNK) {
        await new Promise(r => setTimeout(r, DELAY))
        const slice = fullReply.slice(0, i)
        setMessages(prev => {
          const next = [...prev]
          const lastIdx = next.length - 1
          if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
            next[lastIdx] = { ...next[lastIdx], content: slice }
          }
          return next
        })
      }
      setMessages(prev => {
        const next = [...prev]
        const lastIdx = next.length - 1
        if (lastIdx >= 0 && next[lastIdx].role === 'assistant') {
          next[lastIdx] = { ...next[lastIdx], content: fullReply }
        }
        return next
      })
    } catch {
      setError('Sin conexión')
    } finally {
      setLoading(false)
    }
  }, [messages, loading, restaurant])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function clearConversation() {
    setMessages([])
    setError(null)
    saveHistory(restaurant?.id, [])
  }

  // ── Botón flotante (cerrado) ───────────────────────────────────────────────
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir Chapi Assistant"
        className="fixed bottom-5 right-5 z-40 group"
      >
        <span
          className="flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FBBF24] shadow-[0_8px_28px_-6px_rgba(255,107,53,0.55)] hover:shadow-[0_10px_36px_-4px_rgba(255,107,53,0.7)] hover:-translate-y-0.5 transition-all duration-200"
        >
          <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </span>
          <span className="text-white text-[13px] font-semibold pr-1">
            Chapi
          </span>
        </span>
      </button>
    )
  }

  // ── Panel abierto ──────────────────────────────────────────────────────────
  const panelWidth  = expanded ? 'sm:w-[520px]' : 'sm:w-[380px]'
  const panelHeight = expanded ? 'h-[78vh]'      : 'h-[560px]'

  return (
    <div
      className={`fixed bottom-5 right-5 left-5 sm:left-auto z-40 ${panelWidth} ${panelHeight}
                  bg-[#0F0F1C] border border-white/10 rounded-2xl shadow-2xl shadow-black/50
                  flex flex-col overflow-hidden`}
      role="dialog"
      aria-label="Chapi Assistant"
    >
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/8 flex items-center gap-3 bg-gradient-to-r from-[#1A1A2E] to-[#0F0F1C]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#FBBF24] flex items-center justify-center shrink-0">
          <Sparkles size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold leading-tight">Chapi</p>
          <p className="text-white/40 text-[10px] truncate">
            Asistente de tu restaurante
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearConversation}
            className="text-white/30 hover:text-white/70 text-[10px] font-medium px-2"
          >
            Limpiar
          </button>
        )}
        <button
          onClick={() => setExpanded(e => !e)}
          aria-label={expanded ? 'Contraer' : 'Expandir'}
          className="hidden sm:flex w-7 h-7 rounded-lg items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors"
        >
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        <button
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center pt-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#FBBF24] flex items-center justify-center mb-3">
              <Sparkles size={20} className="text-white" />
            </div>
            <h3 className="text-white text-sm font-bold mb-1">Hola, soy Chapi</h3>
            <p className="text-white/40 text-[11px] leading-relaxed mb-4 max-w-[260px]">
              Pregúntame sobre tus ventas, stock o reseñas — o cómo hacer algo en el panel.
            </p>

            <div className="w-full space-y-3">
              <div>
                <p className="text-white/30 text-[9px] font-semibold tracking-widest uppercase mb-1.5 text-left">
                  Tu negocio en tiempo real
                </p>
                <div className="space-y-1.5">
                  {STARTERS.filter(s => s.category === 'data').map(s => (
                    <button
                      key={s.text}
                      onClick={() => send(s.text)}
                      className="w-full text-left text-[11px] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/15 rounded-lg px-3 py-2 transition-all"
                    >
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-white/30 text-[9px] font-semibold tracking-widest uppercase mb-1.5 text-left">
                  Ayuda con el panel
                </p>
                <div className="space-y-1.5">
                  {STARTERS.filter(s => s.category === 'help').map(s => (
                    <button
                      key={s.text}
                      onClick={() => send(s.text)}
                      className="w-full text-left text-[11px] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/15 rounded-lg px-3 py-2 transition-all"
                    >
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex mb-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FBBF24] flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <Sparkles size={10} className="text-white" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl text-[12px] leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-[#FF6B35] text-white px-3 py-2 rounded-br-sm'
                  : 'bg-white/5 border border-white/8 text-white/85 px-3 py-2.5 rounded-bl-sm'
                }`}
            >
              {msg.role === 'user' ? msg.content : <ChatText text={msg.content} />}
              {msg.role === 'assistant' && msg.tools_used && msg.tools_used.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-white/8">
                  {msg.tools_used.map((t, j) => (
                    <span
                      key={j}
                      className="flex items-center gap-1 text-[9px] text-white/35 bg-white/5 px-1.5 py-0.5 rounded-full"
                    >
                      <Wrench size={8} />
                      {t.tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start mb-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FBBF24] flex items-center justify-center shrink-0 mr-2 mt-0.5">
              <Sparkles size={10} className="text-white" />
            </div>
            <div className="bg-white/5 border border-white/8 px-3 py-2 rounded-2xl rounded-bl-sm">
              <div className="flex items-center gap-2 text-white/40 text-[11px]">
                <Loader2 size={11} className="animate-spin" />
                Pensando…
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] px-3 py-2 rounded-xl">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 pb-4 pt-2 border-t border-white/8 bg-[#0F0F1C]">
        <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-xl p-1.5 focus-within:border-[#FF6B35]/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={restaurant ? 'Escríbele a Chapi…' : 'Cargando restaurante…'}
            rows={1}
            disabled={loading || !restaurant}
            className="flex-1 bg-transparent text-white text-[12px] px-2 py-1.5 placeholder:text-white/25 focus:outline-none resize-none max-h-24"
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim() || loading || !restaurant}
            className="w-8 h-8 rounded-lg bg-[#FF6B35] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#e85d2a] transition-colors shrink-0"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
        <p className="text-white/20 text-[9px] text-center mt-1.5">
          Chapi puede equivocarse. Verifica datos críticos.
        </p>
      </div>
    </div>
  )
}
