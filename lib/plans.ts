// ── Plan definitions & pricing ──────────────────────────────────────────────

export interface PlanInfo {
  id: string
  name: string
  price: number          // CLP/month, 0 = free
  priceLabel: string
  description: string
  features: string[]
  modules: string[]      // module keys included
  highlighted?: boolean  // for UI emphasis
  cta: string
}

export const PLAN_HIERARCHY = ['free', 'starter', 'pro', 'enterprise'] as const
export type PlanId = typeof PLAN_HIERARCHY[number]

export const PLANS: Record<string, PlanInfo> = {
  free: {
    id: 'free',
    name: 'Gratis',
    price: 0,
    priceLabel: 'Gratis para siempre',
    description: 'Perfil en HiChapi Discovery + herramientas básicas',
    cta: 'Plan actual',
    features: [
      'Perfil público en HiChapi',
      'Carta digital con QR',
      'Gestión de mesas',
      'Pantalla de cocina',
      'Caja básica',
      'Lista de espera',
    ],
    modules: ['tables', 'kitchen_display', 'cash_register', 'waitlist'],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 29990,
    priceLabel: '$29.990/mes',
    description: 'Control operacional completo para tu negocio',
    cta: 'Activar Starter',
    features: [
      'Todo lo del plan Gratis',
      'Control de inventario',
      'Turnos de personal',
      'Importación de stock con IA',
      'Alertas de stock bajo',
    ],
    modules: ['tables', 'kitchen_display', 'cash_register', 'waitlist', 'inventory', 'staff_schedule'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 59990,
    priceLabel: '$59.990/mes',
    description: 'Inteligencia y fidelización para crecer',
    highlighted: true,
    cta: 'Activar Pro',
    features: [
      'Todo lo del plan Starter',
      'Reportes diarios automáticos',
      'Programa de fidelización',
      'Analytics avanzados',
      'Chapi Insights con IA',
      'Soporte prioritario',
    ],
    modules: ['tables', 'kitchen_display', 'cash_register', 'waitlist', 'inventory', 'staff_schedule', 'loyalty', 'daily_reports'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 149990,
    priceLabel: '$149.990/mes',
    description: 'Multi-local, geofencing y soporte dedicado',
    cta: 'Contactar ventas',
    features: [
      'Todo lo del plan Pro',
      'Multi-restaurante (hasta 10)',
      'Geofencing y zonas',
      'Dashboard corporativo',
      'API personalizada',
      'Soporte dedicado 24/7',
    ],
    modules: ['tables', 'kitchen_display', 'cash_register', 'waitlist', 'inventory', 'staff_schedule', 'loyalty', 'daily_reports', 'geofencing'],
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getPlanLevel(planId: string): number {
  const idx = PLAN_HIERARCHY.indexOf(planId as PlanId)
  return idx >= 0 ? idx : 0
}

export function canAccessModule(currentPlan: string, requiredPlan: string): boolean {
  return getPlanLevel(currentPlan) >= getPlanLevel(requiredPlan)
}

export function getUpgradePlan(currentPlan: string): PlanInfo | null {
  const level = getPlanLevel(currentPlan)
  const nextId = PLAN_HIERARCHY[level + 1]
  return nextId ? PLANS[nextId] : null
}
