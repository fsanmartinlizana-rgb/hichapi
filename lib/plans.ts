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
// Nota: las transacciones registradas en la plataforma tienen comisión de 1%
// en Starter/Pro (sin importar el medio de pago — efectivo, tarjeta o digital).
// Enterprise no tiene comisión.

export interface PlanInfo {
  id: string
  name: string
  price: number          // CLP/month, 0 = free
  priceLabel: string
  transactionFeeLabel?: string  // "+ 1% por transacción registrada" u otro extra
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
  'menu_import_ai',  // Importación de carta por foto/PDF (con tope mensual)
]

// Enterprise agrega escala
const ENTERPRISE_MODULES = [
  'multi_location',           // Multi-sucursal
  'geofencing',               // Geofencing
  'public_api',               // API pública con keys
  'support_24_7',             // Soporte 24/7 con agente IA
  'consolidated_dashboard',   // Dashboard consolidado multi-local
  'stock_transfer',           // Transferencia de stock entre locales
  'menu_import_ai_unlimited', // Importación carta sin tope mensual
]

// ── Topes de importación de carta por IA (foto/PDF) ──────────────────
// Starter: 40 análisis/mes. Pro: 200/mes. Enterprise: ilimitado.
// Lectura desde código: lookup por plan → MENU_IMPORT_AI_LIMIT[plan]
export const MENU_IMPORT_AI_LIMIT: Record<string, number> = {
  free:       0,
  starter:    40,
  pro:        200,
  enterprise: Infinity,
}

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
    transactionFeeLabel: '+ 1% por transacción registrada en la plataforma',
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
    transactionFeeLabel: '+ 1% por transacción registrada en la plataforma',
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
    // Precio "desde" — el real depende del tramo (ver ENTERPRISE_TIERS).
    price: 29990,
    priceLabel: 'Desde $29.990',
    transactionFeeLabel: 'Comisión escalonada según volumen del holding',
    description: 'Multi-local con precio que baja según cantidad de locales. Negociado.',
    cta: 'Contactar ventas',
    features: [
      'Todo lo de Pro',
      'Multi-local sin límite — precio por local que baja con escala',
      'Dashboard consolidado de todos los locales',
      'Transferencia de stock entre locales',
      'Importación de carta por IA sin tope',
      'API pública con keys y scopes',
      'Geofencing y check-in automático',
      'Agente IA de soporte 24/7',
      'Comisión escalonada (1% / 0.7% / 0.5%) según volumen',
    ],
    modules: [...BASE_MODULES, ...STARTER_MODULES, ...PRO_MODULES, ...ENTERPRISE_MODULES],
  },
}

// ── Enterprise: tramos de precio por local ──────────────────────────────────
//
// El precio del plan Enterprise NO es fijo. Depende de cuántos locales activos
// tiene el holding del cliente. Todos los locales del holding pagan el precio
// del tramo en que están — si suben de tramo, todos bajan al precio nuevo
// ese mismo mes.
//
// Tramos no se muestran en la landing; se conversan en venta. Se exponen acá
// para uso interno (CRM, billing, simulador).

export interface EnterpriseTier {
  id:         'duo' | 'chain' | 'scale' | 'holding'
  name:       string
  minLocals:  number
  maxLocals:  number | null  // null = sin límite
  pricePerLocal: number      // CLP/mes por local
  platformFee:   number      // CLP/mes flat de plataforma
  negotiable:    boolean     // si el precio se negocia caso a caso
}

export const ENTERPRISE_TIERS: EnterpriseTier[] = [
  { id: 'duo',     name: 'Duo',     minLocals: 2,  maxLocals: 4,    pricePerLocal: 49990, platformFee: 0,      negotiable: false },
  { id: 'chain',   name: 'Chain',   minLocals: 5,  maxLocals: 14,   pricePerLocal: 39990, platformFee: 150000, negotiable: false },
  { id: 'scale',   name: 'Scale',   minLocals: 15, maxLocals: 49,   pricePerLocal: 29990, platformFee: 150000, negotiable: false },
  { id: 'holding', name: 'Holding', minLocals: 50, maxLocals: null, pricePerLocal: 18000, platformFee: 300000, negotiable: true  },
]

/**
 * Devuelve el tramo Enterprise correspondiente a una cantidad de locales.
 * Devuelve null si la cantidad es < 2 (Enterprise requiere mínimo 2 locales).
 */
export function getEnterpriseTier(localCount: number): EnterpriseTier | null {
  if (localCount < 2) return null
  return ENTERPRISE_TIERS.find(
    t => localCount >= t.minLocals && (t.maxLocals === null || localCount <= t.maxLocals),
  ) ?? null
}

/**
 * Calcula el costo total mensual de Enterprise para una cantidad de locales.
 * Devuelve { perLocal, platformFee, total } en CLP/mes.
 */
export function computeEnterpriseMonthly(localCount: number): {
  tier: EnterpriseTier | null
  perLocal: number
  platformFee: number
  locals: number
  total: number
} {
  const tier = getEnterpriseTier(localCount)
  if (!tier) return { tier: null, perLocal: 0, platformFee: 0, locals: localCount, total: 0 }
  return {
    tier,
    perLocal:    tier.pricePerLocal,
    platformFee: tier.platformFee,
    locals:      localCount,
    total:       tier.pricePerLocal * localCount + tier.platformFee,
  }
}

// ── Comisión por transacción digital — escalonada para Enterprise ───────────
//
// Starter/Pro: flat 1% sin importar volumen.
// Enterprise: escalonado según ventas digitales del holding completo en el mes.
//   ≤ $30M           → 1.0%
//   $30M–$100M       → 0.7%
//   > $100M          → 0.5%

export interface DigitalCommissionTier {
  upToMonthlyCLP: number    // tope mensual de ventas digitales (Infinity = sin tope)
  rate:           number    // tasa decimal (0.01 = 1%)
  rateLabel:      string    // string para mostrar en UI
}

export const ENTERPRISE_COMMISSION_TIERS: DigitalCommissionTier[] = [
  { upToMonthlyCLP:  30_000_000, rate: 0.010, rateLabel: '1.0%' },
  { upToMonthlyCLP: 100_000_000, rate: 0.007, rateLabel: '0.7%' },
  { upToMonthlyCLP: Infinity,    rate: 0.005, rateLabel: '0.5%' },
]

/**
 * Calcula la comisión digital total para Enterprise dado un volumen mensual
 * en CLP. Aplica las tasas escalonadas (no es un solo % sobre el total).
 */
export function computeEnterpriseCommission(monthlyDigitalCLP: number): number {
  let remaining = Math.max(0, monthlyDigitalCLP)
  let prevCap = 0
  let total = 0
  for (const tier of ENTERPRISE_COMMISSION_TIERS) {
    const tierMax = tier.upToMonthlyCLP - prevCap
    const slice   = Math.min(remaining, tierMax)
    total    += slice * tier.rate
    remaining -= slice
    prevCap   = tier.upToMonthlyCLP
    if (remaining <= 0) break
  }
  return Math.round(total)
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
