'use client'

import { useState } from 'react'
import { Star, Loader2 } from 'lucide-react'
import type { OrderType, RatingEntityType } from '@/lib/customer/types'

interface Props {
  orderId: string
  orderType: OrderType
  restaurantId: string
  restaurantName: string
  riderId?: string | null
  onSubmitted?: () => void
}

export function CustomerRatingForm({
  orderId,
  orderType,
  restaurantId,
  restaurantName,
  riderId,
  onSubmitted,
}: Props) {
  const [entityType, setEntityType] = useState<RatingEntityType>(
    orderType === 'delivery' && riderId ? 'rider' : 'restaurant',
  )
  const [stars, setStars] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit() {
    if (stars < 1) return
    setSaving(true)
    setError(null)
    try {
      const entity_id = entityType === 'rider' && riderId ? riderId : restaurantId
      const res = await fetch('/api/customer/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id,
          order_id: orderId,
          order_type: orderType,
          stars,
          comment: comment.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo enviar la calificación')
        return
      }
      setDone(true)
      onSubmitted?.()
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <p className="text-emerald-700 text-sm bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
        ¡Gracias por tu calificación!
      </p>
    )
  }

  return (
    <div className="bg-violet-500/10 border border-violet-500/25 rounded-2xl p-5 space-y-4">
      <p className="text-[var(--text-strong)] font-semibold text-sm">¿Cómo fue tu experiencia?</p>

      {orderType === 'delivery' && riderId && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEntityType('restaurant')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium border ${
              entityType === 'restaurant'
                ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40 text-[#E55A2B]'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
            }`}
          >
            {restaurantName}
          </button>
          <button
            type="button"
            onClick={() => setEntityType('rider')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium border ${
              entityType === 'rider'
                ? 'bg-[#FF6B35]/15 border-[#FF6B35]/40 text-[#E55A2B]'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
            }`}
          >
            Repartidor
          </button>
        </div>
      )}

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setStars(s)}
          >
            <Star
              size={28}
              className={
                s <= (hover || stars)
                  ? 'text-yellow-700 fill-yellow-400'
                  : 'text-[var(--text-muted)]'
              }
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentario opcional…"
        rows={2}
        className="w-full px-3 py-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm resize-none focus:outline-none focus:border-[#FF6B35]/40"
      />

      {error && <p className="text-red-700 text-xs">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={stars < 1 || saving}
        className="w-full py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
        Enviar calificación
      </button>
    </div>
  )
}
