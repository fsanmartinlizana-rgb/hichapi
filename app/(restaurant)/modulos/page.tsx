'use client'

import { useState, useEffect } from 'react'
import {
  Grid3X3, Monitor, Package, Banknote, Heart, Clock,
  BarChart2, MapPin, CalendarDays, Check, Lock, Crown,
  Zap, ArrowRight, X, Loader2, Star, Receipt, Truck, AlertTriangle
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
  dte:             Receipt,
  delivery:        Truck,
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
  dte:             'Emisión de boletas y facturas electrónicas.',
  delivery:        'Gestión de despachos y pedidos a domicilio.',
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

  const { restaurant, refresh } = useRestaurant()

  async function handleUpgrade() {
    if (!restaurant) return
    setSubmitting(true)

    try {
      const { startFreeTrial } = await import('@/app/actions/billing')
      const res = await startFreeTrial(restaurant.id, targetPlan)
      
      if (res.success) {
        setSuccess(true)
        // Refrescar el contexto global para habilitar los módulos
        await refresh()
        setTimeout(() => {
          onClose()
        }, 3000)
      } else {
        alert(res.error || 'Ocurrió un error')
      }
    } catch (e) {
      console.error(e)
      alert('Error de conexión')
    }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] w-full max-w-md p-6 space-y-5 shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-muted)]">
          <X size={16} />
        </button>

        {success ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto">
              <Check size={28} className="text-[var(--success-text)]" />
            </div>
            <p className="text-[var(--text-strong)] font-bold text-lg">¡Piloto activado!</p>
            <p className="text-[var(--text-muted)] text-sm">Disfruta 30 días gratis del plan {plan.name}.</p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[#FF6B35]/20 flex items-center justify-center mx-auto">
                <Crown size={24} className="text-[#E55A2B]" />
              </div>
              <h2 className="text-[var(--text-strong)] font-bold text-xl">Activar {plan.name} (Piloto)</h2>
              <p className="text-[var(--text-muted)] text-sm">{plan.description}</p>
            </div>

            <div className="bg-[var(--surface-sunken)] rounded-xl p-4 space-y-2">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[var(--text-muted)] text-xs">Hoy pagas</p>
                  <p className="text-[var(--text-strong)] text-2xl font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                    $0
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[var(--text-muted)] text-xs">Después de 30 días</p>
                  <p className="text-[var(--text-body)] text-sm font-semibold">{plan.priceLabel} + 1% ventas</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[var(--text-muted)] text-xs font-medium">Incluye durante el piloto:</p>
              {plan.features.map(f => (
                <div key={f} className="flex items-center gap-2">
                  <Check size={12} className="text-[var(--success-text)] shrink-0" />
                  <span className="text-[var(--text-muted)] text-sm">{f}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleUpgrade}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 size={14} className="animate-spin" /> Activando...</>
              ) : (
                <><Zap size={14} /> Empezar 30 días gratis</>
              )}
            </button>

            <p className="text-[var(--text-muted)] text-[10px] text-center">
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
  
  // Facturación pendiente
  const [pendingInvoice, setPendingInvoice] = useState<any>(null)
  useEffect(() => {
    if (restaurant?.subscription_status === 'past_due') {
      import('@/app/actions/billing').then(m => {
        m.getPendingInvoice(restaurant.id).then(res => setPendingInvoice(res.invoice))
      })
    }
  }, [restaurant])

  const currentLevel = getPlanLevel(currentPlan)
  const nextPlan = getUpgradePlan(currentPlan)
  const allModules = (Object.keys(MODULE_LABELS) as (keyof ModulesConfig)[]).filter(key => 
    key !== 'delivery' || process.env.NEXT_PUBLIC_ENABLE_DELIVERY === 'true'
  )

  async function handlePayInvoice() {
    if (!restaurant || !pendingInvoice) return
    try {
      const res = await fetch('/api/flow/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          target_plan: currentPlan,
          invoice_id: pendingInvoice.id, // Pasamos el invoice_id
        }),
      })
      if (res.ok) {
        const { url } = await res.json()
        if (url) window.location.href = url
      } else {
        alert('Error al generar pago')
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Pending Invoice Banner */}
      {pendingInvoice && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-[var(--danger-text)] font-bold text-lg">Tienes una factura pendiente</h3>
              <p className="text-[var(--danger-text)]/80 text-sm">
                Membresía: ${pendingInvoice.plan_base_price.toLocaleString('es-CL')} + 
                1% Ventas: ${pendingInvoice.sales_commission.toLocaleString('es-CL')} 
                (Total Ventas calculadas: ${(Number(pendingInvoice.sales_total) || 0).toLocaleString('es-CL')})
              </p>
            </div>
          </div>
          <div className="text-right flex items-center gap-4">
            <div>
              <p className="text-[var(--text-muted)] text-xs">Total a pagar</p>
              <p className="text-[var(--text-strong)] font-bold text-xl">${pendingInvoice.total_amount.toLocaleString('es-CL')}</p>
            </div>
            <button
              onClick={handlePayInvoice}
              className="px-6 py-2.5 bg-[#FF6B35] rounded-xl font-bold hover:bg-[#FF6B35] transition-colors"
            >
              Pagar ahora
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[var(--text-strong)] text-xl font-bold">Módulos y Plan</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2.5 py-1 rounded-lg bg-[#FF6B35]/15 text-[#E55A2B] font-semibold">
              Plan {PLANS[currentPlan]?.name || currentPlan}
            </span>
            <span className="text-[var(--text-muted)] text-xs">
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
      <div className="flex gap-1 bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-1 w-fit">
        <button
          onClick={() => setView('modules')}
          className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
            view === 'modules' ? 'bg-[#FF6B35] text-white font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text-muted)]'
          }`}
        >
          Módulos
        </button>
        <button
          onClick={() => setView('plans')}
          className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
            view === 'plans' ? 'bg-[#FF6B35] text-white font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text-muted)]'
          }`}
        >
          Comparar planes
        </button>

        {currentPlan !== 'free' && (
          <button
            onClick={async () => {
              if (!restaurant) return
              if (!confirm('¿Estás seguro de cancelar tu suscripción? Volverás al plan Gratis inmediatamente.')) return
              
              try {
                const res = await fetch('/api/flow/cancel-subscription', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ restaurant_id: restaurant.id }),
                })
                if (res.ok) {
                  window.location.reload()
                } else {
                  alert('Hubo un error al cancelar la suscripción.')
                }
              } catch (e) {
                console.error(e)
              }
            }}
            className="px-4 py-2 rounded-xl text-xs bg-[var(--surface-sunken)] border border-[var(--border-subtle)] hover:bg-[var(--surface-sunken)] text-[var(--text-strong)] font-medium transition-colors"
          >
            Cancelar suscripción
          </button>
        )}
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
                    ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
                    : 'bg-[var(--surface-sunken)] border-[var(--border-subtle)] opacity-70'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    hasAccess ? 'bg-[#FF6B35]/15 text-[#E55A2B]' : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]'
                  }`}>
                    <Icon size={18} />
                  </div>
                  {hasAccess ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--success-text)] bg-emerald-500/10 px-2 py-1 rounded-lg">
                      <Check size={10} /> Activo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--surface-sunken)] px-2 py-1 rounded-lg">
                      <Lock size={10} /> {planInfo?.name}
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-[var(--text-strong)] text-sm font-semibold">{MODULE_LABELS[key]}</p>
                  <p className="text-[var(--text-muted)] text-xs mt-1 leading-relaxed">{MODULE_DESCRIPTIONS[key]}</p>
                </div>

                {!hasAccess && (
                  <button
                    onClick={() => setUpgradeTarget(requiredPlan)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#FF6B35]/30 text-[#E55A2B] text-xs font-semibold hover:bg-[#FF6B35]/10 transition-colors"
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
                    ? 'bg-[var(--surface-card)] border-[#FF6B35]/20'
                    : 'bg-[var(--surface-card)] border-[var(--border-subtle)]'
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
                  <p className="text-[var(--text-strong)] font-bold text-lg">{plan.name}</p>
                  <p className="text-[var(--text-strong)] text-xl font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                    {plan.price === 0 ? 'Gratis' : plan.priceLabel}
                  </p>
                  <p className="text-[var(--text-muted)] text-xs">{plan.description}</p>
                </div>

                <div className="space-y-2">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-2">
                      <Check size={12} className="text-[var(--success-text)] shrink-0 mt-0.5" />
                      <span className="text-[var(--text-muted)] text-xs">{f}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-xl border border-emerald-500/30 text-[var(--success-text)] text-sm font-semibold text-center">
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
                    <div className="w-full py-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm text-center">
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
