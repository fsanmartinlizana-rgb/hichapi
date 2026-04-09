'use client'

import { useEffect } from 'react'
import { RefreshCw, Utensils } from 'lucide-react'

export default function TableError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[TableView] Error:', error)
  }, [error])

  return (
    <div className="h-screen bg-[#0A0A14] flex flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center">
        <Utensils className="w-8 h-8 text-orange-400" />
      </div>
      <div>
        <h1 className="text-white text-xl font-semibold mb-2">
          Algo salió mal
        </h1>
        <p className="text-gray-400 text-sm max-w-xs">
          No pudimos cargar la carta. Por favor recarga la página o pide ayuda al personal.
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Reintentar
      </button>
    </div>
  )
}
