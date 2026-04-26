'use client'

/**
 * Hook que devuelve `true` cuando el viewport está bajo el breakpoint
 * indicado. Usa matchMedia (más eficiente que escuchar resize) y se
 * actualiza en vivo si el usuario rota el dispositivo o cambia el tamaño
 * de ventana.
 *
 * Defaults: 768px (Tailwind `md`). Para usar otros breakpoints:
 *   useIsMobile()           → < 768px
 *   useIsMobile(640)        → < 640px (Tailwind `sm`)
 *   useIsMobile(1024)       → < 1024px (Tailwind `lg`)
 *
 * NOTA SSR: el primer render server-side devuelve `false` porque no hay
 * `window`. El cliente actualiza tras el primer effect. Si necesitas un
 * fallback distinto, paga el costo de un re-render con `useEffect`.
 */

import { useEffect, useState } from 'react'

export function useIsMobile(maxWidth: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${maxWidth - 1}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [maxWidth])

  return isMobile
}
