'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * Back button para la página de restaurante.
 *
 * 1. Si el usuario llegó a esta ruta navegando desde otra página dentro
 *    de HiChapi (history.length > 1 y referrer es del mismo origen),
 *    usa router.back() para preservar el scroll y los resultados de la
 *    búsqueda anterior.
 * 2. Si llegó por link directo (compartido, deep link, etc.), navega a
 *    /buscar como fallback razonable.
 */
export function BackButton() {
  const router = useRouter()

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault()
    if (typeof window === 'undefined') {
      router.push('/buscar')
      return
    }
    const sameOriginReferrer =
      document.referrer && new URL(document.referrer).origin === window.location.origin
    if (sameOriginReferrer && window.history.length > 1) {
      router.back()
    } else {
      router.push('/buscar')
    }
  }

  return (
    <a
      href="/buscar"
      onClick={handleClick}
      className="flex items-center gap-1.5 text-sm text-neutral-500 font-medium
                 hover:text-[#FF6B35] transition-colors"
    >
      <ArrowLeft size={15} />
      Volver
    </a>
  )
}
