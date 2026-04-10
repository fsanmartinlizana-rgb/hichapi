'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <span className="text-5xl block">⚠️</span>
        <h2 className="text-xl font-bold text-[#1A1A2E]">Algo salió mal</h2>
        <p className="text-sm text-neutral-500 leading-relaxed">
          Ocurrió un error inesperado. Intenta recargar la página.
        </p>
        {error.digest && (
          <p className="text-neutral-300 text-xs font-mono">Ref: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] transition-colors"
          >
            Reintentar
          </button>
          <a href="/" className="px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-500 text-sm hover:border-neutral-300 transition-colors">
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  )
}
