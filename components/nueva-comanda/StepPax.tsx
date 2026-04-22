'use client'

interface StepPaxProps {
  table: { id: string; label: string; seats: number }
  pax: number
  onChangePax: (pax: number) => void
  onConfirm: () => void
  onBack: () => void
}

export default function StepPax({ table, pax, onChangePax, onConfirm, onBack }: StepPaxProps) {
  const canDecrement = pax > 1
  const canIncrement = pax < table.seats
  const canConfirm = pax >= 1

  return (
    <div className="flex flex-col gap-6">
      {/* Mesa info */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/35 mb-1">Mesa</p>
        <p className="text-lg font-bold text-white">{table.label}</p>
        <p className="text-sm text-white/50 mt-0.5">{table.seats} asientos disponibles</p>
      </div>

      {/* Pax selector */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-white/60">¿Cuántas personas?</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onChangePax(pax - 1)}
            disabled={!canDecrement}
            className="flex items-center justify-center rounded-full border border-white/20 bg-white/8 text-xl font-bold text-white/80 disabled:opacity-30 hover:bg-white/15 transition-colors"
            style={{ minWidth: 44, minHeight: 44, width: 44, height: 44 }}
            aria-label="Reducir personas"
          >
            −
          </button>

          <span className="min-w-[3rem] text-center text-3xl font-bold text-white tabular-nums">
            {pax}
          </span>

          <button
            type="button"
            onClick={() => onChangePax(pax + 1)}
            disabled={!canIncrement}
            className="flex items-center justify-center rounded-full border border-white/20 bg-white/8 text-xl font-bold text-white/80 disabled:opacity-30 hover:bg-white/15 transition-colors"
            style={{ minWidth: 44, minHeight: 44, width: 44, height: 44 }}
            aria-label="Aumentar personas"
          >
            +
          </button>
        </div>
        <p className="text-xs text-white/35">
          Máximo {table.seats} {table.seats === 1 ? 'persona' : 'personas'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white/70 hover:bg-white/10 transition-colors"
          style={{ minHeight: 44 }}
          aria-label="Volver al mapa de mesas"
        >
          Atrás
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="flex-1 flex items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          style={{ minHeight: 44 }}
          aria-label="Confirmar cantidad de personas"
        >
          Confirmar
        </button>
      </div>
    </div>
  )
}
