'use client'

import type { StepConfirmacionProps } from './types'
import { calculateTotal } from './utils'

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function ConfirmOrderSummary({ selectedTable, pax, lines }: Pick<StepConfirmacionProps, 'selectedTable' | 'pax' | 'lines'>) {
  const total = calculateTotal(lines).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.03)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/35">Mesa</p>
          <p className="mt-0.5 text-lg font-bold text-white">{selectedTable.label}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/35">Personas</p>
          <p className="mt-0.5 text-lg font-bold text-white">{pax}</p>
        </div>
      </div>

      {/* Items */}
      <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {lines.map(line => (
          <div key={line.menuItemId} className="flex items-start gap-3 px-5 py-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-400">
              {line.qty}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/90 truncate">{line.name}</p>
              {line.note && <p className="mt-0.5 text-xs text-white/40 italic truncate">{line.note}</p>}
            </div>
            <span className="flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium capitalize text-white/40" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
              {line.destination}
            </span>
            <span className="flex-shrink-0 text-sm font-semibold text-white/80">
              {(line.unitPrice * line.qty).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
        <span className="text-sm font-semibold text-white/60">Total</span>
        <span className="text-lg font-bold text-white">{total}</span>
      </div>
    </div>
  )
}

export default function StepConfirmacion({ selectedTable, pax, lines, saving, error, onConfirm, onBack }: StepConfirmacionProps) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Confirmar comanda</h2>
          <p className="mt-1 text-sm text-white/40">Revisa los detalles antes de enviar la comanda.</p>
        </div>

        <ConfirmOrderSummary selectedTable={selectedTable} pax={pax} lines={lines} />

        {error !== null && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <Spinner />}
            {saving ? 'Guardando…' : 'Confirmar comanda'}
          </button>
          <button
            onClick={onBack}
            disabled={saving}
            className="flex-1 rounded-xl border py-3 text-sm font-medium text-white/60 transition hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: 'rgba(255,255,255,0.12)' }}
          >
            Atrás
          </button>
        </div>
      </div>
    </div>
  )
}
