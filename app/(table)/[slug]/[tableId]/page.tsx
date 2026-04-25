'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Send, ShoppingCart, X, Plus, Minus, CheckCircle2,
  Loader2, Utensils, SplitSquareHorizontal, Receipt,
  Trash2, Bell, BookOpen,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/i18n'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CartItem {
  menu_item_id: string
  name: string
  quantity: number
  unit_price: number
  note?: string
}

interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number
  category: string | null
  photo_url: string | null
  tags: string[] | null
}

interface Message {
  id: string
  role: 'user' | 'chapi'
  text: string
  action?: string
  loading?: boolean
  /** When present, render an inline menu grid after the bubble */
  menuItems?: MenuItem[]
}

type OrderStatus = 'idle' | 'confirming' | 'sent' | 'splitting'
type SplitMode = 'equal' | 'byItem'

// ── CLP formatter ─────────────────────────────────────────────────────────────

const clp = (amount: number) => formatCurrency(amount)

// ── Quick chips ───────────────────────────────────────────────────────────────

const INITIAL_CHIPS = [
  '⭐ ¿Qué recomiendas?',
  '📋 Ver la carta',
  '🌱 ¿Tienen algo sin gluten?',
  '🍽️ Algo para compartir',
]

const ORDERING_CHIPS = [
  '➕ Agregar algo más',
  '🧾 La cuenta, por favor',
  '✂️ Dividir la cuenta',
  '🍰 ¿Qué tienen de postre?',
]

// Map category → emoji for prettier inline menu cards
const CATEGORY_EMOJI: Record<string, string> = {
  entrada:   '🥗',
  entradas:  '🥗',
  principal: '🍽️',
  principales: '🍽️',
  postre:    '🍰',
  postres:   '🍰',
  bebida:    '🥤',
  bebidas:   '🥤',
  trago:     '🍹',
  tragos:    '🍹',
  vino:      '🍷',
  vinos:     '🍷',
  cerveza:   '🍺',
  cervezas:  '🍺',
  cafe:      '☕',
  café:      '☕',
  cafés:     '☕',
  pizza:     '🍕',
  pizzas:    '🍕',
  hamburguesa: '🍔',
  hamburguesas: '🍔',
  sandwich:  '🥪',
  sandwiches:'🥪',
  pasta:     '🍝',
  pastas:    '🍝',
  sushi:     '🍣',
  carne:     '🥩',
  carnes:    '🥩',
  pescado:   '🐟',
  pescados:  '🐟',
  ensalada:  '🥗',
  ensaladas: '🥗',
  sopa:      '🍲',
  sopas:     '🍲',
}
function categoryEmoji(cat?: string | null) {
  if (!cat) return '🍴'
  return CATEGORY_EMOJI[cat.trim().toLowerCase()] ?? '🍴'
}

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

// ── Inline menu preview (shown in chat when user asks for the card) ──────────

/**
 * Carta colapsable por secciones con cart acumulativo.
 * - Cada sección es un acordeón (primera abierta por defecto).
 * - Cada plato muestra qty actual + botones +/- para sumar/restar.
 * - Footer sticky con total + botón "Pedir N items".
 */
