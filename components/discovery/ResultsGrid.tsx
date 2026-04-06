import { RestaurantResult } from '@/lib/types'
import { ResultCard } from './ResultCard'

interface ResultsGridProps {
  results: RestaurantResult[]
  query: string
}

export function ResultsGrid({ results, query }: ResultsGridProps) {
  if (results.length === 0) return null

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-12">
      <p className="text-sm text-neutral-400 mb-4 text-center">
        <span className="text-[#1A1A2E] font-medium">{results.length} opciones</span>
        {' '}que encontró Chapi para ti
      </p>

      <div
        className={`grid gap-4 ${
          results.length === 1
            ? 'grid-cols-1 max-w-sm mx-auto'
            : results.length === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {results.map((result, i) => (
          <ResultCard key={result.restaurant.id} result={result} index={i} />
        ))}
      </div>
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
