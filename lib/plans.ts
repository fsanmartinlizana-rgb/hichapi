// ── Plan definitions & pricing ──────────────────────────────────────────────
//
// Rebalanced 2026-04-19 (Sprint 2). Cambios clave vs versión previa:
//   • Free: solo presencia digital (página pública + carta + perfil). Sin
//     módulos operacionales.
//   • Starter: toda la operación del salón (mesas, comandas, caja, lista de
//     espera, turnos).
//   • Pro: todo Starter + inteligencia operativa (stock/mermas, analytics,
//     fidelización).
//   • Enterprise: todo Pro + escala (multi-local, geofencing, API pública,
//     soporte 24/7 con agente IA).
//
// Nota: las ventas digitales (pedidos procesados por la plataforma) tienen
// comisión de 1% en Starter/Pro, incluida en Enterprise.

export interface PlanInfo {
  id: string
  name: string
  price: number          // CLP/month, 0 = free
  priceLabel: string
  transactionFeeLabel?: string  // "+ 1% sobre ventas digitales" u otro extra
  description: string
  features: string[]
  modules: string[]      // module keys included
  highlighted?: boolean  // for UI emphasis
  cta: string
}

export const PLAN_HIERARCHY = ['free', 'starter', 'pro', 'enterprise'] as const
export type PlanId = typeof PLAN_HIERARCHY[number]

// Módulos base disponibles en TODOS los planes (incluso free):
// página pública, carta digital, perfil, configuración básica.
const BASE_MODULES = ['public_page', 'menu_digital', 'public_profile', 'config_basic']

// Starter agrega operación del salón
const STARTER_MODULES = [
  'tables',          // Mesas + QR
  'kitchen_display', // Comandas
  'cash_register',   // Caja
  'waitlist',        // Lista de espera
  'staff_schedule',  // Turnos
]

// Pro agrega inteligencia operativa
const PRO_MODULES = [
  'inventory',       // Stock + Mermas
  'loyalty',         // Fidelización y promos
  'analytics',       // Analytics + Reporte IA unificado
  // 'daily_reports' queda como alias histórico; nueva key canonical = 'analytics'
  'daily_reports',
]

// Enterprise agrega escala
const ENTERPRISE_MODULES = [
  'multi_location',  // Multi-sucursal
  'geofencing',      // Geofencing
  'public_api',      // API pública con keys
  'support_24_7',    // Soporte 24/7 con agente IA
]

export const PLANS: Record<string, PlanInfo> = {
  free: {
    id: 'free',
    name: 'Gratis',
    price: 0,
    priceLabel: 'Gratis para siempre',
    description: 'Presencia digital sin costo: tu página, tu carta, tu perfil público.',
    cta: 'Crear cuenta gratis',
    features: [
      'Página web pública en hichapi.com/tu-resto',
      'Carta digital con fotos y tags',
      'Perfil público con ubicación y horarios',
      'Apareces en búsquedas de Chapi',
      'Configuración del restaurante',
    ],
    modules: [...BASE_MODULES],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 29990,
    priceLabel: '$29.990',
    transactionFeeLabel: '+ 1% sobre ventas digitales procesadas',
    description: 'Digitalizá el salón: pedidos desde la mesa, caja y turnos.',
    cta: 'Activar Starter',
    features: [
      'Todo lo de Gratis',
      'Mesas + código QR por mesa',
      'Comandas (cocina + garzón en tiempo real)',
      'Caja (abrir/cerrar + reporte de turno)',
      'Lista de espera digital',
      'Turnos del personal',
    ],
    modules: [...BASE_MODULES, ...STARTER_MODULES],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 59990,
    priceLabel: '$59.990',
    transactionFeeLabel: '+ 1% sobre ventas digitales procesadas',
    description: 'Inteligencia operativa: stock, reportes IA y fidelización.',
    highlighted: true,
    cta: 'Activar Pro',
    features: [
      'Todo lo de Starter',
      'Stock + control de mermas',
      'Analytics unificado (reporte del día + métricas con IA)',
      'Dashboards configurables',
      'Fidelización y promociones',
      'Chapi Insights con datos reales',
    ],
    modules: [...BASE_MODULES, ...STARTER_MODULES, ...PRO_MODULES],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 149990,
    priceLabel: '$149.990',
    description: 'Multi-local, API pública, geofencing y soporte 24/7.',
    cta: 'Contactar ventas',
    features: [
      'Todo lo de Pro',
      'Multi-local sin límite',
      'Geofencing y check-in automático',
      'API pública con keys y scopes',
      'Agente IA de soporte 24/7',
      'Sin comisión sobre ventas digitales',
    ],
    modules: [...BASE_MODULES, ...STARTER_MODULES, ...PRO_MODULES, ...ENTERPRISE_MODULES],
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

// ── Feature flags (overrides por restaurant) ────────────────────────────────
//
// Permite activar/desactivar features puntuales por restaurant, independiente
// del plan. Útil para betas, rollouts graduales o overrides manuales.
// Fuente: restaurants.feature_flags (JSONB) — migration 050.

export type FeatureFlags = Record<string, boolean>

/**
 * Chequea si un feature flag específico está activo para un restaurant.
 * Si el flag no está seteado, devuelve el `defaultValue` (false por default).
 */
export function hasFeature(
  flags: FeatureFlags | null | undefined,
  flag: string,
  defaultValue = false,
): boolean {
  if (!flags) return defaultValue
  const v = flags[flag]
  return typeof v === 'boolean' ? v : defaultValue
}
