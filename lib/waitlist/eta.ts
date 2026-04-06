import type { OccupiedTable } from './types'

interface EtaInputs {
  position: number           // 1-based
  avgTableDurationMin: number
  occupiedTables: OccupiedTable[]
}

/**
 * Calculates estimated wait time in minutes for a given queue position.
 *
 * Model: tables free in parallel. We sort occupied tables by estimated
 * remaining time (ascending). Position N gets the N-th table to free.
 * If N > parallelFreeing, add full avgDuration cycles for subsequent waves.
 */
export function calculateEta(inputs: EtaInputs): number {
  const { position, avgTableDurationMin, occupiedTables } = inputs

  if (position <= 0) return 0
  if (occupiedTables.length === 0) return 1 // tables available now

  const now = Date.now()

  // Remaining minutes per occupied table. 'cuenta' → 0 (paying, leaving imminently)
  const remaining = occupiedTables
    .map(t => {
      if (t.status === 'cuenta') return 0
      const elapsedMin = (now - t.seatedAt.getTime()) / 60_000
      return Math.max(0, avgTableDurationMin - elapsedMin)
    })
    .sort((a, b) => a - b)   // ascending: soonest-to-free first

  const parallelFreeing = remaining.length
  const targetIndex = position - 1  // 0-based

  let etaMin: number

  if (targetIndex < parallelFreeing) {
    // This person gets one of the currently occupied tables
    etaMin = remaining[targetIndex]
  } else {
    // Need additional full cycles beyond current occupied tables
    const cyclesNeeded = Math.floor(targetIndex / parallelFreeing)
    const offsetWithinCycle = targetIndex % parallelFreeing
    etaMin = cyclesNeeded * avgTableDurationMin + remaining[offsetWithinCycle]
  }

  return Math.max(1, Math.round(etaMin))
}

/** Formats minutes into a human-readable string: "~5 min" | "~1 hr 10 min" */
export function formatEta(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `~${hrs} hr ${mins} min` : `~${hrs} hr`
}

/** Fallback avg duration when no daily_summaries row exists */
export const DEFAULT_AVG_DURATION_MIN = 60
