/**
 * /delivery/pedidos — Real-time orders table + live map + create order modal
 * Requirements: 7.7, 7.8, 7.9
 *
 * Changelog:
 *  - Fix: Realtime channel now filters by restaurant_id (security bug)
 *  - Add: Status timeline per order
 *  - Add: Automatic rating toast when an order reaches 'delivered'
 *  - Add: Origin indicator (mesa vs delivery directo) + link to comanda
 */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Plus, MapPin, Clock, User, Truck, Star, X, CheckCircle, Package, Navigation } from 'lucide-react'
import type { DeliveryOrder, DeliveryStatus } from '@/lib/delivery/types'
import { useRestaurant } from '@/lib/restaurant-context'

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending_assignment: 'Sin asignar',
  assigned:           'Asignado',
  picked_up:          'Recogido',
  in_transit:         'En camino',
  delivered:          'Entregado',
  cancelled:          'Cancelado',
  failed:             'Fallido',
}

const STATUS_COLORS: Record<DeliveryStatus, string> = {
  pending_assignment: 'bg-amber-500/20 text-amber-700',
  assigned:           'bg-blue-500/20 text-blue-700',
  picked_up:          'bg-purple-500/20 text-purple-700',
  in_transit:         'bg-indigo-500/20 text-indigo-700',
  delivered:          'bg-green-500/20 text-green-700',
  cancelled:          'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
  failed:             'bg-red-500/20 text-red-700',
}

const ACTIVE_STATUSES: DeliveryStatus[] = ['pending_assignment', 'assigned', 'picked_up', 'in_transit']

const TIMELINE_STEPS: { status: DeliveryStatus; label: string; icon: typeof Truck }[] = [
  { status: 'pending_assignment', label: 'Pendiente', icon: Clock },
  { status: 'assigned',           label: 'Asignado',  icon: User },
  { status: 'picked_up',          label: 'Recogido',  icon: Package },
  { status: 'in_transit',         label: 'En camino', icon: Navigation },
  { status: 'delivered',          label: 'Entregado', icon: CheckCircle },
]

const STATUS_RANK: Record<DeliveryStatus, number> = {
  pending_assignment: 0,
  assigned:           1,
  picked_up:          2,
  in_transit:         3,
  delivered:          4,
  cancelled:          -1,
  failed:             -1,
}

// ── Rating Toast ───────────────────────────────────────────────────────────────

