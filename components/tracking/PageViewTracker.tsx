'use client'

/**
 * Componente cliente que dispara trackPageView en cada navegación de
 * Next.js App Router (pathname + searchParams). Se monta una sola vez
 * en el layout root.
 *
 * Robustez:
 *   - useRef para evitar doble fire en React strict mode (dev).
 *   - Throttle: solo trackea si pasaron >300ms desde el último page_view
 *     del mismo path (evita ruido de remounts).
 */
import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { trackPageView } from '@/lib/tracking'

export function PageViewTracker() {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const lastTrack    = useRef<{ path: string; ts: number }>({ path: '', ts: 0 })

  useEffect(() => {
    if (!pathname) return
    const fullPath = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname
    const now = Date.now()
    if (lastTrack.current.path === fullPath && now - lastTrack.current.ts < 300) {
      return
    }
    lastTrack.current = { path: fullPath, ts: now }
    trackPageView({ path: fullPath })
  }, [pathname, searchParams])

  return null
}
