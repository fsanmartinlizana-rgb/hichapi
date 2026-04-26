'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X } from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'
import { createClient } from '@/lib/supabase/client'

/**
 * Banner discreto que avisa al usuario cuántos días le quedan del trial.
 * Lee `feature_flags` del restaurant activo. Si no está en trial, no
 * renderiza nada.
 *
 * Estados:
 * - >7 días restantes  → banner suave (info)
 * - ≤7 días            → banner amarillo (atención)
 * - 0 días o vencido   → banner rojo (urgente)
 */

interface TrialFlags {
  on_trial?: boolean
  trial_plan?: string
  trial_ends_at?: string
}

const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

export default function TrialBanner() {
  const { restaurant } = useRestaurant()
  const [flags, setFlags] = useState<TrialFlags | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!restaurant?.id) return
    const sb = createClient()
    sb.from('restaurants')
      .select('feature_flags')
      .eq('id', restaurant.id)
      .single()
      .then(({ data }) => {
        const ff = (data?.feature_flags ?? {}) as TrialFlags
        setFlags(ff)
      })
  }, [restaurant?.id])

  if (dismissed || !flags?.on_trial || !flags.trial_ends_at) return null

  const endsAt = new Date(flags.trial_ends_at)
  const now = new Date()
  const msLeft = endsAt.getTime() - now.getTime()
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))

  const planName = PLAN_NAMES[flags.trial_plan ?? ''] ?? 'Pro'
  const isUrgent = daysLeft === 0
  const isWarning = daysLeft > 0 && daysLeft <= 7

  const colors = isUrgent
    ? { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)', text: '#fca5a5', accent: '#ef4444' }
    : isWarning
    ? { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', text: '#fcd34d', accent: '#f59e0b' }
    : { bg: 'rgba(255,107,53,0.10)', border: 'rgba(255,107,53,0.35)', text: '#FFD4C2', accent: '#FF6B35' }

  return (
    <div
      className="rounded-xl px-4 py-2.5 mb-4 flex items-center gap-3"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      <Sparkles size={16} style={{ color: colors.accent }} className="shrink-0" />
      <div className="flex-1 text-sm">
        <span style={{ color: colors.text }} className="font-semibold">
          {isUrgent
            ? `Tu trial de ${planName} terminó`
            : `Estás en trial gratis de ${planName}`}
        </span>
        {!isUrgent && (
          <span style={{ color: colors.text }} className="opacity-80 ml-2">
            · {daysLeft} {daysLeft === 1 ? 'día restante' : 'días restantes'}
          </span>
        )}
      </div>
      <Link
        href="/modulos"
        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        style={{ background: colors.accent, color: '#fff' }}
      >
        {isUrgent ? 'Activar plan' : 'Ver planes'}
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-white/30 hover:text-white/60 transition-colors"
        aria-label="Cerrar banner"
      >
        <X size={14} />
      </button>
    </div>
  )
}
