'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Map, RotateCcw, SearchX, Loader2 } from 'lucide-react'
import { ChatBox } from '@/components/chat/ChatBox'
import { ResultsGrid, ResultsGridSkeleton } from '@/components/discovery/ResultsGrid'
import { RestaurantResult, ChapiIntent } from '@/lib/types'

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

// ── #3: Estado de sin resultados ──────────────────────────────────────────────
function NoResultsBanner({
  intent,
  onFetch,
  onReset,
}: {
  intent: ChapiIntent
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

  return (
    <div className="max-w-md mx-auto px-4 text-center py-12">
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8">
        <SearchX size={40} className="mx-auto mb-4 text-neutral-300" strokeWidth={1.5} />
        <h3 className="font-semibold text-[#1A1A2E] mb-2">
          Aún no tenemos restaurantes aquí
        </h3>
        <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
          No encontré opciones para tu búsqueda en nuestra base de datos.
          Puedo buscar restaurantes en esa zona y agregarlos ahora.
        </p>

        {done ? (
          <div className="text-sm font-medium text-green-600">
            {count > 0
              ? `✅ Agregué ${count} restaurante${count > 1 ? 's' : ''} — buscando de nuevo...`
              : '😔 No encontré más opciones por ahora. Intenta otra zona.'}
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
              {fetching ? <><Loader2 size={15} className="animate-spin" /> Buscando restaurantes...</> : '🔍 Buscar restaurantes en esta zona'}
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
    </div>
  )
}

export default function Home() {
  const [results, setResults]           = useState<RestaurantResult[]>([])
  const [query, setQuery]               = useState('')
  const [status, setStatus]             = useState('')
  const [isSearching, setIsSearching]   = useState(false)
  const [noResults, setNoResults]       = useState<ChapiIntent | null>(null)
  const [searchKey, setSearchKey]       = useState(0)
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

  const handleResults = useCallback((newResults: RestaurantResult[], userQuery: string) => {
    setResults(newResults)
    setQuery(userQuery)
    setIsSearching(false)
    setNoResults(null)
    setShowMap(false)
    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [])

  const handleStatusChange = useCallback((s: string) => setStatus(s), [])
  const handleLoadingChange = useCallback((loading: boolean) => setIsSearching(loading), [])

  // #3 — no results callback
  const handleNoResults = useCallback((intent: ChapiIntent) => {
    setIsSearching(false)
    setNoResults(intent)
    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [])

  const handleReset = useCallback(() => {
    setResults([])
    setQuery('')
    setStatus('')
    setIsSearching(false)
    setNoResults(null)
    setShowMap(false)
    setSearchKey(k => k + 1)
    clearPersisted()
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }, [])

  const showResultsSection = results.length > 0 || isSearching || noResults !== null

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
        />

        {status && <p className="mt-4 text-sm text-neutral-400 animate-pulse">{status}</p>}
      </section>

      {/* Results section */}
      {showResultsSection && (
        <section id="results" className="pb-20">

          {/* Toolbar */}
          {!noResults && (
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
          {!isSearching && !noResults && showMap && (
            <div className="w-full max-w-4xl mx-auto px-4 mb-6">
              <ResultsMap results={results} />
            </div>
          )}

          {/* Content */}
          {isSearching ? (
            <ResultsGridSkeleton />
          ) : noResults ? (
            <NoResultsBanner
              intent={noResults}
              onFetch={() => {
                setNoResults(null)
                setSearchKey(k => k + 1)
              }}
              onReset={handleReset}
            />
          ) : (
            <ResultsGrid results={results} query={query} />
          )}
        </section>
      )}

      <footer className="text-center pb-8 text-xs text-neutral-300 space-y-1.5">
        <p>HiChapi · Santiago, Chile</p>
        <p>
          <Link href="/unete" className="text-neutral-400 hover:text-[#FF6B35] transition-colors underline underline-offset-2">
            ¿Eres dueño de un restaurante? Súmate a Chapi →
          </Link>
        </p>
      </footer>
    </main>
  )
}
