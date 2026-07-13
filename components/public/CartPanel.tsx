'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ShoppingCart, Plus, Minus, X, Loader2, CheckCircle2, Bike, ChevronRight, MapPin, Search } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrderableItem {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  tags: string[]
  available: boolean
  photo_url: string | null
}

interface CartItem extends OrderableItem {
  quantity: number
}

interface CartProps {
  restaurantId: string
  restaurantName: string
  restaurantAddress: string
}

interface MapboxFeature {
  id: string
  place_name: string
  text: string
  center: [number, number] // [lng, lat]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

// ── Address Autocomplete Input ────────────────────────────────────────────────

function AddressAutocomplete({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
}) {
  const [query, setQuery]           = useState(value)
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([])
  const [loading, setLoading]       = useState(false)
  const [open, setOpen]             = useState(false)
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef                  = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleInput(val: string) {
    setQuery(val)
    onChange(val) // keep parent in sync as user types
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length < 3) { setSuggestions([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      if (!MAPBOX_TOKEN) return
      setLoading(true)
      try {
        const bbox = '-71.25,-30.63,-71.15,-30.55' // Ovalle bbox — keeps results local
        const url  = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(val)}.json?access_token=${MAPBOX_TOKEN}&country=cl&language=es&bbox=${bbox}&limit=5`
        const res  = await fetch(url)
        const data = await res.json()
        const features: MapboxFeature[] = data.features ?? []
        setSuggestions(features)
        setOpen(features.length > 0)
      } finally {
        setLoading(false)
      }
    }, 320)
  }

  function selectSuggestion(feature: MapboxFeature) {
    const val = feature.place_name
    setQuery(val)
    onChange(val)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder ?? 'Ej: Ariztía 100, Ovalle'}
          autoComplete="off"
          className="w-full pl-9 pr-4 py-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
        />
        {loading && (
          <Loader2 size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] animate-spin" />
        )}
      </div>

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden">
          {suggestions.map(feature => (
            <button
              key={feature.id}
              type="button"
              onClick={() => selectSuggestion(feature)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[var(--surface-sunken)] transition-colors text-left border-b border-[var(--border-subtle)] last:border-0"
            >
              <MapPin size={13} className="text-[#E55A2B] shrink-0 mt-0.5" />
              <span className="text-[var(--text-strong)] text-sm leading-snug">{feature.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Cart State ────────────────────────────────────────────────────────────────

let globalAddToCart: ((item: OrderableItem) => void) | null = null
export function addToCart(item: OrderableItem) {
  globalAddToCart?.(item)
}

// ── MenuItem Card ─────────────────────────────────────────────────────────────

export function MenuItemCard({ item }: { item: OrderableItem }) {
  const [adding, setAdding] = useState(false)

  function handleAdd() {
    if (!item.available) return
    setAdding(true)
    globalAddToCart?.(item)
    setTimeout(() => setAdding(false), 600)
  }

  const isPromoted = item.tags?.includes('promovido')

  return (
    <div
      className={`group relative flex items-start gap-4 p-4 rounded-2xl border transition-all duration-200
        ${item.available
          ? 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] hover:border-[#FF6B35]/30 hover:bg-[#FF6B35]/5 cursor-pointer'
          : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] opacity-50'}`}
      onClick={handleAdd}
      id={`menu-item-${item.id}`}
      role="button"
      tabIndex={item.available ? 0 : -1}
      onKeyDown={e => e.key === 'Enter' && handleAdd()}
    >
      {item.photo_url && (
        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-[var(--border-subtle)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          {isPromoted && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#E55A2B] font-semibold border border-[#FF6B35]/20">
              ⭐ Chapi recomienda
            </span>
          )}
          {!item.available && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-muted)] font-medium">
              Agotado
            </span>
          )}
        </div>
        <p className={`text-sm font-semibold leading-tight ${item.available ? 'text-[var(--text-strong)]' : 'text-[var(--text-muted)] line-through'}`}>
          {item.name}
        </p>
        {item.description && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed line-clamp-2">{item.description}</p>
        )}
        {item.tags && item.tags.filter(t => t !== 'promovido').length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.tags.filter(t => t !== 'promovido').map(t => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-muted)] font-medium capitalize">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-2">
        <p className="text-sm font-bold text-[var(--text-strong)] font-mono">{formatCLP(item.price)}</p>
        {item.available && (
          <button
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 shrink-0
              ${adding
                ? 'bg-green-500/20 border border-green-500/30'
                : 'bg-[#FF6B35]/15 border border-[#FF6B35]/30 group-hover:bg-[#FF6B35] group-hover:border-[#FF6B35]'}`}
            onClick={e => { e.stopPropagation(); handleAdd() }}
            aria-label={`Agregar ${item.name} al carrito`}
          >
            {adding
              ? <CheckCircle2 size={14} className="text-green-700" />
              : <Plus size={14} className="text-[#E55A2B] group-hover:text-[var(--text-strong)] transition-colors" />}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Cart Panel ────────────────────────────────────────────────────────────────

type OrderStep = 'cart' | 'checkout' | 'success'

const inputCls = 'w-full px-4 py-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF6B35]/50 transition-colors'

export default function CartPanel({ restaurantId, restaurantName }: CartProps) {
  const [items, setItems]           = useState<CartItem[]>([])
  const [open, setOpen]             = useState(false)
  const [step, setStep]             = useState<OrderStep>('cart')
  const [submitting, setSubmitting] = useState(false)
  const [orderId, setOrderId]       = useState<string | null>(null)

  // Form fields
  const [clientName,  setClientName]  = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [street,      setStreet]      = useState('')   // autocomplete field
  const [comuna,      setComuna]      = useState('')
  const [references,  setReferences]  = useState('')   // Dpto / referencias
  const [notes,       setNotes]       = useState('')
  const [formError,   setFormError]   = useState<string | null>(null)

  const addItem = useCallback((item: OrderableItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id)
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { ...item, quantity: 1 }]
    })
  }, [])
  globalAddToCart = addItem

  // Listen for add-to-cart events dispatched by LightMenuItemCard (light theme)
  useEffect(() => {
    function handleEvent(e: Event) {
      const item = (e as CustomEvent<OrderableItem>).detail
      if (item) addItem(item)
    }
    window.addEventListener('hichapi:addToCart', handleEvent)
    return () => window.removeEventListener('hichapi:addToCart', handleEvent)
  }, [addItem])

  function updateQty(id: string, delta: number) {
    setItems(prev =>
      prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
          .filter(i => i.quantity > 0)
    )
  }

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  // Build full address from structured fields
  const fullAddress = [street.trim(), referencias(references), comuna.trim()].filter(Boolean).join(', ')
  function referencias(r: string) { return r.trim() ? `(${r.trim()})` : '' }

  async function handlePlaceOrder() {
    setFormError(null)
    if (!clientName.trim())                        { setFormError('Escribe tu nombre'); return }
    if (!clientPhone.trim() || clientPhone.length < 8) { setFormError('Ingresa un teléfono válido'); return }
    if (!street.trim() || street.trim().length < 5)    { setFormError('Ingresa tu dirección (calle y número)'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/public/order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id:    restaurantId,
          client_name:      clientName.trim(),
          client_phone:     clientPhone.trim(),
          delivery_address: fullAddress,
          notes:            notes.trim() || undefined,
          items: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar el pedido')
      setOrderId(data.order_id)
      setStep('success')
      setItems([])
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function resetCart() {
    setStep('cart'); setOpen(false); setOrderId(null)
    setClientName(''); setClientPhone(''); setStreet(''); setComuna(''); setReferences(''); setNotes('')
    setFormError(null)
  }

  return (
    <>
      {/* ── Floating Cart FAB ── */}
      {count > 0 && (
        <button
          id="cart-fab"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-[#FF6B35] text-white shadow-xl shadow-[#FF6B35]/30 hover:bg-[#e85d2a] transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <ShoppingCart size={18} />
          <span className="font-semibold text-sm">{count} {count === 1 ? 'producto' : 'productos'}</span>
          <span className="font-bold text-sm">{formatCLP(total)}</span>
        </button>
      )}

      {/* ── Drawer ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => step !== 'success' && setOpen(false)} />

          <div className="relative ml-auto w-full max-w-md h-full bg-[var(--bg-canvas)] border-l border-[var(--border-subtle)] flex flex-col shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-subtle)] shrink-0">
              <div className="flex items-center gap-3">
                {step === 'cart'     && <ShoppingCart  size={18} className="text-[#E55A2B]"  />}
                {step === 'checkout' && <Bike          size={18} className="text-[#E55A2B]"  />}
                {step === 'success'  && <CheckCircle2  size={18} className="text-green-700"  />}
                <p className="text-[var(--text-strong)] font-bold text-base">
                  {step === 'cart'     && 'Tu pedido'}
                  {step === 'checkout' && 'Datos de entrega'}
                  {step === 'success'  && '¡Pedido recibido!'}
                </p>
              </div>
              <button onClick={() => step === 'success' ? resetCart() : setOpen(false)} className="w-8 h-8 rounded-lg bg-[var(--surface-sunken)] hover:bg-[var(--surface-sunken)] flex items-center justify-center transition-colors">
                <X size={16} className="text-[var(--text-muted)]" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">

              {/* ── CART ── */}
              {step === 'cart' && (
                <div className="p-6 space-y-3">
                  {items.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                      <ShoppingCart size={40} className="text-[var(--text-muted)] mx-auto" />
                      <p className="text-[var(--text-muted)] text-sm">Tu carrito está vacío</p>
                      <p className="text-[var(--text-muted)] text-xs">Agrega platos desde la carta</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-semibold mb-4">{restaurantName}</p>
                      {items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)]">
                          <div className="flex-1 min-w-0">
                            <p className="text-[var(--text-strong)] text-sm font-medium truncate">{item.name}</p>
                            <p className="text-[var(--text-muted)] text-xs">{formatCLP(item.price)} c/u</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-lg bg-[var(--surface-sunken)] hover:bg-[var(--surface-sunken)] flex items-center justify-center transition-colors">
                              <Minus size={12} className="text-[var(--text-muted)]" />
                            </button>
                            <span className="text-[var(--text-strong)] text-sm font-bold w-5 text-center">{item.quantity}</span>
                            <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-lg bg-[#FF6B35]/15 hover:bg-[#FF6B35]/25 flex items-center justify-center transition-colors">
                              <Plus size={12} className="text-[#E55A2B]" />
                            </button>
                          </div>
                          <p className="text-[var(--text-strong)] font-bold text-sm w-20 text-right shrink-0">{formatCLP(item.price * item.quantity)}</p>
                        </div>
                      ))}
                      <div className="border-t border-[var(--border-subtle)] pt-4 mt-4 space-y-1.5">
                        <div className="flex justify-between text-[var(--text-muted)] text-xs"><span>Subtotal</span><span>{formatCLP(total)}</span></div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-strong)] font-bold text-base">Total</span>
                          <span className="text-[#E55A2B] font-bold text-base">{formatCLP(total)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── CHECKOUT ── */}
              {step === 'checkout' && (
                <div className="p-6 space-y-5">
                  {/* Order summary */}
                  <div className="p-4 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] space-y-2">
                    {items.map(item => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-[var(--text-muted)]">{item.quantity}× {item.name}</span>
                        <span className="text-[var(--text-strong)] font-medium">{formatCLP(item.price * item.quantity)}</span>
                      </div>
                    ))}
                    <div className="border-t border-[var(--border-subtle)] pt-2 flex justify-between font-bold">
                      <span className="text-[var(--text-strong)]">Total</span>
                      <span className="text-[#E55A2B]">{formatCLP(total)}</span>
                    </div>
                  </div>

                  {/* Form */}
                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="text-[var(--text-muted)] text-xs font-medium block mb-1.5">Tu nombre *</label>
                      <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                        placeholder="Ej: María González" className={inputCls} />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="text-[var(--text-muted)] text-xs font-medium block mb-1.5">Teléfono *</label>
                      <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                        placeholder="+56 9 1234 5678" className={inputCls} />
                    </div>

                    {/* Street autocomplete */}
                    <div>
                      <label className="text-[var(--text-muted)] text-xs font-medium block mb-1.5">
                        Dirección (calle y número) *
                      </label>
                      <AddressAutocomplete
                        value={street}
                        onChange={setStreet}
                        placeholder="Ej: Ariztía 100"
                      />
                      <p className="text-[var(--text-muted)] text-[10px] mt-1">Escribe para ver sugerencias de calles</p>
                    </div>

                    {/* Comuna */}
                    <div>
                      <label className="text-[var(--text-muted)] text-xs font-medium block mb-1.5">Ciudad / Comuna</label>
                      <input type="text" value={comuna} onChange={e => setComuna(e.target.value)}
                        placeholder="Ovalle" className={inputCls} />
                    </div>

                    {/* References */}
                    <div>
                      <label className="text-[var(--text-muted)] text-xs font-medium block mb-1.5">Número Dpto y/o referencias</label>
                      <input type="text" value={references} onChange={e => setReferences(e.target.value)}
                        placeholder="Depto 305, casa azul, portón negro…" className={inputCls} />
                    </div>

                    {/* Full address preview */}
                    {street.trim().length > 3 && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FF6B35]/8 border border-[#FF6B35]/20">
                        <MapPin size={13} className="text-[#E55A2B] shrink-0 mt-0.5" />
                        <p className="text-[var(--text-body)] text-xs leading-relaxed">{fullAddress || '—'}</p>
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <label className="text-[var(--text-muted)] text-xs font-medium block mb-1.5">Notas del pedido (opcional)</label>
                      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                        placeholder="Sin cebolla, bien cocido, etc."
                        className="w-full px-4 py-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF6B35]/50 resize-none transition-colors" />
                    </div>

                    {formError && (
                      <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
                        <p className="text-red-700 text-sm">{formError}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── SUCCESS ── */}
              {step === 'success' && (
                <div className="p-6 flex flex-col items-center justify-center text-center space-y-4 min-h-64 pt-16">
                  <div className="w-20 h-20 rounded-full bg-green-500/15 border-2 border-green-500/30 flex items-center justify-center animate-pulse">
                    <CheckCircle2 size={36} className="text-green-700" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-[var(--text-strong)] font-bold text-xl">¡Pedido enviado!</h3>
                    <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                      Tu pedido fue recibido por <span className="text-[var(--text-strong)] font-medium">{restaurantName}</span>.
                      Un repartidor será asignado pronto.
                    </p>
                    {orderId && <p className="text-[var(--text-muted)] text-xs font-mono mt-3">#{orderId.slice(-8).toUpperCase()}</p>}
                  </div>
                  <div className="w-full pt-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20">
                      <Bike size={18} className="text-[#E55A2B] shrink-0" />
                      <p className="text-[var(--text-body)] text-sm text-left">Estamos buscando un repartidor disponible para tu pedido.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-[var(--border-subtle)] shrink-0 space-y-2">
              {step === 'cart' && items.length > 0 && (
                <button id="checkout-btn" onClick={() => setStep('checkout')}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#FF6B35] text-white font-bold text-base hover:bg-[#e85d2a] transition-all hover:scale-[1.02] active:scale-95">
                  Continuar con el pedido <ChevronRight size={18} />
                </button>
              )}
              {step === 'checkout' && (
                <>
                  <button id="place-order-btn" onClick={handlePlaceOrder} disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#FF6B35] text-white font-bold text-base hover:bg-[#e85d2a] disabled:opacity-60 transition-all hover:scale-[1.02] active:scale-95 disabled:hover:scale-100">
                    {submitting
                      ? <><Loader2 size={18} className="animate-spin" /> Enviando…</>
                      : <><Bike size={18} /> Confirmar pedido</>}
                  </button>
                  <button onClick={() => setStep('cart')} className="w-full py-2 text-[var(--text-muted)] text-sm hover:text-[var(--text-body)] transition-colors">
                    ← Volver al carrito
                  </button>
                </>
              )}
              {step === 'success' && (
                <button id="new-order-btn" onClick={resetCart}
                  className="w-full py-4 rounded-2xl border border-[var(--border-subtle)] text-[var(--text-body)] font-semibold text-sm hover:border-[var(--border-subtle)] hover:text-[var(--text-strong)] transition-colors">
                  Hacer otro pedido
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
