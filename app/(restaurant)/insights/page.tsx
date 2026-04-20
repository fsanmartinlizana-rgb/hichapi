'use client'

import { useState, useRef, useEffect } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  Sparkles, Send, Loader2, Wrench, TrendingUp, Package, Banknote, MessageSquare, ShoppingCart,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role:        ChatRole
  content:     string
  tools_used?: Array<{ tool: string; input: unknown }>
}

// ── Suggested starter questions ───────────────────────────────────────────────

const STARTERS: { icon: typeof TrendingUp; text: string; color: string }[] = [
  { icon: TrendingUp,    text: '¿Cuánto vendí hoy?',                  color: '#34D399' },
  { icon: ShoppingCart,  text: '¿Cuál es mi plato más vendido esta semana?', color: '#FF6B35' },
  { icon: MessageSquare, text: '¿Qué dicen las últimas reseñas?',     color: '#A78BFA' },
  { icon: Package,       text: '¿Qué insumos están por quebrarme?',   color: '#FBBF24' },
  { icon: Banknote,      text: '¿Cómo cerró la caja de hoy?',         color: '#60A5FA' },
]

// ── Simple markdown-ish renderer ─────────────────────────────────────────────
// The model responds in plain text + bullets. We render it preserving line
// breaks and coloring lines that start with "•" or "-" as list items.

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
              <span className="text-[#FF6B35] mt-1">•</span>
              <span className="flex-1">{trimmed.replace(/^[•\-*]\s/, '')}</span>
            </div>
          )
        }
        if (/^\*\*(.+)\*\*/.test(trimmed)) {
          return <p key={i} className="font-bold">{trimmed.replace(/\*\*/g, '')}</p>
        }
        return <p key={i}>{trimmed}</p>
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

// Clave de storage por restaurant — el historial se preserva cross-navigation.
// Se usa sessionStorage (no localStorage) para no acumular conversaciones
// entre sesiones de login distintas.
const STORAGE_KEY = (restId: string) => `hichapi_insights_history_v1:${restId}`

export default function InsightsPage() {
  const { restaurant } = useRestaurant()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  // Typing animation: índice de caracteres revelados del último mensaje del
  // assistant. Solo afecta al último; todos los anteriores se renderizan full.
  const [typingIndex, setTypingIndex] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Restaurar historial al montar ──────────────────────────────────────
  useEffect(() => {
    if (!restaurant?.id || typeof window === 'undefined') return
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY(restaurant.id))
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[]
        if (Array.isArray(parsed)) setMessages(parsed)
      }
    } catch { /* ignore */ }
  }, [restaurant?.id])

  // ── Persistir historial en cada cambio ─────────────────────────────────
  useEffect(() => {
    if (!restaurant?.id || typeof window === 'undefined') return
    try {
      if (messages.length === 0) {
        sessionStorage.removeItem(STORAGE_KEY(restaurant.id))
      } else {
        sessionStorage.setItem(STORAGE_KEY(restaurant.id), JSON.stringify(messages))
      }
    } catch { /* ignore quota */ }
  }, [messages, restaurant?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, typingIndex])

  // ── Typing animation: revela la respuesta caracter por caracter ────────
  useEffect(() => {
    if (typingIndex === null) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant') return
    if (typingIndex >= last.content.length) {
      setTypingIndex(null)
      return
    }
    const speed = last.content.length > 400 ? 8 : 14 // ms por caracter
    const step  = last.content.length > 400 ? 3 : 1
    const t = setTimeout(() => setTypingIndex(i => (i ?? 0) + step), speed)
    return () => clearTimeout(t)
  }, [typingIndex, messages])

  async function send(text: string) {
    const prompt = text.trim()
    if (!prompt || loading || !restaurant) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: prompt }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/insights/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          restaurant_id: restaurant.id,
          messages:      newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al consultar')
        return
      }
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply, tools_used: data.tools_used },
      ])
      setTypingIndex(0) // arranca typing animation sobre el nuevo último mensaje
    } catch {
      setError('Sin conexión')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-6 pt-6 pb-4 shrink-0 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#FBBF24] flex items-center justify-center">
            <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">Chapi Insights</h1>
            <p className="text-white/35 text-xs">Pregunta lo que quieras sobre tu negocio</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setError(null) }}
            className="text-white/30 hover:text-white/60 text-xs"
          >
            Nueva conversación
          </button>
        )}
      </div>

      {/* Conversation area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Empty state with starters */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-10 pb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#FBBF24] flex items-center justify-center mb-4">
                <Sparkles size={24} className="text-white" />
              </div>
              <h2 className="text-white text-lg font-bold">¿Qué quieres saber?</h2>
              <p className="text-white/40 text-sm mt-1 mb-6 text-center max-w-md">
                Puedo consultar tus ventas, reseñas, stock y caja en tiempo real.
              </p>

              <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTERS.map((s, i) => {
                  const Icon = s.icon
                  return (
                    <button
                      key={i}
                      onClick={() => send(s.text)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 hover:border-white/15 transition-all text-left group"
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: s.color + '20', color: s.color }}
                      >
                        <Icon size={13} />
                      </div>
                      <span className="text-white/70 text-xs group-hover:text-white/90 transition-colors">
                        {s.text}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1
            const isTyping = isLast && msg.role === 'assistant' && typingIndex !== null
            const displayedText = isTyping
              ? msg.content.slice(0, typingIndex ?? 0)
              : msg.content
            return (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FBBF24] flex items-center justify-center text-white shrink-0 mr-2 mt-1">
                  <Sparkles size={12} />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl text-sm leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-[#FF6B35] text-white px-4 py-2.5 rounded-br-sm'
                    : 'bg-[#1C1C2E] text-white/85 border border-white/5 px-4 py-3 rounded-bl-sm'
                  }`}
              >
                {msg.role === 'user'
                  ? msg.content
                  : (
                    <>
                      <ChatText text={displayedText} />
                      {isTyping && <span className="inline-block w-0.5 h-3.5 bg-[#FF6B35] ml-0.5 animate-pulse align-middle" />}
                    </>
                  )
                }

                {/* Tool-use chips (assistant only) */}
                {msg.role === 'assistant' && msg.tools_used && msg.tools_used.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-white/5">
                    {msg.tools_used.map((t, j) => (
                      <span
                        key={j}
                        className="flex items-center gap-1 text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full"
                      >
                        <Wrench size={9} />
                        {t.tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )})}

          {/* Loading */}
          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FBBF24] flex items-center justify-center text-white shrink-0 mr-2 mt-1">
                <Sparkles size={12} />
              </div>
              <div className="bg-[#1C1C2E] border border-white/5 px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="flex items-center gap-2 text-white/40 text-xs">
                  <Loader2 size={12} className="animate-spin" />
                  Consultando tus datos…
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex justify-start">
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs px-4 py-3 rounded-xl max-w-[80%]">
                {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 px-6 pb-6 pt-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-[#1C1C2E] border border-white/10 rounded-2xl p-2 focus-within:border-[#FF6B35]/50 transition-colors">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregúntale algo a Chapi sobre tu negocio…"
              rows={1}
              className="flex-1 bg-transparent text-white text-sm px-3 py-2 placeholder:text-white/25 focus:outline-none resize-none max-h-32"
              disabled={loading || !restaurant}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading || !restaurant}
              className="w-9 h-9 rounded-xl bg-[#FF6B35] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#e85d2a] transition-colors shrink-0"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="text-white/25 text-[10px] text-center mt-2">
            Chapi Insights consulta tus datos en tiempo real. Verifica antes de tomar decisiones críticas.
          </p>
        </div>
      </div>
    </div>
  )
}
