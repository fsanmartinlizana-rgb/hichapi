'use client'

import { useState } from 'react'
import {
  getCuisinePlaceholderUrl,
  getCuisineEmoji,
  getCuisineGradient,
} from '@/lib/placeholders'

/**
 * Placeholder visual para restaurants sin photo_url.
 *
 * Estrategia:
 *  1. Intenta cargar la imagen del bucket `cuisine-placeholders` en Supabase.
 *  2. Si la imagen no existe (404), cae a un gradient + emoji por cuisine.
 *
 * Esto significa que el sistema funciona desde el primer commit aunque el
 * founder no haya subido las imágenes al bucket todavía. A medida que vayan
 * subiéndose, automáticamente reemplazan al fallback en producción.
 */

interface Props {
  cuisine: string | null | undefined
  className?: string
  /** Si true, no intenta cargar del bucket — solo muestra el gradient.
   *  Útil para previewers donde queremos garantizar consistencia visual. */
  forceFallback?: boolean
}

export function CuisinePlaceholder({ cuisine, className = '', forceFallback = false }: Props) {
  const [imgFailed, setImgFailed] = useState(forceFallback)
  const url = getCuisinePlaceholderUrl(cuisine)
  const emoji = getCuisineEmoji(cuisine)
  const [from, to] = getCuisineGradient(cuisine)

  if (imgFailed || forceFallback) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${className}`}
        style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
        aria-hidden="true"
      >
        <span className="text-5xl drop-shadow-sm select-none">{emoji}</span>
      </div>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      className={`w-full h-full object-cover ${className}`}
      onError={() => setImgFailed(true)}
      loading="lazy"
    />
  )
}
