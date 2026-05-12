'use client'

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { RestaurantResult } from '@/lib/types'
import { ResultCard } from './ResultCard'

interface ResultsGridProps {
  results: RestaurantResult[]
  query: string
  /** ID del search_event para tracking de clicks. Null si tracking falló. */
  searchEventId?: string | null
}

const PAGE_SIZE = 12

export function ResultsGrid({ results, searchEventId }: ResultsGridProps) {
  const [visible, setVisible] = useState(PAGE_SIZE)

  // Reset cuando cambian los resultados (nueva búsqueda).
  useEffect(() => { setVisible(PAGE_SIZE) }, [results])

  if (results.length === 0) return null

  const visibleResults = results.slice(0, visible)
  const remaining = results.length - visibleResults.length
  const showAll = remaining <= 0

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-12">
      <p className="text-sm text-neutral-400 mb-4 text-center">
        <span className="text-[#1A1A2E] font-medium">
          {visibleResults.length}{remaining > 0 ? ` de ${results.length}` : ''} opciones
        </span>
        {' '}que encontró Chapi para ti
      </p>

      <div
        className={`grid gap-4 ${
          visibleResults.length === 1
            ? 'grid-cols-1 max-w-sm mx-auto'
            : visibleResults.length === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {visibleResults.map((result, i) => (
          <ResultCard
            key={result.restaurant.id}
            result={result}
            index={i}
            searchEventId={searchEventId ?? null}
          />
        ))}
      </div>

      {!showAll && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setVisible(v => v + PAGE_SIZE)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full
                       bg-white border border-neutral-200 text-[#1A1A2E]
                       hover:border-[#FF6B35] hover:text-[#FF6B35]
                       transition-colors duration-150 shadow-sm text-sm font-medium"
          >
            Ver {Math.min(PAGE_SIZE, remaining)} más
            <ChevronDown size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Skeleton mientras se busca ────────────────────────────────────────────────
export function ResultsGridSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-12">
      {/* "X opciones" placeholder */}
      <div className="flex justify-center mb-4">
        <div className="h-4 w-52 rounded-full bg-neutral-200 animate-pulse" />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-neutral-100"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Imagen */}
            <div className="aspect-video bg-neutral-200 animate-pulse" />
            {/* Contenido */}
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="h-4 w-2/3 rounded bg-neutral-200 animate-pulse" />
                <div className="h-4 w-8 rounded bg-neutral-200 animate-pulse ml-2" />
              </div>
              <div className="h-3 w-1/3 rounded bg-neutral-100 animate-pulse" />
              {/* Dish card */}
              <div className="bg-neutral-50 rounded-xl p-3 space-y-2 mt-2">
                <div className="h-3 w-1/4 rounded bg-neutral-200 animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-neutral-200 animate-pulse" />
                <div className="h-3 w-full rounded bg-neutral-100 animate-pulse" />
                <div className="h-5 w-1/3 rounded bg-neutral-200 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