function RatingToast({
  order,
  restaurantId,
  onDismiss,
}: {
  order: DeliveryOrder
  restaurantId: string
  onDismiss: () => void
}) {
  const [stars, setStars] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    if (stars === 0) return
    setSaving(true)
    try {
      await fetch('/api/delivery/ratings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-restaurant-id': restaurantId },
        body:    JSON.stringify({ delivery_order_id: order.id, stars, comment: '' }),
      })
      setDone(true)
      setTimeout(onDismiss, 1200)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-[var(--surface-card)] border border-[#FF6B35]/30 rounded-2xl p-5 shadow-2xl w-80 animate-in slide-in-from-bottom-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[var(--text-strong)] font-semibold text-sm">Califica al rider</p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">Pedido de {order.client_name} — entregado</p>
        </div>
        <button onClick={onDismiss} className="text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-colors">
          <X size={16} />
        </button>
      </div>

      {done ? (
        <div className="flex items-center gap-2 text-green-700 text-sm py-2">
          <CheckCircle size={16} />
          <span>¡Gracias por calificar!</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setStars(s)}
                className="p-0.5"
              >
                <Star
                  size={24}
                  className={s <= (hovered || stars)
                    ? 'text-yellow-700 fill-yellow-400'
                    : 'text-[var(--text-muted)]'}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onDismiss}
              className="flex-1 py-2 rounded-lg bg-[var(--surface-sunken)] text-[var(--text-muted)] text-sm hover:bg-[var(--surface-sunken)] transition-colors"
            >
              Después
            </button>
            <button
              onClick={handleSubmit}
              disabled={stars === 0 || saving}
              className="flex-1 py-2 rounded-lg bg-[#FF6B35] text-white text-sm font-medium hover:bg-[#e55a25] transition-colors disabled:opacity-40"
            >
              {saving ? 'Enviando…' : 'Calificar'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Timeline ───────────────────────────────────────────────────────────────────

function OrderTimeline({ order }: { order: DeliveryOrder }) {
  if (order.status === 'cancelled' || order.status === 'failed') {
    return (
      <div className="flex items-center gap-1.5 mt-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
        {order.status === 'failed' && (
          <span className="text-red-700/60 text-xs">{order.failure_reason?.replace(/_/g, ' ')}</span>
        )}
      </div>
    )
  }

  const currentRank = STATUS_RANK[order.status]

  return (
    <div className="flex items-center gap-0 mt-3">
      {TIMELINE_STEPS.map((step, i) => {
        const stepRank  = STATUS_RANK[step.status]
        const completed = stepRank < currentRank
        const active    = stepRank === currentRank
        const Icon      = step.icon

        return (
          <div key={step.status} className="flex items-center">
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                completed ? 'bg-green-500/30 text-green-700' :
                active    ? 'bg-[#FF6B35]/20 text-[#E55A2B] ring-1 ring-[#FF6B35]/50' :
                            'bg-[var(--surface-sunken)] text-[var(--text-muted)]'
              }`}>
                <Icon size={12} />
              </div>
              <span className={`text-[9px] font-medium ${
                completed ? 'text-green-700/70' :
                active    ? 'text-[#E55A2B]' :
                            'text-[var(--text-muted)]'
              }`}>
                {step.label}
              </span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div className={`h-px w-6 mb-3.5 transition-colors ${completed ? 'bg-green-500/40' : 'bg-[var(--surface-sunken)]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DeliveryPedidosPage() {
  const [orders, setOrders]       = useState<DeliveryOrder[]>([])
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter]       = useState<'active' | 'all'>('active')
  const [ratingToast, setRatingToast] = useState<DeliveryOrder | null>(null)

  // Track which delivery order IDs we've already prompted to rate so we
  // don't show the toast twice in the same session.
  const ratedPromptedIds = useRef<Set<string>>(new Set())

  const { restaurant } = useRestaurant()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const loadOrders = useCallback(async () => {
    if (!restaurant?.id) return
    const res = await fetch(
      filter === 'active'
        ? '/api/delivery/orders?status=pending_assignment,assigned,picked_up,in_transit'
        : '/api/delivery/orders',
      { headers: { 'x-restaurant-id': restaurant.id } }
    )
    if (res.ok) {
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } else {
      setOrders([])
    }
  }, [filter, restaurant?.id])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // ── Supabase Realtime — filtered by restaurant_id (security fix) ──────────
  useEffect(() => {
    if (!restaurant?.id) return

    const channel = supabase
      .channel(`delivery-orders-${restaurant.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'delivery_orders',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        payload => {
          if (payload.eventType === 'INSERT') {
            setOrders(prev => [payload.new as DeliveryOrder, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as DeliveryOrder
            setOrders(prev =>
              prev.map(o => o.id === updated.id ? updated : o),
            )
            // Show rating toast when order is delivered (once per session)
            if (
              updated.status === 'delivered' &&
              !ratedPromptedIds.current.has(updated.id)
            ) {
              ratedPromptedIds.current.add(updated.id)
              setRatingToast(updated)
            }
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== payload.old.id))
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, restaurant?.id])

  const displayed = filter === 'active'
    ? orders.filter(o => ACTIVE_STATUSES.includes(o.status))
    : orders

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)]">Pedidos de Delivery</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Monitoreo en tiempo real</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] text-white rounded-lg text-sm font-medium hover:bg-[#e55a25] transition-colors"
        >
          <Plus size={14} /> Nuevo pedido
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['active', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              filter === f ? 'bg-[#FF6B35] text-white' : 'bg-[var(--surface-sunken)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]'
            }`}
          >
            {f === 'active' ? 'Activos' : 'Todos'}
          </button>
        ))}
      </div>

      {/* Orders table */}
      {displayed.length === 0 ? (
        <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-12 text-center">
          <Truck size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-muted)]">No hay pedidos {filter === 'active' ? 'activos' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(order => (
            <div
              key={order.id}
              className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-4 hover:bg-[var(--surface-sunken)] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                    <span className="text-[var(--text-muted)] text-xs">
                      {new Date(order.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {/* Origin badge */}
                    {order.order_id ? (
                      <a
                        href={`/comandas?focus=${order.order_id}`}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 hover:bg-violet-500/25 transition-colors"
                      >
                        📋 Ver comanda
                      </a>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] text-[var(--text-muted)]">
                        Delivery manual
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[var(--text-body)] text-sm">
                    <User size={12} className="shrink-0" />
                    <span className="truncate">{order.client_name}</span>
                    <span className="text-[var(--text-muted)]">·</span>
                    <span className="text-[var(--text-muted)] text-xs">{order.client_phone}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-[var(--text-muted)] text-xs">
                    <MapPin size={11} className="shrink-0 mt-0.5" />
                    <span className="truncate">{order.delivery_address}</span>
                  </div>

                  {/* Timeline */}
                  <OrderTimeline order={order} />
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[var(--text-strong)] font-semibold">
                    ${order.total_clp.toLocaleString('es-CL')}
                  </p>
                  {order.delivery_fee_clp && (
                    <p className="text-[var(--text-muted)] text-xs">
                      +${order.delivery_fee_clp.toLocaleString('es-CL')} delivery
                    </p>
                  )}
                  {order.status === 'delivered' && order.delivered_at && (
                    <p className="text-green-700/60 text-xs mt-1">
                      {new Date(order.delivered_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create order modal */}
      {showModal && (
        <CreateOrderModal
          onClose={() => setShowModal(false)}
          onCreated={loadOrders}
          restaurantId={restaurant?.id ?? ''}
        />
      )}

      {/* Rating toast — auto-appears when a delivery reaches 'delivered' */}
      {ratingToast && restaurant?.id && (
        <RatingToast
          order={ratingToast}
          restaurantId={restaurant.id}
          onDismiss={() => setRatingToast(null)}
        />
      )}
    </div>
  )
}

function CreateOrderModal({
  onClose,
  onCreated,
  restaurantId,
}: {
  onClose: () => void
  onCreated: () => void
  restaurantId: string
}) {
  const [form, setForm] = useState({
    pickup_address:   '',
    delivery_address: '',
    client_name:      '',
    client_phone:     '',
    total_clp:        0,
    notes:            '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/delivery/orders', {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-restaurant-id': restaurantId,
        },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        let errMsg = 'Error al crear el pedido'
        if (typeof data.error === 'string') {
          errMsg = data.error
        } else if (data.error && typeof data.error === 'object') {
          if (data.error.fieldErrors) {
            errMsg = Object.entries(data.error.fieldErrors)
              .map(([field, msgs]) => `${field}: ${(msgs as any).join(', ')}`)
              .join(' | ')
          } else {
            errMsg = JSON.stringify(data.error)
          }
        }
        setError(errMsg)
        return
      }
      onCreated()
      onClose()
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-[var(--text-strong)] font-bold text-lg">Nuevo pedido de delivery</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { key: 'pickup_address',   label: 'Dirección de recogida',  type: 'text' },
            { key: 'delivery_address', label: 'Dirección de entrega',   type: 'text' },
            { key: 'client_name',      label: 'Nombre del cliente',     type: 'text' },
            { key: 'client_phone',     label: 'Teléfono del cliente',   type: 'tel' },
            { key: 'total_clp',        label: 'Total del pedido (CLP)', type: 'number' },
            { key: 'notes',            label: 'Notas (opcional)',        type: 'text' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="text-[var(--text-muted)] text-xs mb-1 block">{label}</label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={e => setForm(f => ({
                  ...f,
                  [key]: type === 'number' ? parseInt(e.target.value, 10) || 0 : e.target.value,
                }))}
                className="w-full bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[var(--text-strong)] text-sm focus:outline-none focus:border-[#FF6B35]"
                required={key !== 'notes'}
              />
            </div>
          ))}
          {error && <p className="text-red-700 text-xs">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-[var(--surface-sunken)] text-[var(--text-muted)] text-sm hover:bg-[var(--surface-sunken)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[#FF6B35] text-white text-sm font-medium hover:bg-[#e55a25] transition-colors disabled:opacity-50"
            >
              {saving ? 'Creando…' : 'Crear pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
