'use client'

import { useState, useEffect, type ReactNode } from 'react'
import HeroToggle, { type Audience } from './HeroToggle'

/**
 * Wrapper client que controla qué audiencia ve la landing.
 *
 * - Renderiza el HeroToggle con el toggle interactivo.
 * - Muestra `comensalSection` o `restauranteSection` según selección.
 * - Por defecto arranca en `comensal` (audiencia más amplia + más conversión
 *   en visitas frías que llegan desde Google).
 *
 * Las secciones se reciben como children/props para que el servidor pueda
 * renderearlas estáticas y el cliente solo decide cuál mostrar (mejor SEO
 * que un fetch dinámico).
 */
export default function AudienceLanding({
  comensalSection,
  restauranteSection,
}: {
  comensalSection: ReactNode
  restauranteSection: ReactNode
}) {
  const [audience, setAudience] = useState<Audience>('comensal')

  // Sincroniza con el hash de la URL (#comensales / #restaurantes) para que
  // links del navbar y enlaces externos puedan abrir directo en una audiencia.
  useEffect(() => {
    const apply = () => {
      const h = (typeof window !== 'undefined' ? window.location.hash : '').toLowerCase()
      if (h.includes('restaurant')) {
        setAudience('restaurante')
        if (h === '#restaurantes') setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
      } else if (h.includes('comensal')) {
        setAudience('comensal')
        if (h === '#comensales') setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
      } else if (h.includes('planes')) {
        setAudience('restaurante')
      }
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])

  // Efecto separado para hacer scroll a planes una vez que la audiencia cambia
  // y la sección de restaurantes está renderizada en el DOM.
  useEffect(() => {
    if (audience === 'restaurante' && typeof window !== 'undefined' && window.location.hash.toLowerCase().includes('planes')) {
      const scroll = () => {
        const el = document.getElementById('planes')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' })
        } else {
          // Si aún no está en el DOM, reintentar en un momento
          setTimeout(scroll, 50)
        }
      }
      setTimeout(scroll, 50)
    }
  }, [audience])

  return (
    <>
      <HeroToggle active={audience} onChange={setAudience} />
      {audience === 'comensal' ? comensalSection : restauranteSection}
    </>
  )
}
