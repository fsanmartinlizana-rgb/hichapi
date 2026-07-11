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
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">Mesa</p>
        <p className="text-lg font-bold text-[var(--text-strong)]">{table.label}</p>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">{table.seats} asientos disponibles</p>
      </div>

      {/* Pax selector */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-[var(--text-muted)]">¿Cuántas personas?</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onChangePax(pax - 1)}
            disabled={!canDecrement}
            className="flex items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-xl font-bold text-[var(--text-body)] disabled:opacity-30 hover:bg-[var(--surface-sunken)] transition-colors"
            style={{ minWidth: 44, minHeight: 44, width: 44, height: 44 }}
            aria-label="Reducir personas"
          >
            −
          </button>

          <span className="min-w-[3rem] text-center text-3xl font-bold text-[var(--text-strong)] tabular-nums">
            {pax}
          </span>

          <button
            type="button"
            onClick={() => onChangePax(pax + 1)}
            disabled={!canIncrement}
            className="flex items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-xl font-bold text-[var(--text-body)] disabled:opacity-30 hover:bg-[var(--surface-sunken)] transition-colors"
            style={{ minWidth: 44, minHeight: 44, width: 44, height: 44 }}
            aria-label="Aumentar personas"
          >
            +
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Máximo {table.seats} {table.seats === 1 ? 'persona' : 'personas'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-5 text-sm font-semibold text-[var(--text-body)] hover:bg-[var(--surface-sunken)] transition-colors"
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
