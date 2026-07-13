'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Star, Check, Heart, MessageCircle, Clock, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ── Inner ─────────────────────────────────────────────────────────────────────

function ReviewInner() {
  const params       = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const slug         = params?.slug
  const orderId      = searchParams.get('order')

  const [rating, setRating]       = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Restaurant branding
  const [restaurantName, setRestaurantName] = useState<string>('')
  const [photoUrl, setPhotoUrl]             = useState<string | null>(null)
  const [loading, setLoading]               = useState(true)

  useEffect(() => {
    (async () => {
      if (!slug) return
      const supabase = createClient()
      const { data } = await supabase
        .from('restaurants')
        .select('name, photo_url')
        .eq('slug', slug)
        .single()
      if (data) {
        setRestaurantName(data.name)
        setPhotoUrl(data.photo_url)
      }
      setLoading(false)
    })()
  }, [slug])

  async function handleSubmit() {
    if (!orderId || !slug || rating === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/reviews/post-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id:        orderId,
          restaurant_slug: slug,
          rating,
          comment,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'No se pudo enviar tu reseña')
        return
      }
      setSubmitted(true)
    } catch {
      setError('Sin conexión. Intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  // ── Missing order id ────────────────────────────────────────────────────
  if (!orderId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center mb-3">
          <MessageCircle size={22} className="text-[var(--text-muted)]" />
        </div>
        <h1 className="text-[var(--text-strong)] text-lg font-bold">Nada que reseñar aún</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1 max-w-xs">
          Necesitamos el identificador de tu pedido para cargar la reseña.
        </p>
      </div>
    )
  }

  // ── Loading restaurant ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={22} className="text-[#E55A2B] animate-spin" />
      </div>
    )
  }

  // ── Thank-you state ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
          <Check size={28} className="text-emerald-700" strokeWidth={3} />
        </div>
        <h1 className="text-[var(--text-strong)] text-xl font-bold">¡Gracias por tu reseña!</h1>
        <p className="text-[var(--text-muted)] text-sm mt-2 max-w-xs leading-relaxed">
          Nos ayudas a mejorar y a que más personas descubran lugares como{' '}
          <span className="text-[var(--text-strong)] font-semibold">{restaurantName}</span>.
        </p>
        <div className="flex items-center gap-1.5 mt-4 text-[var(--text-muted)] text-xs">
          <Heart size={11} className="text-[#E55A2B]" fill="#FF6B35" />
          Chapi
        </div>
      </div>
    )
  }

  // ── Review form ──────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-md mx-auto p-6 space-y-6">

        {/* Header with branding */}
        <div className="text-center pt-6">
          {photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photoUrl}
              alt={restaurantName}
              className="w-20 h-20 rounded-full object-cover mx-auto border-2 border-[var(--border-subtle)]"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#FF6B35]/20 border-2 border-[#FF6B35]/30 flex items-center justify-center mx-auto">
              <span className="text-[#E55A2B] text-2xl font-bold">
                {restaurantName ? restaurantName.charAt(0) : 'R'}
              </span>
            </div>
          )}
          <h1 className="text-[var(--text-strong)] text-xl font-bold mt-4">{restaurantName}</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">¿Cómo estuvo tu experiencia?</p>
        </div>

        {/* Rating stars */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3, 4, 5].map(n => {
            const filled = (hoverRating || rating) >= n
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 transition-transform active:scale-90"
              >
                <Star
                  size={36}
                  className={filled ? 'text-amber-700' : 'text-[var(--text-muted)]'}
                  fill={filled ? '#FBBF24' : 'transparent'}
                  strokeWidth={1.5}
                />
              </button>
            )
          })}
        </div>

        {/* Rating label */}
        {rating > 0 && (
          <p className="text-center text-sm font-medium -mt-2" style={{
            color: rating >= 4 ? '#34D399' : rating === 3 ? '#FBBF24' : '#F87171',
          }}>
            {rating === 5 && '¡Excelente! Lo amamos'}
            {rating === 4 && 'Muy bueno'}
            {rating === 3 && 'Estuvo bien'}
            {rating === 2 && 'Podría mejorar'}
            {rating === 1 && 'No nos gustó'}
          </p>
        )}

        {/* Comment */}
        <div className="space-y-2">
          <label className="text-[var(--text-muted)] text-xs font-medium">
            Cuéntanos más (opcional)
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="¿Qué tal la comida, el servicio, el ambiente…?"
            rows={4}
            maxLength={1000}
            className="w-full bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[var(--text-strong)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF6B35]/50 transition-colors resize-none"
          />
          <p className="text-right text-[var(--text-muted)] text-[10px]">{comment.length}/1000</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={rating === 0 || saving}
          className="w-full py-3.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <><Clock size={15} className="animate-spin" /> Enviando…</>
          ) : (
            'Enviar reseña'
          )}
        </button>

        <p className="text-center text-[var(--text-muted)] text-[10px] leading-relaxed">
          Tu reseña ayuda a otros a descubrir este lugar.
        </p>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewInner />
    </Suspense>
  )
}
