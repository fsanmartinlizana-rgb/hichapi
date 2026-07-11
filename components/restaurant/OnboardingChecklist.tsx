'use client'

/**
 * OnboardingChecklist — tarjeta "Primeros pasos" en el dashboard.
 *
 * No intrusiva: muestra el progreso de configuración inicial del restaurante
 * (carta, mesas/QR, perfil, equipo) y se auto-marca según los datos reales.
 * Cuando está todo completo, desaparece sola. El dueño puede ocultarla.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRestaurant } from '@/lib/restaurant-context'
import { Rocket, Check, ChevronRight, X, RefreshCw } from 'lucide-react'
import {
  computeOnboardingSteps, onboardingProgress, isOnboardingComplete,
  type OnboardingStep,
} from '@/lib/onboarding/steps'

export default function OnboardingChecklist({ restaurantId }: { restaurantId: string | undefined }) {
  const supabase = useMemo(() => createClient(), [])
  const { restaurant } = useRestaurant()
  const plan = (restaurant?.plan as string) ?? 'free'
  const [steps, setSteps]     = useState<OnboardingStep[] | null>(null)
  const [hidden, setHidden]   = useState(false)

  const dismissKey = restaurantId ? `hichapi_onboarding_hidden_${restaurantId}` : ''

  useEffect(() => {
    if (typeof window !== 'undefined' && dismissKey) {
      setHidden(window.localStorage.getItem(dismissKey) === '1')
    }
  }, [dismissKey])

  const load = useCallback(async () => {
    if (!restaurantId) return
    const [menuRes, tablesRes, teamRes, stockRes, restRes] = await Promise.all([
      supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
      supabase.from('tables').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
      supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).eq('active', true),
      supabase.from('stock_items').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
      supabase.from('restaurants').select('neighborhood, address').eq('id', restaurantId).maybeSingle(),
    ])
    const rest = restRes.data as { neighborhood: string | null; address: string | null } | null
    const hasProfile = Boolean((rest?.neighborhood && rest.neighborhood.trim()) || (rest?.address && rest.address.trim()))
    setSteps(computeOnboardingSteps({
      menuItems:   menuRes.count ?? 0,
      tables:      tablesRes.count ?? 0,
      teamMembers: teamRes.count ?? 0,
      stockItems:  stockRes.count ?? 0,
      hasProfile,
    }, plan))
  }, [restaurantId, supabase, plan])

  useEffect(() => { load() }, [load])

  function dismiss() {
    if (dismissKey) window.localStorage.setItem(dismissKey, '1')
    setHidden(true)
  }

  // No renderizar si: oculto, sin datos aún, o ya completó todo.
  if (hidden || !steps) return null
  if (isOnboardingComplete(steps)) return null

  const progress = onboardingProgress(steps)
  const doneCount = steps.filter(s => s.done).length

  return (
    <section className="rounded-2xl border border-[#FF6B35]/25 bg-gradient-to-br from-[#FF6B35]/8 to-transparent p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FF6B35]/15 border border-[#FF6B35]/30 flex items-center justify-center shrink-0">
            <Rocket size={17} className="text-[#E55A2B]" />
          </div>
          <div>
            <h2 className="text-[var(--text-strong)] font-bold text-base">Primeros pasos</h2>
            <p className="text-[var(--text-muted)] text-xs">
              {doneCount} de {steps.length} listos · dejá tu restaurante operativo
            </p>
          </div>
        </div>
        <button onClick={dismiss} title="Ocultar"
          className="text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors shrink-0">
          <X size={16} />
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 rounded-full bg-[var(--surface-sunken)] overflow-hidden mb-4">
        <div className="h-full bg-gradient-to-r from-[#FF6B35] to-[#FF8C5A] transition-all duration-500"
          style={{ width: `${progress}%` }} />
      </div>

      {/* Pasos */}
      <div className="space-y-2">
        {steps.map(step => (
          <div key={step.id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
              step.done ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-[var(--border-subtle)] bg-[var(--surface-sunken)]'
            }`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
              step.done ? 'bg-emerald-500/20 border border-emerald-500/40' : 'border border-[var(--border-subtle)]'
            }`}>
              {step.done && <Check size={11} className="text-emerald-700" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-strong)]'}`}>
                {step.label}
              </p>
              {!step.done && <p className="text-[var(--text-muted)] text-[11px] mt-0.5">{step.hint}</p>}
            </div>
            {!step.done && (
              <Link href={step.href}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FF6B35] hover:bg-[#e85d2a] text-white text-xs font-semibold transition-colors shrink-0">
                {step.cta} <ChevronRight size={13} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
