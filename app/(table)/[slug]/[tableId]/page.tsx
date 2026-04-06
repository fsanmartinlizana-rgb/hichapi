'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Send, ShoppingCart, X, Plus, Minus, ChevronUp, ChevronDown,
  CheckCircle2, Loader2, Utensils, SplitSquareHorizontal, Receipt,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CartItem {
  menu_item_id: string
  name: string
  quantity: number
  unit_price: number
  note?: string
}

interface Message {
  id: string
  role: 'user' | 'chapi'
  text: string
  action?: string
  loading?: boolean
}

type OrderStatus = 'idle' | 'confirming' | 'sent' | 'splitting'

// ── Mock menu (replace with Supabase fetch) ───────────────────────────────────

const MOCK_RESTAURANT = {
  name: 'El Rincón de Don José',
  tableLabel: 'Mesa 4',
  neighborhood: 'Providencia',
}

// ── Quick chips by context ────────────────────────────────────────────────────

const INITIAL_CHIPS = [
  '¿Qué recomiendas?',
  'Ver la carta',
  '¿Tienen algo sin gluten?',
  'Algo para compartir',
]

const ORDERING_CHIPS = [
  'Agregar algo más',
  'La cuenta, por favor',
  'Dividir la cuenta',
  '¿Qué tienen de postre?',
]

