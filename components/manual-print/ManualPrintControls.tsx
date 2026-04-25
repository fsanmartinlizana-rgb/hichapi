'use client'

import { useState, useEffect } from 'react'
import { Printer, CheckCircle2, AlertCircle, RefreshCw, Clock, ChevronDown } from 'lucide-react'
import type { ManualPrintControlsProps } from '@/lib/manual-print/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CajaPrinter {
  id:   string
  name: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('es-CL', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// ── ManualPrintControls ───────────────────────────────────────────────────────

export function ManualPrintControls({
  order,
  onPrintRequest,
  printState,
  restaurantId,
}: ManualPrintControlsProps & { restaurantId: string }) {

  const [cajaPrinters, setCajaPrinters]     = useState<CajaPrinter[]>([])
  const [loadingPrinters, setLoadingPrinters] = useState(true)
  const [selectedPrinter, setSelectedPrinter] = useState<string>('')
  const [showSelector, setShowSelector]     = useState(false)

  // Load CAJA printers for this restaurant
  useEffect(() => {
    if (!restaurantId) return
    setLoadingPrinters(true)
    fetch(`/api/printers?restaurant_id=${restaurantId}`)
      .then(r => r.json())
      .then(data => {
        const caja: CajaPrinter[] = (data.printers ?? [])
          .filter((p: any) => p.kind === 'caja' && p.active)
          .map((p: any) => ({ id: p.id, name: p.name }))
        setCajaPrinters(caja)
        // Auto-select if only one
        if (caja.length === 1) setSelectedPrinter(caja[0].name)
      })
      .catch(() => setCajaPrinters([]))
      .finally(() => setLoadingPrinters(false))
  }, [restaurantId])

  // Only show for eligible order statuses
  const eligibleStatuses = ['delivered', 'ready', 'paying']
  if (!eligibleStatuses.includes(order.status)) return null

  const { precuentaStatus, precuentaRequested, precuentaTimestamp, precuentaError } = printState

  const isLoading = precuentaStatus === 'loading'
  const isSuccess = precuentaStatus === 'success' || precuentaRequested
  const isError   = precuentaStatus === 'error'
  const noPrinters = !loadingPrinters && cajaPrinters.length === 0

  // Button disabled when: loading, already sent, no printers, or multiple printers with none selected
  const isDisabled =
    isLoading ||
    isSuccess ||
    noPrinters ||
    (cajaPrinters.length > 1 && !selectedPrinter)

  async function handleClick() {
    if (isDisabled) return
    // Pass selected printer name via onPrintRequest
    // The hook reads it from a shared ref set below
    await onPrintRequest('precuenta', selectedPrinter || cajaPrinters[0]?.name || '')
  }

  return (
    <div
      className="px-4 py-3 border-t space-y-2"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {/* Section label */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">
        Precuenta
      </p>

      {/* Printer selector — only shown when there are multiple CAJA printers */}
      {!isSuccess && cajaPrinters.length > 1 && (
        <div className="relative">
          <button
            onClick={() => setShowSelector(v => !v)}
            className="w-full min-h-[44px] flex items-center justify-between gap-2 px-3 rounded-xl border text-sm transition-all duration-200 bg-white/5 border-white/12 text-white/70 hover:border-white/25"
          >
            <div className="flex items-center gap-2">
              <Printer size={13} className="text-white/40 shrink-0" />
              <span className={selectedPrinter ? 'text-white/80' : 'text-white/30'}>
                {selectedPrinter || 'Seleccionar impresora…'}
              </span>
            </div>
            <ChevronDown
              size={13}
              className={`text-white/30 transition-transform duration-200 ${showSelector ? 'rotate-180' : ''}`}
            />
          </button>

          {showSelector && (
            <div
              className="absolute z-20 w-full mt-1 rounded-xl border overflow-hidden shadow-xl"
              style={{ background: '#1C1C2E', borderColor: 'rgba(255,255,255,0.12)' }}
            >
              {cajaPrinters.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPrinter(p.name); setShowSelector(false) }}
                  className={[
                    'w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors',
                    selectedPrinter === p.name
                      ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                      : 'text-white/70 hover:bg-white/5',
                  ].join(' ')}
                >
                  <Printer size={12} className="shrink-0" />
                  <span className="font-mono font-semibold">{p.name}</span>
                  {selectedPrinter === p.name && (
                    <CheckCircle2 size={12} className="ml-auto shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No CAJA printers configured */}
      {noPrinters && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/8">
          <AlertCircle size={12} className="text-amber-400 shrink-0" />
          <p className="text-[11px] text-amber-300/80">
            No hay impresoras de caja configuradas.{' '}
            <a href="/impresoras" className="underline hover:text-amber-200">
              Agregar en Impresoras
            </a>
          </p>
        </div>
      )}

      {/* Main button */}
      {!noPrinters && (
        <button
          onClick={handleClick}
          disabled={isDisabled}
          aria-label={
            isSuccess  ? 'Precuenta ya solicitada'
            : isLoading ? 'Solicitando precuenta…'
            : cajaPrinters.length > 1 && !selectedPrinter
            ? 'Selecciona una impresora primero'
            : 'Solicitar precuenta'
          }
          className={[
            'w-full min-h-[44px] flex items-center justify-center gap-2',
            'rounded-xl border text-sm font-semibold transition-all duration-200',
            isSuccess
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 cursor-default'
              : isError
              ? 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/15 active:scale-[0.98]'
              : isLoading
              ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
              : isDisabled
              ? 'bg-white/3 border-white/8 text-white/25 cursor-not-allowed'
              : 'bg-white/6 border-white/15 text-white/80 hover:bg-[#FF6B35]/10 hover:border-[#FF6B35]/40 hover:text-[#FF6B35] active:scale-[0.98]',
          ].join(' ')}
        >
          {isLoading ? (
            <RefreshCw size={15} className="animate-spin shrink-0" />
          ) : isSuccess ? (
            <CheckCircle2 size={15} className="shrink-0" />
          ) : isError ? (
            <AlertCircle size={15} className="shrink-0" />
          ) : (
            <Printer size={15} className="shrink-0" />
          )}

          {isLoading
            ? 'Solicitando…'
            : isSuccess
            ? `Precuenta enviada${cajaPrinters.length === 1 ? ` · ${cajaPrinters[0].name}` : selectedPrinter ? ` · ${selectedPrinter}` : ''}`
            : isError
            ? 'Reintentar'
            : cajaPrinters.length > 1 && !selectedPrinter
            ? 'Selecciona impresora'
            : cajaPrinters.length === 1
            ? `Precuenta → ${cajaPrinters[0].name}`
            : `Precuenta → ${selectedPrinter}`}
        </button>
      )}

      {/* Timestamp */}
      {isSuccess && precuentaTimestamp && (
        <div className="flex items-center gap-1.5 text-emerald-400/60">
          <Clock size={10} className="shrink-0" />
          <p className="text-[10px]">
            Solicitada a las {formatTimestamp(precuentaTimestamp)}
          </p>
        </div>
      )}

      {/* Error message */}
      {isError && precuentaError && (
        <div className="flex items-start gap-1.5 text-red-400/80">
          <AlertCircle size={10} className="shrink-0 mt-0.5" />
          <p className="text-[10px] leading-snug">{precuentaError}</p>
        </div>
      )}
    </div>
  )
}
