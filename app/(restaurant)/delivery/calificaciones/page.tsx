/**
 * /delivery/calificaciones — Calificaciones de riders y de comensales
 * Requirements: 4.8, 6.1, 6.2, 6.9
 */
'use client'

import { useState, useEffect } from 'react'
import { Star } from 'lucide-react'
import type { RiderRating } from '@/lib/delivery/types'
import type { CustomerRatingForRestaurant } from '@/lib/customer/restaurant-customers'
import { useRestaurant } from '@/lib/restaurant-context'

type Tab = 'riders' | 'comensales'

export default function DeliveryCalificacionesPage() {
  const [tab, setTab] = useState<Tab>('riders')
  const [ratings, setRatings] = useState<RiderRating[]>([])
  const [customerRatings, setCustomerRatings] = useState<CustomerRatingForRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingOrders, setPendingOrders] = useState<{ id: string; client_name: string; delivered_at: string }[]>([])

  const { restaurant } = useRestaurant()

  useEffect(() => {
    if (!restaurant?.id) return

    setLoading(true)
    Promise.all([
      fetch('/api/delivery/ratings', { headers: { 'x-restaurant-id': restaurant.id } }).then(r => r.json()),
      fetch('/api/delivery/orders?status=delivered', { headers: { 'x-restaurant-id': restaurant.id } }).then(r => r.json()),
      fetch('/api/restaurant/customers/ratings', { headers: { 'x-restaurant-id': restaurant.id } }).then(r => r.json()),
    ]).then(([ratingData, orderData, customerData]) => {
      const safeRatings = Array.isArray(ratingData) ? ratingData : []
      const safeOrders = Array.isArray(orderData) ? orderData : []

      setRatings(safeRatings)
      setCustomerRatings(Array.isArray(customerData?.ratings) ? customerData.ratings : [])

      const ratedOrderIds = new Set(safeRatings.map((r: RiderRating) => r.delivery_order_id))
      const now = Date.now()
      const pending = safeOrders.filter((o: { id: string; delivered_at?: string }) =>
        !ratedOrderIds.has(o.id) &&
        o.delivered_at &&
        now - new Date(o.delivered_at).getTime() < 48 * 60 * 60 * 1000,
      )
      setPendingOrders(pending)
    }).catch(err => {
      console.error('Failed to fetch ratings/orders', err)
      setRatings([])
      setCustomerRatings([])
      setPendingOrders([])
    }).finally(() => setLoading(false))
  }, [restaurant?.id])

  async function submitRating(orderId: string, stars: number, comment: string) {
    const res = await fetch('/api/delivery/ratings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-restaurant-id': restaurant?.id ?? '',
      },
      body: JSON.stringify({ delivery_order_id: orderId, stars, comment }),
    })
    if (res.ok) {
      const newRating = await res.json()
      setRatings(prev => [newRating, ...prev])
      setPendingOrders(prev => prev.filter(o => o.id !== orderId))
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Calificaciones</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Evalúa riders y revisa opiniones de comensales</p>
      </div>

      <div className="flex gap-2 border-b border-[var(--border-subtle)] pb-1">
        <button
          type="button"
          onClick={() => setTab('riders')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'riders'
              ? 'text-[#E55A2B] border-b-2 border-[#FF6B35]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
          }`}
        >
          Riders
        </button>
        <button
          type="button"
          onClick={() => setTab('comensales')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'comensales'
              ? 'text-[#E55A2B] border-b-2 border-[#FF6B35]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
          }`}
        >
          Calificaciones de comensales
          {customerRatings.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-violet-500/20 text-violet-700 px-1.5 py-0.5 rounded-full">
              {customerRatings.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'riders' && (
        <>
          {pendingOrders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[var(--text-body)] text-sm font-semibold uppercase tracking-wider">
                Pendientes de calificar
              </h2>
              {pendingOrders.map(order => (
                <RatingForm key={order.id} order={order} onSubmit={submitRating} />
              ))}
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-[var(--text-body)] text-sm font-semibold uppercase tracking-wider">Historial riders</h2>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="bg-[var(--surface-sunken)] rounded-xl h-16 animate-pulse" />)}
              </div>
            ) : ratings.length === 0 ? (
              <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-8 text-center">
                <Star size={28} className="text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-[var(--text-muted)] text-sm">Aún no has calificado ningún rider</p>
              </div>
            ) : (
              ratings.map(rating => (
                <div key={rating.id} className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          size={14}
                          className={s <= rating.stars ? 'text-yellow-700 fill-yellow-400' : 'text-[var(--text-muted)]'}
                        />
                      ))}
                    </div>
                    <span className="text-[var(--text-muted)] text-xs">
                      {new Date(rating.created_at).toLocaleDateString('es-CL')}
                    </span>
                  </div>
                  {rating.comment && (
                    <p className="text-[var(--text-muted)] text-sm mt-2">{rating.comment}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === 'comensales' && (
        <div className="space-y-3">
          <p className="text-[var(--text-muted)] text-xs">
            Opiniones que los comensales dejaron sobre tu local o tus riders (sin datos personales).
          </p>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="bg-[var(--surface-sunken)] rounded-xl h-16 animate-pulse" />)}
            </div>
          ) : customerRatings.length === 0 ? (
            <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-8 text-center">
              <Star size={28} className="text-[var(--text-muted)] mx-auto mb-2" />
              <p className="text-[var(--text-muted)] text-sm">Aún no hay calificaciones de comensales</p>
            </div>
          ) : (
            customerRatings.map(rating => (
              <div key={rating.id} className="bg-[var(--surface-sunken)] border border-violet-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-500/15 px-2 py-0.5 rounded-full">
                      Calificación de comensal
                    </span>
                    <span className="text-[var(--text-muted)] text-[10px]">
                      {rating.entity_type === 'restaurant' ? 'Local' : 'Rider'} · {rating.order_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star
                        key={s}
                        size={14}
                        className={s <= rating.stars ? 'text-yellow-700 fill-yellow-400' : 'text-[var(--text-muted)]'}
                      />
                    ))}
                  </div>
                </div>
                {rating.comment && (
                  <p className="text-[var(--text-muted)] text-sm mt-2">{rating.comment}</p>
                )}
                <p className="text-[var(--text-muted)] text-[10px] mt-2">
                  {new Date(rating.created_at).toLocaleString('es-CL')}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function RatingForm({
  order,
  onSubmit,
}: {
  order: { id: string; client_name: string; delivered_at: string }
  onSubmit: (orderId: string, stars: number, comment: string) => Promise<void>
}) {
  const [stars, setStars] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (stars === 0) return
    setSaving(true)
    await onSubmit(order.id, stars, comment)
    setSaving(false)
  }

  return (
    <div className="bg-[var(--surface-sunken)] border border-[#FF6B35]/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[var(--text-strong)] text-sm font-medium">Pedido de {order.client_name}</p>
        <span className="text-[var(--text-muted)] text-xs">
          Entregado {new Date(order.delivered_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            type="button"
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setStars(s)}
          >
            <Star
              size={22}
              className={s <= (hovered || stars) ? 'text-yellow-700 fill-yellow-400' : 'text-[var(--text-muted)]'}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Comentario opcional…"
        rows={2}
        className="w-full bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-[var(--text-strong)] text-sm resize-none focus:outline-none focus:border-[#FF6B35]"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={stars === 0 || saving}
        className="px-4 py-2 bg-[#FF6B35] text-white rounded-lg text-sm font-medium hover:bg-[#e55a25] transition-colors disabled:opacity-40"
      >
        {saving ? 'Enviando…' : 'Enviar calificación'}
      </button>
    </div>
  )
}
