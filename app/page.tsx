'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Map, X, RotateCcw } from 'lucide-react'
import { ChatBox } from '@/components/chat/ChatBox'
import { ResultsGrid, ResultsGridSkeleton } from '@/components/discovery/ResultsGrid'
import { RestaurantResult } from '@/lib/types'

// ─── Rule 1 & 7: Lazy-load Mapbox — only bundled when user requests map ──────
const ResultsMap = dynamic(
  () => import('@/components/discovery/ResultsMap').then(m => m.ResultsMap),
  { ssr: false, loading: () => <MapSkeleton /> }
)

function MapSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 mb-4">
      <div
        className="rounded-2xl bg-neutral-100 animate-pulse border border-neutral-100"
        style={{ height: '300px' }}
      />
    </div>
  )
}

export default function Home() {
  const [results, setResults] = useState<RestaurantResult[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  // searchKey forces ChatBox remount → clears accumulated intent on reset
  const [searchKey, setSearchKey] = useState(0)
  // ─── Rule 1: Map hidden by default ────────────────────────────────────────
  const [showMap, setShowMap] = useState(false)

  // ─── Rule 2: Stable callback — won't recreate on each render ──────────────
  const handleResults = useCallback((newResults: RestaurantResult[], userQuery: string) => {
    setResults(newResults)
    setQuery(userQuery)
    setIsSearching(false)
    setShowMap(false) // Reset map visibility on new search (Rule 6)
    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [])

  const handleStatusChange = useCallback((s: string) => setStatus(s), [])

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsSearching(loading)
  }, [])

  // ─── Reset: clear results + intent (remounts ChatBox via key change) ──────
  const handleReset = useCallback(() => {
    setResults([])
    setQuery('')
    setStatus('')
    setIsSearching(false)
    setShowMap(false)
    setSearchKey((k) => k + 1)
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 50)
  }, [])

  return (
    <main className="min-h-screen" style={{ background: '#FAFAF8' }}>
      {/* Hero section */}
      <section
        className="relative flex flex-col items-center justify-center px-4"
        style={{
          minHeight: results.length > 0 ? '50vh' : '100vh',
          transition: 'min-height 0.5s ease',
        }}
      >
        {/* Logo */}
        <div className="absolute top-6 left-6">
          <span
            className="font-bold text-xl tracking-tight"
            style={{ color: '#1A1A2E', fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            hi<span style={{ color: '#FF6B35' }}>chapi</span>
          </span>
        </div>

        {/* Headline */}
        <div className="text-center mb-10 max-w-2xl">
          <h1
            className="font-bold mb-4 leading-tight"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              color: '#1A1A2E',
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}
          >
            Dile a Chapi
            <br />
            <span style={{ color: '#FF6B35' }}>qué quieres comer</span>
          </h1>
          <p
            className="text-neutral-400 text-lg"
            style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
          >
            Como un amigo que sabe todos los restaurantes de Santiago
          </p>
        </div>

        <ChatBox
          key={searchKey}
          onResults={handleResults}
          onStatusChange={handleStatusChange}
          onLoadingChange={handleLoadingChange}
        />

        {status && (
          <p className="mt-4 text-sm text-neutral-400 animate-pulse">{status}</p>
        )}
      </section>

      {/* Results — show skeleton while searching, real cards when done */}
      {(results.length > 0 || isSearching) && (
        <section id="results" className="pb-20">

          {/* ── Toolbar: map toggle + reset button ── */}
          <div className="flex items-center justify-between max-w-4xl mx-auto px-4 mb-4 gap-2">
            {/* Map toggle — only when we have real results */}
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

            {/* Spacer so reset button stays right even without map btn */}
            {(isSearching || !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) && <span />}

            {/* Nueva búsqueda — always visible when results are shown */}
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

          {/* ── Rule 1: Map only mounts when showMap = true ── */}
          {!isSearching && showMap && (
            <div className="w-full max-w-4xl mx-auto px-4 mb-6">
              <ResultsMap results={results} />
            </div>
          )}

          {/* Skeleton replaces old results while Chapi is thinking */}
          {isSearching ? (
            <ResultsGridSkeleton />
          ) : (
            <ResultsGrid results={results} query={query} />
          )}
        </section>
      )}

      <footer className="text-center pb-8 text-xs text-neutral-300 space-y-1.5">
        <p>HiChapi · Santiago, Chile</p>
        <p>
          <Link
            href="/unete"
            className="text-neutral-400 hover:text-[#FF6B35] transition-colors underline underline-offset-2"
          >
            ¿Eres dueño de un restaurante? Súmate a Chapi →
          </Link>
        </p>
      </footer>
    </main>
  )
}
