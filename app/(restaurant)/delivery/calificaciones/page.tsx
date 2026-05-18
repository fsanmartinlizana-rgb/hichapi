/**
 * /delivery/calificaciones — Rating form + history
 * Requirements: 6.1, 6.2, 6.9
 */
'use client'

import { useState, useEffect } from 'react'
import { Star } from 'lucide-react'
import type { RiderRating } from '@/lib/delivery/types'
import { useRestaurant } from '@/lib/restaurant-context'

export default function DeliveryCalificacionesPage() {
  const [ratings, setRatings] = useState<RiderRating[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingOrders, setPendingOrders] = useState<{ id: string; client_name: string; delivered_at: string }[]>([])

  const { restaurant } = useRestaurant()

  useEffect(() => {
    if (!restaurant?.id) return

    Promise.all([
      fetch('/api/delivery/ratings', { headers: { 'x-restaurant-id': restaurant.id } }).then(r => r.json()),
      fetch('/api/delivery/orders?status=delivered', { headers: { 'x-restaurant-id': restaurant.id } }).then(r => r.json()),
    ]).then(([ratingData, orderData]) => {
      const safeRatings = Array.isArray(ratingData) ? ratingData : []
      const safeOrders = Array.isArray(orderData) ? orderData : []
      
      setRatings(safeRatings)
      // Filter orders without ratings and within 48h window
      const ratedOrderIds = new Set(safeRatings.map((r: RiderRating) => r.delivery_order_id))
      const now = Date.now()
      const pending = safeOrders.filter((o: any) =>
        !ratedOrderIds.has(o.id) &&
        o.delivered_at &&
        now - new Date(o.delivered_at).getTime() < 48 * 60 * 60 * 1000,
      )
      setPendingOrders(pending)
    }).catch(err => {
      console.error('Failed to fetch ratings/orders', err)
      setRatings([])
      setPendingOrders([])
    }).finally(() => setLoading(false))
  }, [restaurant?.id])

  async function submitRating(orderId: string, stars: number, comment: string) {
    const res = await fetch('/api/delivery/ratings', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-restaurant-id': restaurant?.id ?? ''
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
        <h1 className="text-2xl font-bold text-white">Calificaciones</h1>
        <p className="text-white/50 text-sm mt-1">Evalúa el servicio de tus repartidores</p>
      </div>

      {/* Pending ratings */}
      {pendingOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-white/70 text-sm font-semibold uppercase tracking-wider">Pendientes de calificar</h2>
          {pendingOrders.map(order => (
            <RatingForm key={order.id} order={order} onSubmit={submitRating} />
          ))}
        </div>
      )}

      {/* Rating history */}
      <div className="space-y-3">
        <h2 className="text-white/70 text-sm font-semibold uppercase tracking-wider">Historial</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="bg-white/5 rounded-xl h-16 animate-pulse" />)}
          </div>
        ) : ratings.length === 0 ? (
          <div className="bg-white/5 border border-white/8 rounded-xl p-8 text-center">
            <Star size={28} className="text-white/20 mx-auto mb-2" />
            <p className="text-white/40 text-sm">Aún no has calificado ningún rider</p>
          </div>
        ) : (
          ratings.map(rating => (
            <div key={rating.id} className="bg-white/5 border border-white/8 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      size={14}
                      className={s <= rating.stars ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}
                    />
                  ))}
                </div>
                <span className="text-white/30 text-xs">
                  {new Date(rating.created_at).toLocaleDateString('es-CL')}
                </span>
              </div>
              {rating.comment && (
                <p className="text-white/60 text-sm mt-2">{rating.comment}</p>
              )}
            </div>
          ))
        )}
      </div>
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
    <div className="bg-white/5 border border-[#FF6B35]/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-white text-sm font-medium">Pedido de {order.client_name}</p>
        <span className="text-white/30 text-xs">
          Entregado {new Date(order.delivered_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setStars(s)}
          >
            <Star
              size={22}
              className={s <= (hovered || stars) ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Comentario opcional…"
        rows={2}
        className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-[#FF6B35]"
      />
      <button
        onClick={handleSubmit}
        disabled={stars === 0 || saving}
        className="px-4 py-2 bg-[#FF6B35] text-white rounded-lg text-sm font-medium hover:bg-[#e55a25] transition-colors disabled:opacity-40"
      >
        {saving ? 'Enviando…' : 'Enviar calificación'}
      </button>
    </div>
  )
}
