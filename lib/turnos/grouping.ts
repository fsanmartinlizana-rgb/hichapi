/**
 * Helpers puros para la vista de turnos del trabajador (/mis-turnos).
 * Aislados para poder unit-testear el agrupado/orden sin Supabase ni React.
 */

export interface WorkerShift {
  id: string
  shift_date: string      // 'YYYY-MM-DD'
  start_time: string      // 'HH:MM:SS'
  end_time: string
  status: 'scheduled' | 'open' | 'closed' | 'no_show'
  notes: string | null
  tables_assigned?: string[]
}

export interface ShiftDayGroup {
  date: string
  shifts: WorkerShift[]
}

/** 'YYYY-MM-DD' del día de hoy en hora local. */
export function todayStr(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Filtra a los turnos de hoy en adelante (incluye hoy) y los ordena por fecha
 * y hora de inicio. Para que el trabajador vea "lo que viene".
 */
export function upcomingShifts(shifts: WorkerShift[], today: string = todayStr()): WorkerShift[] {
  return shifts
    .filter(s => s.shift_date >= today)
    .sort((a, b) =>
      a.shift_date === b.shift_date
        ? a.start_time.localeCompare(b.start_time)
        : a.shift_date.localeCompare(b.shift_date),
    )
}

/** Agrupa turnos por fecha, en orden cronológico ascendente. */
export function groupByDate(shifts: WorkerShift[]): ShiftDayGroup[] {
  const byDate = new Map<string, WorkerShift[]>()
  for (const s of shifts) {
    const arr = byDate.get(s.shift_date) ?? []
    arr.push(s)
    byDate.set(s.shift_date, arr)
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => ({
      date,
      shifts: list.sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }))
}

/** Total de horas de un turno (HH:MM). Maneja turnos que cruzan medianoche. */
export function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60 // cruza medianoche
  return Math.round((mins / 60) * 10) / 10
}
