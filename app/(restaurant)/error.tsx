'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function RestaurantError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Restaurant panel error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center h-screen bg-[#0A0A14]">
      <div className="text-center space-y-4 max-w-md px-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <h2 className="text-white text-xl font-bold">Algo salió mal</h2>
        <p className="text-white/40 text-sm leading-relaxed">
          Ocurrió un error inesperado. Puedes intentar recargar o volver al inicio.
        </p>
        {error.digest && (
          <p className="text-white/20 text-xs font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold
                       hover:bg-[#e55a2b] transition-colors"
          >
            <RefreshCw size={14} /> Reintentar
          </button>
          <a
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:text-white/60 transition-colors"
          >
            Ir al dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
