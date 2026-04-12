'use client'

import { useState } from 'react'
import {
  Grid3X3, Monitor, Package, Banknote, Heart, Clock,
  BarChart2, MapPin, CalendarDays, Check, Lock, Crown,
  Zap, ArrowRight, X, Loader2, Star,
} from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'
import { PLANS, PLAN_HIERARCHY, getPlanLevel, canAccessModule, getUpgradePlan } from '@/lib/plans'
import { MODULE_LABELS, MODULE_PLAN_REQUIRED, type ModulesConfig } from '@/lib/defaults/moduleDefaults'

// ── Module icons ─────────────────────────────────────────────────────────────

const MODULE_ICONS: Record<keyof ModulesConfig, typeof Grid3X3> = {
  tables:          Grid3X3,
  kitchen_display: Monitor,
  inventory:       Package,
  cash_register:   Banknote,
  loyalty:         Heart,
  waitlist:        Clock,
  daily_reports:   BarChart2,
  geofencing:      MapPin,
  staff_schedule:  CalendarDays,
}

const MODULE_DESCRIPTIONS: Record<keyof ModulesConfig, string> = {
  tables:          'Gestiona mesas, estados y asignaciones en tiempo real.',
  kitchen_display: 'Pantalla para cocina con pedidos en cola y tiempos.',
  inventory:       'Control de stock, alertas de bajo inventario e importación con IA.',
  cash_register:   'Caja diaria, registro de pagos y cierre de caja.',
  loyalty:         'Programa de puntos y recompensas para tus clientes.',
  waitlist:        'Lista de espera digital con notificaciones.',
  daily_reports:   'Reportes automáticos de ventas, stock y rendimiento.',
  geofencing:      'Zonas geográficas para delivery y notificaciones.',
  staff_schedule:  'Gestión de turnos, horarios y asistencia del equipo.',
}

// ── Upgrade Modal ────────────────────────────────────────────────────────────

