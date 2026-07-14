'use client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StationStatus {
  destination: 'cocina' | 'barra' | 'ninguno'
  label: string
  ready: boolean
}

interface StationStatusBadgeProps {
  statuses: StationStatus[]
}

// ── StationStatusBadge ────────────────────────────────────────────────────────

export function StationStatusBadge({ statuses }: StationStatusBadgeProps) {
  if (statuses.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {statuses.map((s, i) => (
        <span key={s.destination} className="flex items-center gap-1 text-xs">
          <span className="text-[var(--text-muted)]">{s.label}:</span>
          <span className={s.ready ? 'text-[var(--success-text)] font-medium' : 'text-[var(--warning-text)] font-medium'}>
            {s.ready ? 'listo' : 'preparando'}
          </span>
          {i < statuses.length - 1 && (
            <span className="text-[var(--text-muted)] ml-0.5">·</span>
          )}
        </span>
      ))}
    </div>
  )
}
