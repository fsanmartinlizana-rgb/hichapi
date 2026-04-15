// ─────────────────────────────────────────────────────────────────────────────
// HiChapi · resolver robusto de URL de la app para links en emails.
//
// Estrategia: preferir el origen de la request actual (siempre funciona porque
// el admin YA está conectado a esa URL), y usar NEXT_PUBLIC_SITE_URL sólo si
// coincide con el origen o si no hay request (jobs / cron).
//
// Por qué: si NEXT_PUBLIC_SITE_URL está mal configurado (ej: apunta a un dominio
// sin DNS propio como hichapi.com parqueado en GoDaddy), los links en emails
// caen en páginas muertas. Usando req.nextUrl.origin garantizamos que el link
// del email apunte al MISMO host desde el cual el admin disparó la acción —
// que por definición es un host funcionando.
// ─────────────────────────────────────────────────────────────────────────────

import type { NextRequest } from 'next/server'

/**
 * Retorna el origen base para construir URLs en emails.
 *
 * Orden de preferencia:
 *   1. req.nextUrl.origin (siempre es un host donde la app responde)
 *   2. NEXT_PUBLIC_SITE_URL (si está seteado y es URL válida)
 *   3. 'http://localhost:3000' (último recurso, solo dev)
 *
 * Siempre retorna sin trailing slash.
 */
export function resolveAppUrl(req?: NextRequest): string {
  // 1. Origen de la request (preferido — el admin está claramente conectado ahí)
  const reqOrigin = req?.nextUrl?.origin
  if (reqOrigin) return reqOrigin.replace(/\/$/, '')

  // 2. Variable de entorno (para jobs sin request context)
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl) {
    try {
      // Validar que sea URL válida
      const u = new URL(envUrl)
      return `${u.protocol}//${u.host}`
    } catch {
      /* URL inválida — fallthrough */
    }
  }

  // 3. Último recurso
  return 'http://localhost:3000'
}