function UpgradeModal({
  targetPlan,
  currentPlan,
  onClose,
}: {
  targetPlan: string
  currentPlan: string
  onClose: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const plan = PLANS[targetPlan]
  if (!plan) return null

  const { restaurant } = useRestaurant()

  async function handleUpgrade() {
    if (!restaurant) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/restaurants/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          target_plan: targetPlan,
        }),
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch {
      // handle error
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#161622] rounded-2xl border border-white/10 w-full max-w-md p-6 space-y-5 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg text-white/30 hover:text-white/60">
          <X size={16} />
        </button>

        {success ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto">
              <Check size={28} className="text-emerald-400" />
            </div>
            <p className="text-white font-bold text-lg">¡Plan activado!</p>
            <p className="text-white/40 text-sm">Tu plan {plan.name} está activo. Recargando...</p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[#FF6B35]/20 flex items-center justify-center mx-auto">
                <Crown size={24} className="text-[#FF6B35]" />
              </div>
              <h2 className="text-white font-bold text-xl">Activar {plan.name}</h2>
              <p className="text-white/40 text-sm">{plan.description}</p>
            </div>

            <div className="bg-white/3 rounded-xl p-4 space-y-2">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-white/40 text-xs">Precio mensual</p>
                  <p className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                    {plan.priceLabel}
                  </p>
                </div>
                {currentPlan !== 'free' && (
                  <span className="text-xs text-[#FF6B35] bg-[#FF6B35]/10 px-2 py-1 rounded-lg">
                    Upgrade desde {PLANS[currentPlan]?.name}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-white/50 text-xs font-medium">Incluye:</p>
              {plan.features.map(f => (
                <div key={f} className="flex items-center gap-2">
                  <Check size={12} className="text-emerald-400 shrink-0" />
                  <span className="text-white/60 text-sm">{f}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleUpgrade}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 size={14} className="animate-spin" /> Procesando...</>
              ) : (
                <><Zap size={14} /> {plan.cta}</>
              )}
            </button>

            <p className="text-white/20 text-[10px] text-center">
              Sin compromiso. Cancela cuando quieras.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ModulosPage() {
  const { restaurant } = useRestaurant()
  const currentPlan = restaurant?.plan || 'free'
  const [upgradeTarget, setUpgradeTarget] = useState<string | null>(null)
  const [view, setView] = useState<'modules' | 'plans'>('modules')

  const currentLevel = getPlanLevel(currentPlan)
  const nextPlan = getUpgradePlan(currentPlan)
  const allModules = Object.keys(MODULE_LABELS) as (keyof ModulesConfig)[]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Módulos y Plan</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2.5 py-1 rounded-lg bg-[#FF6B35]/15 text-[#FF6B35] font-semibold">
              Plan {PLANS[currentPlan]?.name || currentPlan}
            </span>
            <span className="text-white/30 text-xs">
              {PLANS[currentPlan]?.modules.length || 0} módulos incluidos
            </span>
          </div>
        </div>
        {nextPlan && (
          <button
            onClick={() => setUpgradeTarget(nextPlan.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] transition-colors"
          >
            <Zap size={14} /> Upgrade a {nextPlan.name}
          </button>
        )}
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-white/3 border border-white/6 rounded-xl p-1 w-fit">
        <button
          onClick={() => setView('modules')}
          className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
            view === 'modules' ? 'bg-[#FF6B35] text-white font-medium' : 'text-white/40 hover:text-white/60'
          }`}
        >
          Módulos
        </button>
        <button
          onClick={() => setView('plans')}
          className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
            view === 'plans' ? 'bg-[#FF6B35] text-white font-medium' : 'text-white/40 hover:text-white/60'
          }`}
        >
          Comparar planes
        </button>
      </div>

      {view === 'modules' ? (
        /* ── Modules Grid ── */
        <div className="grid grid-cols-3 gap-4">
          {allModules.map(key => {
            const Icon = MODULE_ICONS[key]
            const requiredPlan = MODULE_PLAN_REQUIRED[key]
            const hasAccess = canAccessModule(currentPlan, requiredPlan)
            const planInfo = PLANS[requiredPlan]

            return (
              <div
                key={key}
                className={`rounded-2xl border p-5 space-y-3 transition-all ${
                  hasAccess
                    ? 'bg-[#161622] border-white/8 hover:border-white/15'
                    : 'bg-white/2 border-white/5 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    hasAccess ? 'bg-[#FF6B35]/15 text-[#FF6B35]' : 'bg-white/5 text-white/20'
                  }`}>
                    <Icon size={18} />
                  </div>
                  {hasAccess ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                      <Check size={10} /> Activo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-white/30 bg-white/5 px-2 py-1 rounded-lg">
                      <Lock size={10} /> {planInfo?.name}
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-white text-sm font-semibold">{MODULE_LABELS[key]}</p>
                  <p className="text-white/30 text-xs mt-1 leading-relaxed">{MODULE_DESCRIPTIONS[key]}</p>
                </div>

                {!hasAccess && (
                  <button
                    onClick={() => setUpgradeTarget(requiredPlan)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#FF6B35]/30 text-[#FF6B35] text-xs font-semibold hover:bg-[#FF6B35]/10 transition-colors"
                  >
                    <Zap size={12} /> Desbloquear con {planInfo?.name}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* ── Plans Comparison ── */
        <div className="grid grid-cols-4 gap-4">
          {PLAN_HIERARCHY.map(planId => {
            const plan = PLANS[planId]
            const isCurrent = planId === currentPlan
            const isUpgrade = getPlanLevel(planId) > currentLevel
            const isDowngrade = getPlanLevel(planId) < currentLevel

            return (
              <div
                key={planId}
                className={`rounded-2xl border p-5 space-y-4 transition-all relative ${
                  plan.highlighted
                    ? 'bg-[#FF6B35]/5 border-[#FF6B35]/30'
                    : isCurrent
                    ? 'bg-[#161622] border-[#FF6B35]/20'
                    : 'bg-[#161622] border-white/8'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-[#FF6B35] text-white px-3 py-1 rounded-full">
                      <Star size={10} /> Popular
                    </span>
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] font-bold bg-emerald-500 text-white px-3 py-1 rounded-full">
                      Tu plan
                    </span>
                  </div>
                )}

                <div className="space-y-1 pt-1">
                  <p className="text-white font-bold text-lg">{plan.name}</p>
                  <p className="text-white text-xl font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                    {plan.price === 0 ? 'Gratis' : plan.priceLabel}
                  </p>
                  <p className="text-white/30 text-xs">{plan.description}</p>
                </div>

                <div className="space-y-2">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2">
                      <Check size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-white/50 text-xs">{f}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-xl border border-emerald-500/30 text-emerald-400 text-sm font-semibold text-center">
                      Plan actual
                    </div>
                  ) : isUpgrade ? (
                    <button
                      onClick={() => setUpgradeTarget(planId)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] transition-colors"
                    >
                      {plan.cta} <ArrowRight size={14} />
                    </button>
                  ) : isDowngrade ? (
                    <div className="w-full py-2.5 rounded-xl border border-white/8 text-white/20 text-sm text-center">
                      Incluido
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Upgrade Modal */}
      {upgradeTarget && (
        <UpgradeModal
          targetPlan={upgradeTarget}
          currentPlan={currentPlan}
          onClose={() => setUpgradeTarget(null)}
        />
      )}
    </div>
  )
}
