/**
 * Matriz oficial de plan mínimo por ruta — fuente única de verdad para:
 *   1. Sidebar gating (oculta items del nav)         → app/(restaurant)/layout.tsx
 *   2. URL enforcement (bloquea acceso directo)      → componente PlanGate
 *   3. Cualquier check de plan futuro (RSC, RPC, etc)
 *
 * Si una ruta no figura acá, es accesible con plan 'free' (presencia digital base).
 * Cambios acá afectan al sidebar Y al enforcement — no duplicar la tabla.
 */

import { canAccessModule } from './plans'

/** Plan mínimo requerido por path (matriz 2026-06). */
export const ROUTE_PLAN_REQUIRED: Record<string, string> = {
  // Operación del salón → starter
  '/mesas':        'starter',
  '/comandas':     'starter',
  '/garzon':       'starter',
  '/caja':         'starter',
  '/espera':       'starter',
  '/turnos':       'starter',
  '/mis-turnos':   'starter',
  '/reservas':     'starter',
  '/delivery':     'starter',
  '/promociones':  'starter',
  '/dte':          'starter',
  '/equipo':       'starter',
  '/impresoras':   'starter',
  '/tono':         'starter',

  // Inteligencia operativa → pro (Piloto accede vía PLAN_LEVEL_ALIAS)
  '/stock':        'pro',
  '/mermas':       'pro',
  '/reporte':      'pro',
  '/analytics':    'pro',
  '/insights':     'pro',
  '/fidelizacion': 'pro',
  '/clientes':     'pro',
  '/configuracion/comensales': 'pro',

  // Locales (single o multi) → starter
  '/configuracion/locations':  'starter',
  '/configuracion/estaciones': 'starter',
  '/configuracion/categorias': 'starter',

  // Escala → enterprise
  '/agregar-sucursal':         'enterprise',
  '/configuracion/api-keys':   'enterprise',
  '/configuracion/geofencing': 'enterprise',
}

/**
 * Resuelve el plan mínimo requerido para un pathname. Devuelve 'free' (acceso
 * libre) si la ruta no está restringida. Hace matching por prefijo para que
 * subrutas dinámicas (ej: /mesas/123) hereden el gate de /mesas.
 */
export function requiredPlanForRoute(pathname: string): string {
  // Match exacto primero
  if (ROUTE_PLAN_REQUIRED[pathname]) return ROUTE_PLAN_REQUIRED[pathname]
  // Luego por prefijo: /mesas/abc hereda /mesas. Ordenamos por longitud
  // descendente para que /configuracion/comensales gane sobre /configuracion.
  const keys = Object.keys(ROUTE_PLAN_REQUIRED).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (pathname === key || pathname.startsWith(key + '/')) return ROUTE_PLAN_REQUIRED[key]
  }
  return 'free'
}

/**
 * True si el plan actual del restaurante puede acceder a la ruta dada.
 * Combina requiredPlanForRoute + canAccessModule (que ya maneja jerarquía
 * y alias de Piloto).
 */
export function canAccessRoute(currentPlan: string, pathname: string): boolean {
  return canAccessModule(currentPlan, requiredPlanForRoute(pathname))
}