// ── TypingDots ────────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]"
          style={{ animation: 'chapi-bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
        />
      ))}
      <style>{`
        @keyframes chapi-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </span>
  )
}

// ── Cart drawer ───────────────────────────────────────────────────────────────

function CartDrawer({
  cart,
  open,
  onClose,
  onChangeQty,
  onConfirm,
  onSplit,
  orderStatus,
}: {
  cart: CartItem[]
  open: boolean
  onClose: () => void
  onChangeQty: (id: string, delta: number) => void
  onConfirm: () => void
  onSplit: (n: number) => void
  orderStatus: OrderStatus
}) {
  const [splitN, setSplitN] = useState(2)
  const total = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0)

  if (!open) return null

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#161622] border-t border-white/10 rounded-t-2xl max-h-[80vh] flex flex-col">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-8 h-1 rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/6 shrink-0">
          <h3 className="text-white font-bold">Tu pedido</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X size={18} /></button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 gap-2">
              <Utensils size={20} className="text-white/15" />
              <p className="text-white/25 text-sm">Aún no agregaste nada</p>
            </div>
          ) : cart.map(item => (
            <div key={item.menu_item_id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{item.name}</p>
                {item.note && <p className="text-white/30 text-xs italic">{item.note}</p>}
                <p className="text-[#FF6B35]/80 text-xs font-mono mt-0.5">
                  ${(item.unit_price / 1000).toFixed(1)}k × {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onChangeQty(item.menu_item_id, -1)}
                  className="w-7 h-7 rounded-full bg-white/5 border border-white/10
                             flex items-center justify-center text-white/50
                             hover:border-white/20 hover:text-white transition-colors"
                >
                  <Minus size={11} />
                </button>
                <span className="text-white text-sm font-medium w-4 text-center">{item.quantity}</span>
                <button
                  onClick={() => onChangeQty(item.menu_item_id, +1)}
                  className="w-7 h-7 rounded-full bg-white/5 border border-white/10
                             flex items-center justify-center text-white/50
                             hover:border-white/20 hover:text-white transition-colors"
                >
                  <Plus size={11} />
                </button>
              </div>
              <p className="text-white font-semibold text-sm w-14 text-right shrink-0" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                ${((item.unit_price * item.quantity) / 1000).toFixed(1)}k
              </p>
            </div>
          ))}
        </div>

        {/* Total + actions */}
        {cart.length > 0 && (
          <div className="px-5 py-4 border-t border-white/6 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">Total</span>
              <span className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                ${(total / 1000).toFixed(1)}k
              </span>
            </div>

            {orderStatus === 'splitting' ? (
              <div className="space-y-2">
                <p className="text-white/50 text-xs">¿En cuántas partes?</p>
                <div className="flex items-center gap-2">
                  {[2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setSplitN(n)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all
                        ${splitN === n ? 'bg-[#FF6B35] text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-white/30 text-xs text-center">
                  ${(total / splitN / 1000).toFixed(1)}k por persona
                </p>
                <button
                  onClick={() => onSplit(splitN)}
                  className="w-full py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm
                             hover:bg-[#e85d2a] transition-colors"
                >
                  Confirmar división
                </button>
              </div>
            ) : orderStatus === 'sent' ? (
              <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span className="text-emerald-400 font-semibold text-sm">Pedido enviado a cocina</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => onSplit(0)}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl
                             border border-white/10 text-white/40 text-sm
                             hover:border-white/20 hover:text-white/60 transition-colors"
                >
                  <SplitSquareHorizontal size={14} />
                  Dividir
                </button>
                <button
                  onClick={onConfirm}
                  disabled={orderStatus === 'confirming'}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                             bg-[#FF6B35] text-white font-semibold text-sm
                             hover:bg-[#e85d2a] disabled:opacity-60 transition-colors"
                >
                  {orderStatus === 'confirming'
                    ? <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                    : <><Send size={14} /> Enviar pedido</>
                  }
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Bill modal ────────────────────────────────────────────────────────────────

function BillModal({ cart, onClose }: { cart: CartItem[]; onClose: () => void }) {
  const total = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0)
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#161622] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Receipt size={16} className="text-[#FF6B35]" /> Tu cuenta
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-2">
          {cart.map(item => (
            <div key={item.menu_item_id} className="flex justify-between text-sm">
              <span className="text-white/60">{item.quantity}× {item.name}</span>
              <span className="text-white font-mono">${((item.unit_price * item.quantity) / 1000).toFixed(1)}k</span>
            </div>
          ))}
          <div className="border-t border-white/10 pt-2 flex justify-between">
            <span className="text-white font-semibold">Total</span>
            <span className="text-white font-bold text-lg font-mono">${(total / 1000).toFixed(1)}k</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] transition-colors"
        >
          El garzón viene en un momento
        </button>
        <p className="text-white/20 text-xs text-center">
          También puedes pagar directo con Chapi (próximamente)
        </p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TablePage() {
  const params = useParams()
  const slug    = params.slug as string
  const tableId = params.tableId as string

  const [messages, setMessages]       = useState<Message[]>([
    {
      id: 'welcome',
      role: 'chapi',
      text: `¡Hola! Soy Chapi, tu asistente en ${MOCK_RESTAURANT.name} 🍽️ ¿Qué te apetece hoy? Puedo recomendarte algo, contarte sobre los platos o tomar tu pedido.`,
    },
  ])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [waiting, setWaiting]         = useState(false)
  const [cart, setCart]               = useState<CartItem[]>([])
  const [cartOpen, setCartOpen]       = useState(false)
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('idle')
  const [billOpen, setBillOpen]       = useState(false)
  const [chips, setChips]             = useState(INITIAL_CHIPS)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, waiting])

  const cartTotal = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  const addToCart = useCallback((items: { menu_item_id: string; name: string; quantity: number; unit_price: number; note?: string }[]) => {
    setCart(prev => {
      const next = [...prev]
      items.forEach(item => {
        const idx = next.findIndex(c => c.menu_item_id === item.menu_item_id)
        if (idx >= 0) {
          next[idx] = { ...next[idx], quantity: next[idx].quantity + item.quantity }
        } else {
          next.push(item)
        }
      })
      return next
    })
    setChips(ORDERING_CHIPS)
  }, [])

  function changeQty(id: string, delta: number) {
    setCart(prev => {
      const next = prev.map(c => c.menu_item_id === id ? { ...c, quantity: c.quantity + delta } : c)
        .filter(c => c.quantity > 0)
      if (next.length === 0) setChips(INITIAL_CHIPS)
      return next
    })
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setWaiting(true)

    const history = messages
      .filter(m => !m.loading)
      .map(m => ({ role: m.role === 'chapi' ? 'assistant' : 'user' as const, content: m.text }))

    try {
      const res = await fetch('/api/chat/table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          restaurant_slug: slug,
          table_id: tableId,
          cart,
          history,
        }),
      })

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let chapiMsgId = (Date.now() + 1).toString()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let event = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            event = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))

            if (event === 'token') {
              setWaiting(false)
              setMessages(prev => {
                const existing = prev.find(m => m.id === chapiMsgId)
                if (existing) {
                  return prev.map(m => m.id === chapiMsgId ? { ...m, text: data.text } : m)
                }
                return [...prev, { id: chapiMsgId, role: 'chapi', text: data.text }]
              })

            } else if (event === 'done') {
              setWaiting(false)
              setMessages(prev =>
                prev.map(m => m.id === chapiMsgId
                  ? { ...m, text: data.message, action: data.action }
                  : m
                )
              )

              if (data.action === 'add_items' && data.items_to_add?.length > 0) {
                addToCart(data.items_to_add)
                setTimeout(() => setCartOpen(true), 600)
              }

              if (data.action === 'request_bill') {
                setBillOpen(true)
              }

              if (data.action === 'request_split') {
                setOrderStatus('splitting')
                setCartOpen(true)
              }

            } else if (event === 'error') {
              setWaiting(false)
              setMessages(prev => [...prev, { id: chapiMsgId, role: 'chapi', text: data.message }])
            }
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'chapi',
        text: 'Ups, algo salió mal. ¿Me lo dices de nuevo?',
      }])
    } finally {
      setLoading(false)
      setWaiting(false)
      inputRef.current?.focus()
    }
  }

  async function confirmOrder() {
    setOrderStatus('confirming')
    // In production: POST to /api/orders with cart + table_id
    await new Promise(r => setTimeout(r, 1200))
    setOrderStatus('sent')
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'chapi',
      text: `¡Perfecto! Tu pedido ya está en cocina 🔥 ${cart.map(c => `${c.quantity}× ${c.name}`).join(', ')}. ¿Algo más mientras esperas?`,
    }])
    setTimeout(() => {
      setCartOpen(false)
      setOrderStatus('idle')
    }, 2000)
  }

  function handleSplit(n: number) {
    if (n === 0) {
      setOrderStatus('splitting')
    } else {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'chapi',
        text: `¡Listo! Cuenta dividida en ${n} partes: $${(cartTotal / n / 1000).toFixed(1)}k por persona. Le aviso al garzón 🙌`,
      }])
      setCartOpen(false)
      setOrderStatus('idle')
    }
  }

  return (
    <div className="relative flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3
                      border-b border-white/5 bg-[#0A0A14]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FF6B35] flex items-center justify-center
                          text-white font-bold text-sm shrink-0">
            hi
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">{MOCK_RESTAURANT.name}</p>
            <p className="text-white/35 text-[10px]">
              {MOCK_RESTAURANT.tableLabel} · {MOCK_RESTAURANT.neighborhood}
            </p>
          </div>
        </div>

        {/* Cart button */}
        <button
          onClick={() => setCartOpen(true)}
          className={`relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all
            ${cartCount > 0
              ? 'bg-[#FF6B35]/15 border border-[#FF6B35]/30 text-[#FF6B35]'
              : 'bg-white/5 border border-white/8 text-white/30'}`}
        >
          <ShoppingCart size={15} />
          {cartCount > 0 && (
            <>
              <span className="text-sm font-semibold">${(cartTotal / 1000).toFixed(1)}k</span>
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#FF6B35]
                               text-white text-[9px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            </>
          )}
        </button>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'chapi' && (
              <div className="w-6 h-6 rounded-full bg-[#FF6B35] flex items-center justify-center
                              text-white text-[9px] font-bold shrink-0 mt-0.5 mr-2">
                C
              </div>
            )}
            <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
              ${msg.role === 'user'
                ? 'bg-[#FF6B35] text-white rounded-br-sm'
                : 'bg-[#1C1C2E] text-white/85 border border-white/5 rounded-bl-sm'}`}>
              {msg.text}
            </div>
          </div>
        ))}

        {/* Typing dots */}
        {waiting && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-[#FF6B35] flex items-center justify-center
                            text-white text-[9px] font-bold shrink-0 mt-0.5 mr-2">C</div>
            <div className="bg-[#1C1C2E] border border-white/5 px-4 py-3 rounded-2xl rounded-bl-sm">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick chips ─────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="shrink-0 px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {chips.map(chip => (
            <button
              key={chip}
              onClick={() => sendMessage(chip)}
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/8
                         text-white/50 hover:border-[#FF6B35]/40 hover:text-[#FF6B35]
                         transition-colors whitespace-nowrap"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-5 pt-2 bg-[#0A0A14] border-t border-white/5">
        <div className="flex items-center gap-2 bg-[#161622] border border-white/8 rounded-2xl px-4 py-2.5
                        focus-within:border-[#FF6B35]/40 transition-colors">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Dile a Chapi qué quieres pedir..."
            disabled={loading}
            className="flex-1 bg-transparent text-white text-sm placeholder:text-white/20
                       focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-xl bg-[#FF6B35] flex items-center justify-center
                       disabled:opacity-30 hover:bg-[#e85d2a] transition-colors shrink-0"
          >
            {loading
              ? <Loader2 size={14} className="text-white animate-spin" />
              : <Send size={14} className="text-white" />
            }
          </button>
        </div>
      </div>

      {/* ── Cart drawer ─────────────────────────────────────────────────────── */}
      <CartDrawer
        cart={cart}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onChangeQty={changeQty}
        onConfirm={confirmOrder}
        onSplit={handleSplit}
        orderStatus={orderStatus}
      />

      {/* ── Bill modal ──────────────────────────────────────────────────────── */}
      {billOpen && (
        <BillModal cart={cart} onClose={() => setBillOpen(false)} />
      )}
    </div>
  )
}
