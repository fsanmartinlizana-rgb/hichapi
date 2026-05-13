'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Map, RotateCcw, SearchX, Loader2, ArrowRight } from 'lucide-react'
import { ChatBox, type NoCuisineMatchInfo, type NoResultsDetail } from '@/components/chat/ChatBox'
import { ResultsGrid, ResultsGridSkeleton } from '@/components/discovery/ResultsGrid'
import { RestaurantResult, ChapiIntent } from '@/lib/types'
import { trackSearch, trackSearchResults } from '@/lib/tracking'

// ── Persisted state ───────────────────────────────────────────────────────────
// Guardamos los resultados y el query en sessionStorage para que cuando el
// usuario abre un restaurante y presiona "Volver", la búsqueda se rehidrate
// sin perder los resultados ni la posición del scroll.

const SEARCH_STATE_KEY = 'hichapi_buscar_state'

interface PersistedSearchState {
  results: RestaurantResult[]
  query:   string
  scrollY: number
}

function loadPersisted(): PersistedSearchState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SEARCH_STATE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedSearchState
  } catch {
    return null
  }
}

function savePersisted(state: PersistedSearchState) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(state))
  } catch { /* quota exceeded, ignore */ }
}

function clearPersisted() {
  if (typeof window === 'undefined') return
  try { sessionStorage.removeItem(SEARCH_STATE_KEY) } catch { /* */ }
}

const ResultsMap = dynamic(
  () => import('@/components/discovery/ResultsMap').then(m => m.ResultsMap),
  { ssr: false, loading: () => <MapSkeleton /> }
)

function MapSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 mb-4">
      <div className="rounded-2xl bg-neutral-100 animate-pulse border border-neutral-100" style={{ height: '300px' }} />
    </div>
  )
}

