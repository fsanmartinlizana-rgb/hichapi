'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, ChevronDown, Copy, Check } from 'lucide-react'

/**
 * Error boundary del panel de restaurante.
 * Antes solo mostraba "Algo salió mal" sin más info, lo que hacía imposible
 * diagnosticar bugs en producción para los restaurantes que reportaban
 * problemas. Ahora:
 *   - Logguea siempre con metadata útil (path, ua, tiempo)
 *   - Botón opcional "Ver detalles" que muestra el mensaje + stack truncado
 *   - Botón "Copiar" para que el restorant pueda mandar la info por soporte
 */
export default function RestaurantError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Log estructurado para grep en logs de Vercel
    console.error('[restaurant-error]', {
      message: error.message,
      digest:  error.digest,
      stack:   error.stack?.split('\n').slice(0, 8).join('\n'),
      path:    typeof window !== 'undefined' ? window.location.pathname : null,
      ua:      typeof navigator !== 'undefined' ? navigator.userAgent : null,
      ts:      new Date().toISOString(),
    })
  }, [error])

  const detailText = [
    `Mensaje: ${error.message || '(sin mensaje)'}`,
    error.digest ? `Digest: ${error.digest}` : null,
    typeof window !== 'undefined' ? `Ruta: ${window.location.pathname}` : null,
    `Cuándo: ${new Date().toLocaleString('es-CL')}`,
    error.stack ? `\nStack:\n${error.stack.split('\n').slice(0, 6).join('\n')}` : null,
  ].filter(Boolean).join('\n')

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(detailText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard puede fallar en HTTP no seguro */
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0A0A14] p-4">
      <div className="text-center space-y-4 max-w-lg w-full px-2">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <h2 className="text-white text-xl font-bold">Algo salió mal</h2>
        <p className="text-white/40 text-sm leading-relaxed">
          Ocurrió un error inesperado. Podés reintentar o volver al inicio. Si se repite,
          tocá <strong className="text-white/60">Ver detalles</strong> y mandanos esa info por soporte.
        </p>
        {error.digest && (
          <p className="text-white/20 text-xs font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] transition-colors"
            style={{ minHeight: 44 }}
          >
            <RefreshCw size={14} /> Reintentar
          </button>
          <a
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm hover:text-white/60 transition-colors"
            style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
          >
            Ir al dashboard
          </a>
        </div>

        {/* Detalles colapsables — críticos para QA y soporte */}
        <button
          type="button"
          onClick={() => setShowDetails(v => !v)}
          className="text-white/35 hover:text-white/60 text-xs inline-flex items-center gap-1 mt-2"
        >
          <ChevronDown
            size={12}
            className={`transition-transform ${showDetails ? 'rotate-180' : ''}`}
          />
          {showDetails ? 'Ocultar' : 'Ver'} detalles técnicos
        </button>
        {showDetails && (
          <div className="mt-3 text-left rounded-xl border border-white/10 bg-white/3 p-3 max-h-64 overflow-auto">
            <pre className="text-[10px] text-white/55 whitespace-pre-wrap font-mono leading-relaxed">
              {detailText}
            </pre>
            <button
              type="button"
              onClick={copyDetails}
              className={`mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                copied
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : 'bg-white/8 border border-white/15 text-white/80 hover:bg-white/12'
              }`}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? '¡Copiado!' : 'Copiar info'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