function MenuPreview({
  items,
  cart,
  onAdd,
  onRemove,
  onConfirm,
  confirming,
}: {
  items:      MenuItem[]
  cart:       CartItem[]
  onAdd:      (item: MenuItem) => void
  onRemove:   (menuItemId: string) => void
  onConfirm:  () => void
  confirming: boolean
}) {
  // Group by category, preservando orden original
  const groupOrder: string[] = []
  const groups: Record<string, MenuItem[]> = {}
  for (const it of items) {
    const cat = (it.category?.trim() || 'Platos')
    if (!groups[cat]) {
      groups[cat] = []
      groupOrder.push(cat)
    }
    groups[cat].push(it)
  }

  // Primera sección abierta por defecto
  const [openSection, setOpenSection] = useState<string | null>(groupOrder[0] ?? null)

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)
  const cartTotal = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0)

  function getQty(itemId: string): number {
    return cart.find(c => c.menu_item_id === itemId)?.quantity ?? 0
  }

  return (
    <div className="mt-2 bg-[#0F0F1A] border border-white/8 rounded-xl overflow-hidden">
      <div className="max-h-[55vh] overflow-y-auto divide-y divide-white/5">
        {groupOrder.map(cat => {
          const list = groups[cat]
          const isOpen = openSection === cat
          // Cuántos items de esta sección están en el cart (badge)
          const inSection = list.reduce((s, it) => s + getQty(it.id), 0)

          return (
            <div key={cat}>
              <button
                type="button"
                onClick={() => setOpenSection(isOpen ? null : cat)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/3 transition-colors text-left"
              >
                <span className="text-base">{categoryEmoji(cat)}</span>
                <span className="text-white text-[12px] font-semibold flex-1 truncate uppercase tracking-wide">
                  {cat}
                </span>
                <span className="text-white/30 text-[10px] tabular-nums shrink-0">
                  {list.length}
                </span>
                {inSection > 0 && (
                  <span className="bg-[#FF6B35] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                    {inSection}
                  </span>
                )}
                <ChevronDownIcon open={isOpen} />
              </button>

              {isOpen && (
                <div className="px-2 pb-2 space-y-1.5 bg-black/20">
                  {list.map(it => {
                    const qty = getQty(it.id)
                    return (
                      <div
                        key={it.id}
                        className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${
                          qty > 0 ? 'bg-[#FF6B35]/10 border border-[#FF6B35]/25' : 'bg-white/3 border border-white/5'
                        }`}
                      >
                        {it.photo_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={it.photo_url}
                            alt={it.name}
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-lg shrink-0">
                            {categoryEmoji(cat)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-[12px] font-semibold leading-tight">
                            {it.name}
                          </p>
                          {it.description && (
                            <p className="text-white/40 text-[10px] leading-snug mt-0.5 line-clamp-2">
                              {it.description}
                            </p>
                          )}
                          <p className="text-[#FF6B35] text-[12px] font-bold font-mono mt-1">
                            {clp(it.price)}
                          </p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {qty > 0 ? (
                            <div className="flex items-center gap-1 bg-white/8 rounded-full p-0.5">
                              <button
                                onClick={() => onRemove(it.id)}
                                className="w-6 h-6 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center"
                                aria-label={`Quitar uno de ${it.name}`}
                              >
                                <span className="text-sm leading-none">−</span>
                              </button>
                              <span className="text-white font-bold text-xs w-5 text-center tabular-nums">
                                {qty}
                              </span>
                              <button
                                onClick={() => onAdd(it)}
                                className="w-6 h-6 rounded-full bg-[#FF6B35] text-white hover:bg-[#e85d2a] transition-colors flex items-center justify-center"
                                aria-label={`Agregar otro de ${it.name}`}
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => onAdd(it)}
                              className="w-7 h-7 rounded-full bg-[#FF6B35] text-white flex items-center justify-center hover:bg-[#e85d2a] transition-colors shrink-0"
                              aria-label={`Agregar ${it.name}`}
                            >
                              <Plus size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer sticky con total + botón Pedir */}
      {cartCount > 0 ? (
        <div className="bg-[#161622] border-t border-[#FF6B35]/30 p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-white/50 text-[10px] uppercase tracking-wide">
              Tu pedido ({cartCount} {cartCount === 1 ? 'item' : 'items'})
            </p>
            <p className="text-white font-bold text-base font-mono">
              {clp(cartTotal)}
            </p>
          </div>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="px-5 py-3 rounded-xl bg-[#FF6B35] text-white font-bold text-sm hover:bg-[#e85d2a] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {confirming ? (
              <><Loader2 size={14} className="animate-spin" /> Enviando…</>
            ) : (
              <>Pedir →</>
            )}
          </button>
        </div>
      ) : (
        <div className="bg-[#161622]/50 border-t border-white/8 px-3 py-2.5">
          <p className="text-white/35 text-[11px] text-center">
            Toca <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#FF6B35] text-white text-[9px] font-bold align-middle">+</span> para agregar al pedido
          </p>
        </div>
      )}
    </div>
  )
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`text-white/40 shrink-0 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}



// ── Cart drawer ───────────────────────────────────────────────────────────────

function CartDrawer({
  cart,
  open,
  onClose,
  onChangeQty,
  onClearCart,
  onConfirm,
  onSplit,
  orderStatus,
}: {
  cart: CartItem[]
  open: boolean
  onClose: () => void
  onChangeQty: (id: string, delta: number) => void
  onClearCart: () => void
  onConfirm: () => void
  onSplit: (mode: SplitMode, n?: number, assignments?: Record<string, 'A' | 'B'>) => void
  orderStatus: OrderStatus
}) {
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  const [splitN, setSplitN] = useState(2)
  // by-item split: map menu_item_id → 'A' | 'B'
  const [assignments, setAssignments] = useState<Record<string, 'A' | 'B'>>({})

  const total = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0)

  // Reset split state when drawer opens/closes
  useEffect(() => {
    if (!open) {
      setSplitMode('equal')
      setSplitN(2)
      setAssignments({})
    }
  }, [open])

  // Init assignments when entering by-item mode
  useEffect(() => {
    if (orderStatus === 'splitting' && splitMode === 'byItem') {
      const init: Record<string, 'A' | 'B'> = {}
      cart.forEach(c => { init[c.menu_item_id] = 'A' })
      setAssignments(init)
    }
  }, [splitMode, orderStatus, cart])

  if (!open) return null

  const totalA = cart.filter(c => assignments[c.menu_item_id] !== 'B')
    .reduce((s, c) => s + c.unit_price * c.quantity, 0)
  const totalB = cart.filter(c => assignments[c.menu_item_id] === 'B')
    .reduce((s, c) => s + c.unit_price * c.quantity, 0)

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#161622] border-t border-white/10 rounded-t-2xl max-h-[85vh] flex flex-col">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-8 h-1 rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/6 shrink-0">
          <h3 className="text-white font-bold">Tu pedido</h3>
          <div className="flex items-center gap-2">
            {cart.length > 0 && orderStatus === 'idle' && (
              <button
                onClick={onClearCart}
                className="flex items-center gap-1 text-white/25 text-xs hover:text-red-400 transition-colors px-2 py-1"
              >
                <Trash2 size={11} /> Vaciar
              </button>
            )}
            <button onClick={onClose} className="text-white/30 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 gap-2">
              <Utensils size={20} className="text-white/15" />
              <p className="text-white/25 text-sm">Aún no agregaste nada</p>
            </div>
          ) : orderStatus === 'splitting' && splitMode === 'byItem' ? (
            /* ── By-item split ── */
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">Cuenta A</span>
                <span className="text-white/20 text-xs">vs</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">Cuenta B</span>
                <span className="text-white/30 text-[10px] ml-auto">Toca para asignar</span>
              </div>
              {cart.map(item => {
                const side = assignments[item.menu_item_id] ?? 'A'
                return (
                  <button
                    key={item.menu_item_id}
                    onClick={() => setAssignments(prev => ({
                      ...prev,
                      [item.menu_item_id]: prev[item.menu_item_id] === 'B' ? 'A' : 'B',
                    }))}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left
                      ${side === 'A'
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : 'bg-violet-500/10 border-violet-500/30'}`}
                  >
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0
                      ${side === 'A' ? 'bg-blue-500/30 text-blue-200' : 'bg-violet-500/30 text-violet-200'}`}>
                      {side}
                    </span>
                    <span className="flex-1 text-white text-xs font-medium truncate">{item.name}</span>
                    <span className="text-white/50 text-xs font-mono shrink-0">
                      {item.quantity > 1 && `${item.quantity}× `}{clp(item.unit_price * item.quantity)}
                    </span>
                  </button>
                )
              })}
              <div className="flex gap-2 pt-1">
                <div className="flex-1 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 text-center">
                  <p className="text-[9px] text-blue-300/70 uppercase tracking-wide">Cuenta A</p>
                  <p className="text-blue-200 font-bold text-sm font-mono">{clp(totalA)}</p>
                </div>
                <div className="flex-1 bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2 text-center">
                  <p className="text-[9px] text-violet-300/70 uppercase tracking-wide">Cuenta B</p>
                  <p className="text-violet-200 font-bold text-sm font-mono">{clp(totalB)}</p>
                </div>
              </div>
            </>
          ) : (
            /* ── Normal item list ── */
            cart.map(item => (
              <div key={item.menu_item_id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{item.name}</p>
                  {item.note && <p className="text-white/30 text-xs italic">{item.note}</p>}
                  <p className="text-[#FF6B35]/80 text-xs font-mono mt-0.5">
                    {clp(item.unit_price)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onChangeQty(item.menu_item_id, -1)}
                    className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:border-white/20 hover:text-white transition-colors"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="text-white text-sm font-medium w-4 text-center">{item.quantity}</span>
                  <button
                    onClick={() => onChangeQty(item.menu_item_id, +1)}
                    className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:border-white/20 hover:text-white transition-colors"
                  >
                    <Plus size={11} />
                  </button>
                </div>
                <p className="text-white font-semibold text-sm w-16 text-right shrink-0" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                  {clp(item.unit_price * item.quantity)}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Total + actions */}
        {cart.length > 0 && (
          <div className="px-5 py-4 border-t border-white/6 space-y-3 shrink-0">
            {/* Total */}
            {orderStatus !== 'splitting' || splitMode !== 'byItem' ? (
              <div className="flex items-center justify-between">
                <span className="text-white/50 text-sm">Total</span>
                <span className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                  {clp(total)}
                </span>
              </div>
            ) : null}

            {orderStatus === 'splitting' ? (
              <div className="space-y-3">
                {/* Mode toggle */}
                <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
                  <button
                    onClick={() => setSplitMode('equal')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${splitMode === 'equal' ? 'bg-[#FF6B35] text-white' : 'text-white/40 hover:text-white/60'}`}
                  >
                    Por igual
                  </button>
                  <button
                    onClick={() => setSplitMode('byItem')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${splitMode === 'byItem' ? 'bg-[#FF6B35] text-white' : 'text-white/40 hover:text-white/60'}`}
                  >
                    Por plato
                  </button>
                </div>

                {splitMode === 'equal' ? (
                  <>
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
                      {clp(Math.round(total / splitN))} por persona
                    </p>
                  </>
                ) : (
                  <p className="text-white/40 text-xs text-center">
                    Toca cada plato para asignarlo a Cuenta A o B
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => onSplit(
                      splitMode,
                      splitMode === 'equal' ? splitN : undefined,
                      splitMode === 'byItem' ? assignments : undefined
                    )}
                    className="flex-1 py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] transition-colors"
                  >
                    Confirmar división
                  </button>
                  <button
                    onClick={() => onSplit('equal', 0)}
                    className="px-4 py-3 rounded-xl border border-white/10 text-white/40 text-sm hover:border-white/20 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : orderStatus === 'sent' ? (
              <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span className="text-emerald-400 font-semibold text-sm">Pedido enviado a cocina</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => onSplit('equal', 0)}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-white/10 text-white/40 text-sm hover:border-white/20 hover:text-white/60 transition-colors"
                >
                  <SplitSquareHorizontal size={14} />
                  Dividir
                </button>
                <button
                  onClick={onConfirm}
                  disabled={orderStatus === 'confirming'}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] disabled:opacity-60 transition-colors"
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

interface ServerOrder {
  id: string
  status: string
  total: number
  order_items: Array<{
    id: string
    name: string
    quantity: number
    unit_price: number
  }>
}

function BillModal({
  tableId,
  cart,
  onClose,
  onRequestBill,
}: {
  tableId: string
  cart: CartItem[]
  onClose: () => void
  onRequestBill: () => void
}) {
  const [serverOrders, setServerOrders] = useState<ServerOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingOrders(true)

    // Reintenta hasta 3 veces con backoff de 600ms — cubre la race condition
    // donde el modal se abre justo cuando el order recién se creó server-side
    // y aún no es visible a la query (commit lag, replicación, etc).
    async function fetchWithRetry() {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`/api/orders?table_id=${encodeURIComponent(tableId)}`)
          const j = await res.json()
          const orders = (j.orders ?? []) as ServerOrder[]
          if (cancelled) return
          if (orders.length > 0 || attempt === 2) {
            setServerOrders(orders)
            setLoadingOrders(false)
            return
          }
          // Vacío y no es el último intento → esperar antes de reintentar
          await new Promise(r => setTimeout(r, 600))
        } catch {
          if (cancelled) return
          if (attempt === 2) {
            setServerOrders([])
            setLoadingOrders(false)
          }
        }
      }
    }
    fetchWithRetry()

    return () => { cancelled = true }
  }, [tableId])

  // Compute line items from SERVER data (source of truth); fallback to local cart
  // only if server returns nothing (e.g., very first order, not yet saved).
  const serverLines = serverOrders.flatMap(o =>
    (o.order_items ?? []).map(it => ({
      id:         it.id,
      name:       it.name,
      quantity:   it.quantity,
      unit_price: it.unit_price,
    })),
  )
  const items = serverLines.length > 0
    ? serverLines
    : cart.map(c => ({
        id:         c.menu_item_id,
        name:       c.name,
        quantity:   c.quantity,
        unit_price: c.unit_price,
      }))

  const serverTotal = serverOrders.reduce((s, o) => s + (o.total ?? 0), 0)
  const total = serverTotal > 0
    ? serverTotal
    : items.reduce((s, c) => s + c.unit_price * c.quantity, 0)

  function handleRequest() {
    onRequestBill()
    setRequested(true)
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#161622] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Receipt size={16} className="text-[#FF6B35]" /> Tu cuenta
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X size={16} /></button>
        </div>

        {loadingOrders ? (
          <div className="flex items-center justify-center py-8 text-white/40 text-sm">
            Cargando tu cuenta…
          </div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-white/60 text-sm">Todavía no hay pedidos registrados en esta mesa.</p>
            <p className="text-white/30 text-xs">Cuando el garzón confirme tu comanda, aparecerá el detalle acá.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-white/60">{item.quantity}× {item.name}</span>
                <span className="text-white font-mono">{clp(item.unit_price * item.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-white/10 pt-2 flex justify-between">
              <span className="text-white font-semibold">Total</span>
              <span className="text-white font-bold text-lg font-mono">{clp(total)}</span>
            </div>
            {serverOrders.length > 1 && (
              <p className="text-white/30 text-[11px] text-center">
                Incluye {serverOrders.length} comandas activas en la mesa
              </p>
            )}
          </div>
        )}

        {requested ? (
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25">
            <Bell size={14} className="text-emerald-400" />
            <span className="text-emerald-400 text-sm font-semibold">El garzón ya viene</span>
          </div>
        ) : (
          <button
            onClick={handleRequest}
            disabled={loadingOrders || items.length === 0}
            className="w-full py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Pedir la cuenta al garzón
          </button>
        )}
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

  const [restaurantName, setRestaurantName] = useState('el restaurante')
  const [restaurantPhoto, setRestaurantPhoto] = useState<string | null>(null)

  const [messages, setMessages]       = useState<Message[]>([{
    id: 'welcome',
    role: 'chapi',
    text: '¡Hola! Soy Chapi 🍽️ ¿Qué te apetece hoy? Puedes tocar 📋 Carta arriba para ver todo, pedirme una recomendación ⭐ o decirme qué quieres y lo agrego al pedido 🙌',
  }])
  const [input, setInput]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [waiting, setWaiting]         = useState(false)
  const [cart, setCart]               = useState<CartItem[]>([])
  const [cartOpen, setCartOpen]       = useState(false)
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('idle')
  const [orderId, setOrderId]         = useState<string | null>(null)
  const [billOpen, setBillOpen]       = useState(false)
  const [chips, setChips]             = useState(INITIAL_CHIPS)
  const [menu, setMenu]               = useState<MenuItem[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)

  // Refs siempre con el valor más reciente — para usar en handlers async
  // (closures de fetch streaming) sin sufrir stale closures de React.
  const cartRef    = useRef<CartItem[]>([])
  const orderIdRef = useRef<string | null>(null)
  useEffect(() => { cartRef.current    = cart    }, [cart])
  useEffect(() => { orderIdRef.current = orderId }, [orderId])

  const router = useRouter()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, waiting])

  // Fetch restaurant branding + menu on mount (header + review page share this)
  useEffect(() => {
    if (!slug) return
    const supabase = createClient()
    let cancelled = false
    ;(async () => {
      const { data: rest } = await supabase
        .from('restaurants')
        .select('id, name, photo_url')
        .eq('slug', slug)
        .single()
      if (cancelled || !rest) return
      if (rest.name) setRestaurantName(rest.name)
      if (rest.photo_url) setRestaurantPhoto(rest.photo_url)

      // Cargar menú ordenado por categoría y nombre
      type MenuRow = MenuItem & { available?: boolean; ingredients?: unknown }
      const { data: menuData, error: menuError } = await supabase
        .from('menu_items')
        .select('id, name, description, price, category, photo_url, tags, available, ingredients')
        .eq('restaurant_id', rest.id)
        .eq('available', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true })

      if (menuError) {
        console.error('[table] menu fetch error:', menuError.message)
      }

      const menuItems = (menuData || []) as unknown as MenuRow[]

      if (cancelled) return
      if (menuItems.length > 0) {
        setMenu(menuItems.map(it => ({
          id: it.id,
          name: it.name,
          description: it.description,
          price: it.price,
          category: it.category,
          photo_url: it.photo_url,
          tags: it.tags,
        })))
      } else {
        console.warn('[table] menu fetch returned 0 items for slug=', slug)
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  const showMenu = useCallback(() => {
    if (menu.length === 0) {
      setMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        role: 'chapi',
        text: 'La carta aún se está preparando 🧑‍🍳 Puedes preguntarme qué recomiendo.',
      }])
      return
    }
    setMessages(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      role: 'chapi',
      text: '¡Aquí tienes la carta! 📋 Toca el + para agregar al pedido:',
      menuItems: menu,
    }])
  }, [menu])

  // ── Polling fallback para detectar status=paid (2026-04-22) ──────────
  // Por defecto, Supabase Realtime filtra los eventos postgres_changes por
  // las RLS policies de la tabla. La tabla `orders` tiene policy
  // staff_read_orders que exige is_team_member() — los clientes QR son
  // anon, no pasan ese check, y por tanto NUNCA reciben los eventos de
  // UPDATE aunque la publication esté habilitada.
  //
  // Workaround: polling al endpoint público /api/orders?table_id=X (que usa
  // admin client en server-side, así que siempre devuelve data). Cada 5s
  // chequeamos si hay alguna orden con status='paid'. Si aparece una que
  // no vimos antes → redirigimos al review.
  //
  // El listener Realtime de abajo sigue activo por si RLS cambia más
  // adelante o se agrega una policy permisiva — ambos caminos redirigen.
  useEffect(() => {
    if (!tableId || !slug) return
    let cancelled = false
    const seenPaid = new Set<string>()

    async function pollPaidOrders() {
      try {
        // include_recent_paid=1 es crítico: sin el flag el endpoint filtra
        // status IN ('paid','cancelled'). Cuando admin marca paid la orden
        // "desaparece" del fetch y el polling nunca detecta la transicion.
        // Con el flag, las orders paid siguen visibles los ultimos 10min.
        const url = `/api/orders?table_id=${encodeURIComponent(tableId)}&include_recent_paid=1`
        const res = await fetch(url)
        if (cancelled) return
        const j = await res.json()
        const orders = (j.orders ?? []) as Array<{ id: string; status: string }>
        for (const o of orders) {
          if (o.status === 'paid' && !seenPaid.has(o.id)) {
            seenPaid.add(o.id)
            router.push(`/${slug}/review?order=${o.id}`)
            return
          }
        }
      } catch {
        // Non-blocking: el poll siguiente vuelve a intentar
      }
    }

    pollPaidOrders()
    const interval = setInterval(pollPaidOrders, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [tableId, slug, router])

  // Subscribe to order status changes — cuando admin marca 'paid', redirigir
  // a la página de review para que el cliente deje su evaluación.
  //
  // IMPORTANTE: La reseña solo se muestra cuando la MESA vuelve a 'libre',
  // no cuando se pagan las órdenes individuales. Esto permite que el garzón
  // cobre múltiples órdenes de la misma mesa antes de cerrarla.
  useEffect(() => {
    if (!tableId) return
    let cancelled = false
    const supabase = createClient()

    // Set para trackear órdenes pagadas en esta sesión
    const paidOrdersInSession = new Set<string>()

    async function run() {
      // Resolver el qr_token (puede ser UUID ya, o token legible)
      let realTableUuid = tableId
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableId)
      if (!isUUID) {
        const { data } = await supabase
          .from('tables')
          .select('id')
          .eq('qr_token', tableId)
          .maybeSingle()
        if (data?.id) realTableUuid = data.id
      }
      if (cancelled) return

      const ch = supabase
        .channel(`table-orders-${realTableUuid}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders' },
          payload => {
            const row = (payload.new as { id?: string; status?: string; table_id?: string } | null)

            // Filtrar solo órdenes de esta mesa
            if (!row?.id || row.table_id !== realTableUuid) {
              return
            }

            const oid = row.id

            // Handle paying status — show message to client
            if (row.status === 'paying') {
              setMessages(prev => [...prev, {
                id: `paying-${oid}-${Date.now()}`,
                role: 'chapi' as const,
                text: '¡El garzón ya está procesando tu cuenta! 🧾 En un momento te confirma el total.',
              }])
              return
            }

            // Handle paid status — redirect to review immediately
            if (row.status === 'paid') {
              // Guardar el orderId en el Set para fallback de "mesa libre"
              // (antes nunca se populaba, lo que hacía inútil el handler de
              // postgres_changes sobre tables). Ahora sí: si la redirección
              // directa falla por cualquier motivo, el handler de "mesa libre"
              // tiene el orderId más reciente para redirigir.
              paidOrdersInSession.add(oid)
              // Redirigir inmediatamente cuando la orden se marca como pagada
              router.push(`/${slug}/review?order=${oid}`)
              return
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'tables' },
          payload => {
            const row = payload.new as { id?: string; status?: string; updated_at?: string } | null

            // Filtrar solo esta mesa
            if (row?.id !== realTableUuid) {
              return
            }

            // Si la mesa vuelve a libre, también podemos redirigir
            if (row?.status === 'libre') {
              if (paidOrdersInSession.size > 0) {
                const firstPaidOrder = Array.from(paidOrdersInSession)[0]
                router.push(`/${slug}/review?order=${firstPaidOrder}`)
              }
            }
          }
        )
        .subscribe()

      return () => { supabase.removeChannel(ch) }
    }

    const cleanup = run()
    return () => {
      cancelled = true
      cleanup.then(fn => fn && fn())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, slug, router])

  // ── Initialize table state on mount ──────────────────────────────────────────
  // Fix: if the client scans the QR when the table already has active orders,
  // the UI should reflect that state instead of starting from scratch.
  useEffect(() => {
    if (!tableId || !slug) return
    let cancelled = false
    const supabase = createClient()

    async function initTableState() {
      // 1. Resolve qr_token → real table UUID
      let realTableUuid = tableId
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableId)
      if (!isUUID) {
        const { data } = await supabase
          .from('tables')
          .select('id, status')
          .eq('qr_token', tableId)
          .maybeSingle()
        if (cancelled) return
        if (data?.id) realTableUuid = data.id
      }

      // 2. Load active orders for this table
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, total, order_items(id, name, quantity, unit_price)')
        .eq('table_id', realTableUuid)
        .not('status', 'in', '("paid","cancelled")')
        .order('created_at', { ascending: false })

      if (cancelled || !orders || orders.length === 0) return

      // 3. Update state: mark that there's an active order
      const activeOrder = orders[0] as { id: string; status: string; total: number }
      setOrderId(activeOrder.id)
      setOrderStatus('sent')

      // 4. Show contextual message in chat
      setMessages(prev => [...prev, {
        id: `existing-order-${Date.now()}`,
        role: 'chapi' as const,
        text: '¡Hola! Ya hay un pedido abierto en esta mesa 🍽️ Puedes agregar más cosas o pedir la cuenta cuando quieras.',
      }])
      setChips(ORDERING_CHIPS)
    }

    initTableState()
    return () => { cancelled = true }
  }, [tableId, slug])

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

  function clearCart() {
    setCart([])
    setChips(INITIAL_CHIPS)
    setOrderStatus('idle')
    setCartOpen(false)
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    // Intercept "Ver carta" chip — render the menu inline instead of hitting the LLM
    const normalized = text.trim().toLowerCase().replace(/[📋⭐🌱🍽️➕🧾✂️🍰]/g, '').trim()
    if (normalized === 'ver la carta' || normalized === 'ver carta' || normalized === 'menu' || normalized === 'menú') {
      setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, role: 'user', text: text.trim() }])
      setInput('')
      showMenu()
      return
    }

    // Intercept billing intent — más confiable que esperar que Chapi devuelva
    // action='request_bill'. Normalizamos quitando puntuación primero.
    const cleaned = normalized.replace(/[,.!?¿¡]/g, '').replace(/\s+/g, ' ').trim()
    const isBillingIntent =
      /\b(la\s+)?cuenta(\s+por\s+favor)?\b/i.test(cleaned) && cleaned.length < 30 ||
      /\b(quiero\s+)?(pagar|cobrar)\b/i.test(cleaned) && cleaned.length < 30 ||
      /\bcu[áa]nto\s+(es|sale|me\s+sale)\b/i.test(cleaned) ||
      /\b(la\s+)?nota\s+por\s+favor\b/i.test(cleaned) ||
      /\bpedir\s+(la\s+)?cuenta\b/i.test(cleaned)

    if (isBillingIntent) {
      setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, role: 'user', text: text.trim() }])
      setInput('')
      
      // IMPORTANTE: Marcar que ya procesamos la intención de pagar para evitar
      // que el LLM también ejecute confirmOrder() cuando devuelva action='request_bill'.
      // Esto previene la duplicación de items en la cuenta.
      const alreadyHandled = true
      
      // Usamos refs para garantizar el valor más reciente
      const currentCart = cartRef.current
      const currentOrderId = orderIdRef.current

      let pendingId: string | undefined = currentOrderId ?? undefined
      if (!pendingId && currentCart.length > 0) {
        // Confirmar primero — esto retorna el ID directamente
        const confirmed = await confirmOrder()
        pendingId = confirmed ?? undefined
      }

      // Notificar al garzón
      await requestBill(pendingId)

      // Mensaje empático en el chat
      setMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}-c`,
        role: 'chapi',
        text: pendingId
          ? '¡Listo! Le aviso al garzón que vas a pagar 🙌 Acá está tu cuenta.'
          : currentCart.length === 0
            ? 'Acá está tu cuenta. Si todavía no pediste nada, primero agregá platos del menú 🍽️'
            : 'Acá está tu cuenta. Mostrásela al garzón cuando llegue 🙌',
      }])
      setBillOpen(true)
      
      // Retornar early para que el LLM no procese el mensaje
      // (ya manejamos la intención localmente)
      if (alreadyHandled) return
    }

    const userMsg: Message = { id: `${Date.now()}-${Math.random()}`, role: 'user', text: text.trim() }
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
      const chapiMsgId = `${Date.now()}-${Math.random()}-chapi`
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
                if (existing) return prev.map(m => m.id === chapiMsgId ? { ...m, text: data.text } : m)
                return [...prev, { id: chapiMsgId, role: 'chapi', text: data.text }]
              })

            } else if (event === 'restaurant_info') {
              if (data.name) setRestaurantName(data.name)

            } else if (event === 'done') {
              setWaiting(false)
              setMessages(prev => prev.map(m =>
                m.id === chapiMsgId ? { ...m, text: data.message, action: data.action } : m
              ))

              if (data.action === 'add_items' && data.items_to_add?.length > 0) {
                addToCart(data.items_to_add)
                setTimeout(() => setCartOpen(true), 600)
              }
              if (data.action === 'request_bill') {
                // Usamos refs para evitar stale closure (cart/orderId pueden
                // haber cambiado en medio del stream).
                let pendingOrderId: string | undefined = orderIdRef.current ?? undefined
                const currentCart = cartRef.current
                if (!pendingOrderId && currentCart.length > 0) {
                  const confirmed = await confirmOrder()
                  pendingOrderId = confirmed ?? undefined
                }
                await requestBill(pendingOrderId)
                setBillOpen(true)
              }
              if (data.action === 'request_split') {
                setOrderStatus('splitting')
                setCartOpen(true)
              }
              if (data.action === 'show_menu') {
                showMenu()
              }

            } else if (event === 'error') {
              setWaiting(false)
              setMessages(prev => {
                // Si ya existe el mensaje de Chapi, reemplazarlo con el error
                const existing = prev.find(m => m.id === chapiMsgId)
                if (existing) {
                  return prev.map(m => m.id === chapiMsgId ? { ...m, text: data.message } : m)
                }
                // Si no existe, agregarlo
                return [...prev, { id: chapiMsgId, role: 'chapi', text: data.message }]
              })
            }
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        role: 'chapi',
        text: 'Ups, algo salió mal. ¿Me lo dices de nuevo?',
      }])
    } finally {
      setLoading(false)
      setWaiting(false)
      inputRef.current?.focus()
    }
  }

  /**
   * Crea el pedido en el servidor con el cart actual (vía ref para evitar
   * stale closures). Retorna el orderId (string) en éxito, null en error.
   */
  async function confirmOrder(): Promise<string | null> {
    const cartSnapshot = cartRef.current // SIEMPRE el cart actual, no el del closure
    if (cartSnapshot.length === 0) return null
    setOrderStatus('confirming')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_slug: slug, table_id: tableId, cart: cartSnapshot }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        // Surfacear error específico del backend en vez de mensaje genérico
        const reason  = data.reason as string | undefined
        const errMsg  = data.error  as string | undefined
        const hint    = data.hint   as string | undefined

        let chatMsg: string
        if (reason === 'cash_register_closed') {
          chatMsg = '🔒 El restaurante todavía no abrió la caja del día. Avisá al garzón para que la abran y reintentá en unos minutos.'
        } else if (errMsg) {
          chatMsg = `❌ ${errMsg}${hint ? `\n${hint}` : ''}`
        } else {
          chatMsg = '❌ Hubo un problema al enviar tu pedido. ¿Lo intentamos de nuevo?'
        }

        console.error('[table] confirmOrder rejected:', { status: res.status, data })
        setOrderStatus('idle')
        setMessages(prev => [...prev, {
          id: `${Date.now()}-${Math.random()}`,
          role: 'chapi',
          text: chatMsg,
        }])
        return null
      }

      const newOrderId = (data as { orderId?: string }).orderId
      if (!newOrderId) throw new Error('El servidor no devolvió orderId')

      setOrderId(newOrderId)
      setOrderStatus('sent')
      const orderSummary = cartSnapshot.map(c => `${c.quantity}× ${c.name}`).join(', ')
      setMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        role: 'chapi',
        text: `¡Perfecto! Tu pedido ya está en cocina 🔥 ${orderSummary}. ¿Algo más mientras esperas?`,
      }])
      // Clear cart and close panel — order is placed, prevent duplicate orders
      setCart([])
      setTimeout(() => {
        setCartOpen(false)
        setOrderStatus('idle')
      }, 2000)
      return newOrderId
    } catch (err) {
      console.error('[table] confirmOrder exception:', err)
      setOrderStatus('idle')
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        role: 'chapi',
        text: `❌ No pudimos enviar tu pedido (${msg}). Intentá de nuevo o avisá al garzón.`,
      }])
      return null
    }
  }

  /**
   * Pide la cuenta al garzón (PATCH status=paying → push notification).
   * Si no hay orderId previo Y hay items en el cart, auto-confirma primero.
   * Acepta `existingOrderId` opcional para evitar la race condition de React
   * state cuando el caller acaba de ejecutar confirmOrder().
   */
  async function requestBill(_existingOrderId?: string): Promise<void> {
    void _existingOrderId
    // Si hay items sin confirmar en el cart, los confirmamos primero
    if (cartRef.current.length > 0) {
      await confirmOrder()
    }

    // Llamar al endpoint table-wide: marca TODAS las órdenes activas de la
    // mesa como 'paying' y dispara UNA notificación consolidada al garzón.
    try {
      const res = await fetch('/api/orders/request-bill', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ table_id: tableId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.warn('[table] request-bill failed:', err)
      }
    } catch (err) {
      console.error('[table] request-bill exception:', err)
    }
  }

  function handleSplit(mode: SplitMode, n?: number, assignments?: Record<string, 'A' | 'B'>) {
    // Cancel split
    if (mode === 'equal' && n === 0) {
      setOrderStatus('idle')
      return
    }
    // Enter split mode
    if (mode === 'equal' && n === undefined) {
      setOrderStatus('splitting')
      return
    }

    if (mode === 'equal' && n) {
      setMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        role: 'chapi',
        text: `¡Listo! Cuenta dividida en ${n} partes iguales: ${clp(Math.round(cartTotal / n))} por persona. Le aviso al garzón 🙌`,
      }])
    } else if (mode === 'byItem' && assignments) {
      const totalA = cart.filter(c => assignments[c.menu_item_id] !== 'B')
        .reduce((s, c) => s + c.unit_price * c.quantity, 0)
      const totalB = cart.filter(c => assignments[c.menu_item_id] === 'B')
        .reduce((s, c) => s + c.unit_price * c.quantity, 0)
      setMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        role: 'chapi',
        text: `¡Perfecto! Cuenta A: ${clp(totalA)} · Cuenta B: ${clp(totalB)}. Le aviso al garzón para que traiga las cuentas por separado 🙌`,
      }])
    }

    setCartOpen(false)
    setOrderStatus('idle')
  }

  return (
    <div className="relative flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5 bg-[#0A0A14]">
        <div className="flex items-center gap-2.5 min-w-0">
          {restaurantPhoto ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={restaurantPhoto}
              alt={restaurantName}
              className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[#FF6B35] flex items-center justify-center text-white font-bold text-base shrink-0">
              {(restaurantName?.charAt(0) ?? 'h').toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white text-sm font-bold leading-tight truncate">{restaurantName}</p>
            <p className="text-white/35 text-[10px]">Chapi · tu asistente</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Ver carta button — always available */}
          <button
            onClick={showMenu}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs font-semibold hover:bg-white/8 hover:border-[#FF6B35]/30 hover:text-[#FF6B35] transition-colors"
            aria-label="Ver carta"
          >
            <BookOpen size={13} />
            Carta 📋
          </button>

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
                <span className="text-sm font-semibold">{clp(cartTotal)}</span>
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#FF6B35] text-white text-[9px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
              {msg.role === 'chapi' && (
                <div className="w-6 h-6 rounded-full bg-[#FF6B35] flex items-center justify-center text-white text-[9px] font-bold shrink-0 mt-0.5 mr-2">
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
            {msg.menuItems && msg.menuItems.length > 0 && (
              <div className="w-full pl-8 pr-2">
                <MenuPreview
                  items={msg.menuItems}
                  cart={cart}
                  onAdd={(it) => {
                    addToCart([{ menu_item_id: it.id, name: it.name, quantity: 1, unit_price: it.price }])
                  }}
                  onRemove={(id) => changeQty(id, -1)}
                  onConfirm={() => { void confirmOrder() }}
                  confirming={orderStatus === 'confirming'}
                />
              </div>
            )}
          </div>
        ))}

        {waiting && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-[#FF6B35] flex items-center justify-center text-white text-[9px] font-bold shrink-0 mt-0.5 mr-2">C</div>
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
              className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/8 text-white/50 hover:border-[#FF6B35]/40 hover:text-[#FF6B35] transition-colors whitespace-nowrap"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-5 pt-2 bg-[#0A0A14] border-t border-white/5">
        <div className="flex items-center gap-2 bg-[#161622] border border-white/8 rounded-2xl px-4 py-2.5 focus-within:border-[#FF6B35]/40 transition-colors">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Dile a Chapi qué quieres pedir..."
            disabled={loading}
            className="flex-1 bg-transparent text-white text-sm placeholder:text-white/20 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-xl bg-[#FF6B35] flex items-center justify-center disabled:opacity-30 hover:bg-[#e85d2a] transition-colors shrink-0"
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
        onClearCart={clearCart}
        onConfirm={confirmOrder}
        onSplit={handleSplit}
        orderStatus={orderStatus}
      />

      {/* ── Bill modal ──────────────────────────────────────────────────────── */}
      {billOpen && (
        <BillModal
          tableId={tableId}
          cart={cart}
          onClose={() => setBillOpen(false)}
          onRequestBill={requestBill}
        />
      )}
    </div>
  )
}