// ── Banner contextual cuando el filtro de dietary/budget descarta todo ──────
// Diferenciado del "no hay nada en la zona": acá SÍ hay restaurants, pero
// ninguno satisface dietary (ej. sin gluten) o budget. El agente no puede
// ayudar (los placeholders no tienen tags ricos), así que en lugar de
// disparar enrichment inútil le decimos al user qué ofrecemos.
function ContextualNoResultsBanner({
  detail,
  onShowAll,
  onReset,
}: {
  detail: NoResultsDetail
  onShowAll: () => void
  onReset: () => void
}) {
  const isDietary = detail.reason === 'no_dietary_match'
  const isBudget  = detail.reason === 'no_budget_match'
  const dietaryStr = detail.dietary_restrictions.join(' / ')
  const zoneStr    = detail.zone ?? 'esa zona'
  const cuisineStr = detail.cuisine ? `${detail.cuisine} ` : ''

  const title = isDietary
    ? `Sin opciones ${dietaryStr} en ${zoneStr}`
    : isBudget
    ? `Sin opciones bajo tu presupuesto en ${zoneStr}`
    : `Sin opciones en ${zoneStr}`

  const explanation = isDietary
    ? `Hay ${detail.alternatives_count} restaurant${detail.alternatives_count !== 1 ? 's' : ''} ${cuisineStr}en ${zoneStr}, pero aún no detallaron qué platos son ${dietaryStr}. A medida que los dueños suban su carta completa, vas a poder filtrar mejor.`
    : isBudget
    ? `Hay ${detail.alternatives_count} restaurant${detail.alternatives_count !== 1 ? 's' : ''} ${cuisineStr}en ${zoneStr}, pero los precios que tenemos cargados superan tu presupuesto. Podés subir el presupuesto o ver igualmente.`
    : `No encontré matches estrictos pero hay ${detail.alternatives_count} restaurants en la zona.`

  return (
    <div className="max-w-md mx-auto px-4 text-center py-12">
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8">
        <SearchX size={40} className="mx-auto mb-4 text-neutral-300" strokeWidth={1.5} />
        <h3 className="font-semibold text-[#1A1A2E] mb-2">{title}</h3>
        <p className="text-sm text-neutral-400 mb-6 leading-relaxed">{explanation}</p>
        <div className="flex flex-col gap-2">
          {detail.alternatives_count > 0 && (
            <button
              onClick={onShowAll}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                         bg-[#FF6B35] hover:bg-[#e55a2b]
                         text-white font-semibold text-sm transition-colors"
            >
              Ver los {detail.alternatives_count} restaurants en {zoneStr} <ArrowRight size={14} />
            </button>
          )}
          <button
            onClick={onReset}
            className="text-sm text-neutral-400 hover:text-[#FF6B35] transition-colors py-1"
          >
            Probar otra búsqueda
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Banner opt-in: hay zona con restaurants, pero ninguno de la cuisine pedida
function NoCuisineMatchBanner({
  info,
  onShowAlternatives,
  onReset,
}: {
  info: NoCuisineMatchInfo
  onShowAlternatives: () => void
  onReset: () => void
}) {
  return (
    <div className="max-w-md mx-auto px-4 text-center py-12">
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8">
        <SearchX size={40} className="mx-auto mb-4 text-neutral-300" strokeWidth={1.5} />
        <h3 className="font-semibold text-[#1A1A2E] mb-2">
          No tengo {info.cuisine} en {info.zone}
        </h3>
        <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
          Pero sí hay {info.alternatives_count} restaurant{info.alternatives_count !== 1 ? 's' : ''} de otras cocinas en {info.zone}.
          ¿Quieres verlos?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onShowAlternatives}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                       bg-[#FF6B35] hover:bg-[#e55a2b]
                       text-white font-semibold text-sm transition-colors"
          >
            Ver opciones en {info.zone} <ArrowRight size={14} />
          </button>
          <button
            onClick={onReset}
            className="text-sm text-neutral-400 hover:text-[#FF6B35] transition-colors py-1"
          >
            Probar otra búsqueda
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Estado de sin resultados (zona vacía o cuisine sin alternativas) ─────────
function NoResultsBanner({
  intent,
  suggestions,
  onFetch,
  onReset,
}: {
  intent: ChapiIntent
  suggestions: RestaurantResult[]
  onFetch: () => void
  onReset: () => void
}) {
  const [fetching, setFetching] = useState(false)
  const [done, setDone]         = useState(false)
  const [count, setCount]       = useState(0)

  async function handleFetch() {
    setFetching(true)
    try {
      const res  = await fetch('/api/search-ondemand', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ intent }),
      })
      const data = await res.json()
      setCount(data.inserted ?? 0)
      setDone(true)
      if ((data.inserted ?? 0) > 0) {
        setTimeout(() => onFetch(), 1500)
      }
    } catch {
      setFetching(false)
    }
  }

  // Resumen de qué buscó el user — feedback explícito de lo que entendimos
  const cuisineLabel = intent.cuisine_type ? `${intent.cuisine_type}` : null
  const zoneLabel    = intent.zone ?? null
  const dietaryLabel = (intent.dietary_restrictions ?? []).length > 0
    ? (intent.dietary_restrictions ?? []).join(' / ')
    : null
  const budgetLabel  = intent.budget_clp ? `hasta $${intent.budget_clp.toLocaleString('es-CL')}` : null

  const queryPills = [cuisineLabel, dietaryLabel, zoneLabel ? `en ${zoneLabel}` : null, budgetLabel]
    .filter(Boolean) as string[]

  const title = zoneLabel
    ? `No encontré restaurants en ${zoneLabel}`
    : 'No encontré matches para tu búsqueda'

  return (
    <div className="max-w-md mx-auto px-4 text-center py-12">
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8">
        <SearchX size={40} className="mx-auto mb-4 text-neutral-300" strokeWidth={1.5} />
        <h3 className="font-semibold text-[#1A1A2E] mb-1">{title}</h3>
        {queryPills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center mb-3">
            {queryPills.map((p, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
                {p}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
          Esta zona todavía no tiene cobertura en HiChapi.
          {zoneLabel && ' Puedo buscar restaurants ahí en Google y agregarlos ahora — toma ~10 segundos.'}
        </p>

        {done ? (
          <div className="text-sm font-medium leading-relaxed">
            {count > 0 ? (
              <span className="text-green-600">
                ✅ Agregué {count} restaurant{count > 1 ? 's' : ''} — buscando de nuevo...
              </span>
            ) : (
              <span className="text-neutral-500">
                😕 Google tampoco devolvió resultados para esta búsqueda. Probá una zona más céntrica o sin tantos filtros.
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleFetch}
              disabled={fetching}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                         bg-[#FF6B35] hover:bg-[#e55a2b] disabled:bg-neutral-200
                         text-white font-semibold text-sm transition-colors"
            >
              {fetching ? <><Loader2 size={15} className="animate-spin" /> Buscando en Google Maps...</> : '🔍 Buscar en Google Maps'}
            </button>
            <button
              onClick={onReset}
              className="text-sm text-neutral-400 hover:text-[#FF6B35] transition-colors py-1"
            >
              Probar otra búsqueda
            </button>
          </div>
        )}
      </div>

      {/* Sugerencias "te podría interesar" — cards mini de la misma cuisine
          en otras zonas. Solo si el backend nos las pasó (typical cuando
          fail_reason='no_zone_coverage' y hay cuisine pedida). */}
      {suggestions.length > 0 && (
        <div className="mt-8 text-left">
          <p className="text-sm font-semibold text-[#1A1A2E] text-center mb-1">
            {cuisineLabel
              ? `Mientras tanto, ${cuisineLabel}s con mejor rating en otras zonas`
              : 'Mientras tanto, top de Santiago'}
          </p>
          <p className="text-xs text-neutral-400 text-center mb-4">
            Estos sí los tenemos en HiChapi · ordenados por mejor rating
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestions.slice(0, 6).map(s => (
              <Link
                key={s.restaurant.id}
                href={`/r/${s.restaurant.slug}`}
                className="block bg-white rounded-xl border border-neutral-100 p-3 hover:border-[#FF6B35]/40 hover:shadow-sm transition-all text-left"
              >
                <p className="text-sm font-semibold text-[#1A1A2E] leading-tight truncate">
                  {s.restaurant.name}
                </p>
                <p className="text-[11px] text-neutral-400 mb-1.5">
                  {s.restaurant.neighborhood} · {s.restaurant.cuisine_type}
                </p>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-[#FF6B35]">★</span>
                  <span className="font-medium text-neutral-600">
                    {(s.restaurant.review_count ?? 0) > 0
                      ? s.restaurant.rating.toFixed(1)
                      : s.restaurant.google_rating?.toFixed(1) ?? '—'}
                  </span>
                  {(s.restaurant.review_count ?? 0) === 0 && s.restaurant.google_rating != null && (
                    <span className="text-[10px] text-neutral-400">· Google</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const [results, setResults]           = useState<RestaurantResult[]>([])
  const [query, setQuery]               = useState('')
  const [status, setStatus]             = useState('')
  const [isSearching, setIsSearching]   = useState(false)
  const [noResults, setNoResults]       = useState<ChapiIntent | null>(null)
  const [noResultsSuggestions, setNoResultsSuggestions] = useState<RestaurantResult[]>([])
  const [noCuisineMatch, setNoCuisineMatch] = useState<NoCuisineMatchInfo | null>(null)
  const [noResultsDetail, setNoResultsDetail] = useState<NoResultsDetail | null>(null)
  const [pendingAltNonce, setPendingAltNonce] = useState(0)
  const [searchKey, setSearchKey]       = useState(0)
  const [searchEventId, setSearchEventId] = useState<string | null>(null)
  const [showMap, setShowMap]           = useState(false)
  const hydratedRef = useRef(false)

  // Rehidratar al montar — si el usuario viene de "Volver" desde /r/[slug],
  // restauramos los resultados y la posición de scroll.
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const persisted = loadPersisted()
    if (persisted && persisted.results.length > 0) {
      setResults(persisted.results)
      setQuery(persisted.query)
      // restoramos scroll después de que el grid esté pintado
      requestAnimationFrame(() => {
        window.scrollTo({ top: persisted.scrollY, behavior: 'auto' })
      })
    }
  }, [])

  // Persistir cada vez que cambian los resultados
  useEffect(() => {
    if (results.length === 0) return
    savePersisted({ results, query, scrollY: window.scrollY })
  }, [results, query])

  // Antes de salir de la página, guardar el scroll actual
  useEffect(() => {
    function saveScroll() {
      if (results.length === 0) return
      savePersisted({ results, query, scrollY: window.scrollY })
    }
    window.addEventListener('beforeunload', saveScroll)
    window.addEventListener('pagehide', saveScroll)
    return () => {
      window.removeEventListener('beforeunload', saveScroll)
      window.removeEventListener('pagehide', saveScroll)
    }
  }, [results, query])

  const handleResults = useCallback((newResults: RestaurantResult[], userQuery: string, eventId: string | null) => {
    setResults(newResults)
    setQuery(userQuery)
    setSearchEventId(eventId)
    setIsSearching(false)
    setNoResults(null)
    setNoCuisineMatch(null)
    setNoResultsDetail(null)
    setShowMap(false)
    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [])

  const handleStatusChange = useCallback((s: string) => setStatus(s), [])
  const handleLoadingChange = useCallback((loading: boolean) => setIsSearching(loading), [])

  const handleNoResults = useCallback((intent: ChapiIntent, suggestions: RestaurantResult[]) => {
    setIsSearching(false)
    setNoResults(intent)
    setNoResultsSuggestions(suggestions ?? [])
    setNoCuisineMatch(null)
    setNoResultsDetail(null)
    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [])

  const handleNoCuisineMatch = useCallback((info: NoCuisineMatchInfo) => {
    setIsSearching(false)
    setNoCuisineMatch(info)
    setNoResults(null)
    setNoResultsDetail(null)
    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [])

  const handleNoResultsDetail = useCallback((detail: NoResultsDetail) => {
    setIsSearching(false)
    setNoResultsDetail(detail)
    setNoCuisineMatch(null)
    setNoResults(null)
    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [])

  const handleShowAlternatives = useCallback(() => {
    setNoCuisineMatch(null)
    setNoResultsDetail(null)
    setIsSearching(true)
    setPendingAltNonce(n => n + 1)
  }, [])

  const handleReset = useCallback(() => {
    setResults([])
    setQuery('')
    setStatus('')
    setIsSearching(false)
    setNoResults(null)
    setNoResultsSuggestions([])
    setNoCuisineMatch(null)
    setNoResultsDetail(null)
    setShowMap(false)
    setSearchKey(k => k + 1)
    clearPersisted()
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }, [])

  const showResultsSection =
    results.length > 0 || isSearching ||
    noResults !== null || noCuisineMatch !== null || noResultsDetail !== null

  return (
    <main className="min-h-screen" style={{ background: '#FAFAF8' }}>
      {/* Hero */}
      <section
        className="relative flex flex-col items-center justify-center px-4"
        style={{ minHeight: showResultsSection ? '50vh' : '100vh', transition: 'min-height 0.5s ease' }}
      >
        <div className="absolute top-6 left-6">
          <span className="font-bold text-xl tracking-tight" style={{ color: '#1A1A2E', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            hi<span style={{ color: '#FF6B35' }}>chapi</span>
          </span>
        </div>

        <div className="text-center mb-10 max-w-2xl">
          <h1
            className="font-bold mb-4 leading-tight"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: '#1A1A2E', fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            Dile a Chapi<br />
            <span style={{ color: '#FF6B35' }}>qué quieres comer</span>
          </h1>
          <p className="text-neutral-400 text-lg" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
            Como un amigo que sabe todos los restaurantes de Santiago
          </p>
        </div>

        <ChatBox
          key={searchKey}
          onResults={handleResults}
          onStatusChange={handleStatusChange}
          onLoadingChange={handleLoadingChange}
          onNoResults={handleNoResults}
          onNoCuisineMatchInZone={handleNoCuisineMatch}
          onNoResultsDetail={handleNoResultsDetail}
          pendingAlternativeNonce={pendingAltNonce}
        />

        {/* Guía explícita: mostrar los 3 datos óptimos para una búsqueda
            precisa. Solo cuando el user todavía no buscó nada (hero state).
            Una vez que aparece la sección de resultados, ocultar para no
            ocupar espacio. */}
        {!showResultsSection && (
          <div className="mt-6 max-w-2xl w-full px-4">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-neutral-200 px-6 py-5">
              <p className="text-lg font-semibold text-[#1A1A2E] text-center mb-4">
                Para resultados precisos, cuéntale a Chapi:
              </p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center sm:justify-center gap-y-3 sm:gap-x-6 sm:gap-y-2">
                <span className="flex items-center gap-2 text-base text-slate-800">
                  <span className="text-xl" aria-hidden="true">🍴</span>
                  <span>
                    <strong className="font-semibold text-[#1A1A2E]">Qué cocina</strong>{' '}
                    <span className="text-slate-600 text-sm">(italiana, sushi, vegana...)</span>
                  </span>
                </span>
                <span className="flex items-center gap-2 text-base text-slate-800">
                  <span className="text-xl" aria-hidden="true">📍</span>
                  <span>
                    <strong className="font-semibold text-[#1A1A2E]">Dónde</strong>{' '}
                    <span className="text-slate-600 text-sm">(Providencia, cerca de mí...)</span>
                  </span>
                </span>
                <span className="flex items-center gap-2 text-base text-slate-800">
                  <span className="text-xl" aria-hidden="true">💰</span>
                  <span>
                    <strong className="font-semibold text-[#1A1A2E]">Cuánto</strong>{' '}
                    <span className="text-slate-600 text-sm">(15 lucas, 30 mil...)</span>
                  </span>
                </span>
              </div>
              <p className="text-sm text-slate-700 text-center mt-4">
                Mientras más detalle, mejor recomendación.{' '}
                <span className="text-slate-600">Si pides solo uno, te muestro lo más popular.</span>
              </p>
            </div>
          </div>
        )}

        {status && <p className="mt-4 text-sm text-neutral-400 animate-pulse">{status}</p>}
      </section>

      {/* Results section */}
      {showResultsSection && (
        <section id="results" className="pb-20">

          {/* Toolbar */}
          {!noResults && !noCuisineMatch && !noResultsDetail && (
            <div className="flex items-center justify-between max-w-4xl mx-auto px-4 mb-4 gap-2">
              {!isSearching && process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
                <button
                  onClick={() => setShowMap(v => !v)}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-full border
                             border-neutral-200 bg-white text-neutral-500
                             hover:border-[#FF6B35] hover:text-[#FF6B35]
                             transition-colors duration-150 shadow-sm"
                >
                  <Map size={14} />
                  {showMap ? 'Ocultar mapa' : 'Ver en el mapa'}
                </button>
              )}
              {(isSearching || !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) && <span />}
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border
                           border-neutral-200 bg-white text-neutral-400
                           hover:border-[#FF6B35] hover:text-[#FF6B35]
                           transition-colors duration-150 shadow-sm ml-auto"
              >
                <RotateCcw size={13} />
                Nueva búsqueda
              </button>
            </div>
          )}

          {/* Map */}
          {!isSearching && !noResults && !noCuisineMatch && !noResultsDetail && showMap && (
            <div className="w-full max-w-4xl mx-auto px-4 mb-6">
              <ResultsMap results={results} />
            </div>
          )}

          {/* Content */}
          {isSearching ? (
            <ResultsGridSkeleton />
          ) : noResultsDetail ? (
            <ContextualNoResultsBanner
              detail={noResultsDetail}
              onShowAll={handleShowAlternatives}
              onReset={handleReset}
            />
          ) : noCuisineMatch ? (
            <NoCuisineMatchBanner
              info={noCuisineMatch}
              onShowAlternatives={handleShowAlternatives}
              onReset={handleReset}
            />
          ) : noResults ? (
            <NoResultsBanner
              intent={noResults}
              suggestions={noResultsSuggestions}
              onFetch={() => {
                setNoResults(null)
                setNoResultsSuggestions([])
                setSearchKey(k => k + 1)
              }}
              onReset={handleReset}
            />
          ) : (
            <ResultsGrid results={results} query={query} searchEventId={searchEventId} />
          )}
        </section>
      )}

      <footer className="text-center pb-10 text-sm text-slate-500 space-y-2">
        <p>HiChapi · Santiago, Chile</p>
        <p>
          <Link
            href="/register"
            className="text-slate-700 hover:text-[#FF6B35] transition-colors underline underline-offset-2 font-medium"
          >
            ¿Eres dueño de un restaurante? Súmate a Chapi →
          </Link>
        </p>
      </footer>
    </main>
  )
}
