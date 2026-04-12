'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type NpsType = 'platform_customer' | 'platform_admin' | 'restaurant'

interface NpsModalProps {
  open: boolean
  onClose: () => void
  npsType: NpsType
  restaurantId?: string
  userId?: string
  context?: Record<string, unknown>
}

const NPS_CONFIG: Record<NpsType, { title: string; subtitle: string }> = {
  platform_customer: {
    title: '¿Qué tal tu experiencia con HiChapi?',
    subtitle: 'Tu opinión nos ayuda a mejorar la plataforma.',
  },
  platform_admin: {
    title: '¿Qué tal HiChapi para tu negocio?',
    subtitle: 'Cuéntanos cómo podemos mejorar tu experiencia como administrador.',
  },
  restaurant: {
    title: '¿Cómo fue tu experiencia en este restaurante?',
    subtitle: 'Ayuda a otros comensales con tu opinión.',
  },
}

const SCORE_COLORS: Record<string, string> = {
  detractor: 'bg-red-500',
  passive: 'bg-yellow-500',
  promoter: 'bg-emerald-500',
}

function getScoreType(score: number): string {
  if (score <= 6) return 'detractor'
  if (score <= 8) return 'passive'
  return 'promoter'
}

export default function NpsModal({ open, onClose, npsType, restaurantId, userId, context }: NpsModalProps) {
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (!open) return null

  const config = NPS_CONFIG[npsType]

  async function handleSubmit() {
    if (score === null) return
    setSubmitting(true)

    const supabase = createClient()
    const { error } = await supabase.from('nps_responses').insert({
      nps_type: npsType,
      score,
      comment: comment.trim() || null,
      user_id: userId || null,
      restaurant_id: restaurantId || null,
      context: context || {},
    })

    if (error) {
      console.error('NPS submit error:', error)
    }

    setSubmitting(false)
    setSubmitted(true)

    // Auto-close after 2s
    setTimeout(() => {
      onClose()
      // Reset state for next time
      setScore(null)
      setComment('')
      setSubmitted(false)
    }, 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#161622] rounded-2xl border border-white/10 w-full max-w-md p-6 space-y-5 shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-white/30 hover:text-white/60 transition-colors"
        >
          <X size={16} />
        </button>

        {submitted ? (
          /* Success state */
          <div className="text-center py-6 space-y-3">
            <span className="text-4xl block">🙏</span>
            <p className="text-white font-semibold">¡Gracias por tu feedback!</p>
            <p className="text-white/40 text-sm">Tu opinión nos ayuda a mejorar.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="space-y-1 pr-8">
              <h2 className="text-white font-bold text-lg">{config.title}</h2>
              <p className="text-white/40 text-sm">{config.subtitle}</p>
            </div>

            {/* Score selector */}
            <div className="space-y-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: 11 }, (_, i) => {
                  const type = getScoreType(i)
                  const isSelected = score === i
                  return (
                    <button
                      key={i}
                      onClick={() => setScore(i)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all
                        ${isSelected
                          ? `${SCORE_COLORS[type]} text-white scale-110 shadow-lg`
                          : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                        }`}
                    >
                      {i}
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-between">
                <span className="text-white/25 text-[10px]">Nada probable</span>
                <span className="text-white/25 text-[10px]">Muy probable</span>
              </div>
            </div>

            {/* Comment */}
            <div>
              <textarea
                rows={3}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="¿Algo que quieras agregar? (opcional)"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 resize-none focus:outline-none focus:border-[#FF6B35]/50"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={score === null || submitting}
              className="w-full py-3 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
