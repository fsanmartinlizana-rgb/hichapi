'use client'

/**
 * Enforcement por URL directa.
 *
 * El sidebar ya oculta las rutas que el plan no incluye, pero un usuario puede
 * tipear /stock en la URL aunque sea Free. Este componente se monta en el
 * layout del grupo (restaurant) y, cuando detecta acceso a una ruta restringida
 * que el plan actual no cubre, renderiza un panel de upgrade en lugar del
 * contenido y oculta la ruta. No usa redirect porque queremos que el usuario
 * vea POR QUÉ no entró + cómo upgradear, sin perder contexto.
 *
 * Single source of truth: lib/plans-gating.ts (compartido con el sidebar).
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock, Sparkles, ArrowRight } from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'
import { canAccessRoute, requiredPlanForRoute } from '@/lib/plans-gating'
import { PLANS, getUpgradePlan } from '@/lib/plans'

interface Props {
  children: React.ReactNode
}

export default function PlanGate({ children }: Props) {
  const pathname = usePathname() ?? ''
  const { restaurant, loading } = useRestaurant()

  // Mientras carga el contexto del restaurante no decidimos: dejamos pasar el
  // contenido (que probablemente esté en su propio loading). Cuando llegue el
  // restaurant, el render re-evalúa.
  if (loading || !restaurant) return <>{children}</>

  const currentPlan = (restaurant.plan as string) ?? 'free'
  if (canAccessRoute(currentPlan, pathname)) return <>{children}</>

  const required = requiredPlanForRoute(pathname)
  const requiredPlan = PLANS[required] ?? PLANS.starter
  const upgrade = getUpgradePlan(currentPlan) ?? requiredPlan
  const targetPlan = PLANS[required] ?? upgrade

  // Etiqueta de la ruta para humanizar el mensaje
  const routeLabel = pathname
    .replace(/^\//, '')
    .split('/')[0]
    .replace(/-/g, ' ')

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl p-7 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
          <Lock size={22} className="text-amber-700" />
        </div>
        <h1 className="text-[var(--text-strong)] font-bold text-xl mb-2">
          Función disponible en {targetPlan.name}
        </h1>
        <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-5">
          La sección <span className="text-[var(--text-strong)] font-semibold capitalize">{routeLabel}</span> está incluida en el plan <span className="text-[#E55A2B] font-semibold">{targetPlan.name}</span>.
          Estás en el plan <span className="text-[var(--text-strong)] capitalize">{currentPlan}</span>.
        </p>

        <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-4 mb-5 text-left">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold mb-2 flex items-center gap-1.5">
            <Sparkles size={11} /> Qué desbloqueás
          </p>
          <ul className="space-y-1.5">
            {targetPlan.features.slice(0, 4).map(f => (
              <li key={f} className="text-[var(--text-body)] text-xs flex items-start gap-2">
                <span className="text-emerald-700 mt-0.5">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/modulos"
            className="w-full py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e55a2b] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            Ver planes y actualizar <ArrowRight size={14} />
          </Link>
          <Link
            href="/dashboard"
            className="text-[var(--text-muted)] hover:text-[var(--text-strong)] text-xs transition-colors py-2"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
