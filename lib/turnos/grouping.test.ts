import { describe, it, expect } from 'vitest'
import { upcomingShifts, groupByDate, shiftHours, todayStr, type WorkerShift } from './grouping'

const mk = (date: string, start: string, end = '17:00:00'): WorkerShift => ({
  id: `${date}-${start}`, shift_date: date, start_time: start, end_time: end,
  status: 'scheduled', notes: null,
})

describe('upcomingShifts', () => {
  it('incluye hoy y descarta el pasado', () => {
    const today = '2026-06-10'
    const shifts = [mk('2026-06-08', '09:00:00'), mk('2026-06-10', '09:00:00'), mk('2026-06-12', '09:00:00')]
    const out = upcomingShifts(shifts, today)
    expect(out.map(s => s.shift_date)).toEqual(['2026-06-10', '2026-06-12'])
  })

  it('ordena por fecha y luego por hora de inicio', () => {
    const today = '2026-06-10'
    const shifts = [mk('2026-06-12', '09:00:00'), mk('2026-06-10', '16:00:00'), mk('2026-06-10', '08:00:00')]
    const out = upcomingShifts(shifts, today)
    expect(out.map(s => `${s.shift_date} ${s.start_time}`)).toEqual([
      '2026-06-10 08:00:00', '2026-06-10 16:00:00', '2026-06-12 09:00:00',
    ])
  })

  it('lista vacía → vacío', () => {
    expect(upcomingShifts([], '2026-06-10')).toEqual([])
  })
})

describe('groupByDate', () => {
  it('agrupa por fecha en orden cronológico, turnos ordenados por hora', () => {
    const shifts = [mk('2026-06-12', '09:00:00'), mk('2026-06-10', '16:00:00'), mk('2026-06-10', '08:00:00')]
    const groups = groupByDate(shifts)
    expect(groups.map(g => g.date)).toEqual(['2026-06-10', '2026-06-12'])
    expect(groups[0].shifts.map(s => s.start_time)).toEqual(['08:00:00', '16:00:00'])
  })
})

describe('shiftHours', () => {
  it('turno normal', () => {
    expect(shiftHours('09:00', '17:00')).toBe(8)
    expect(shiftHours('10:00', '15:30')).toBe(5.5)
  })
  it('turno que cruza medianoche', () => {
    expect(shiftHours('16:00', '00:00')).toBe(8)
    expect(shiftHours('22:00', '02:00')).toBe(4)
  })
})

describe('todayStr', () => {
  it('formatea YYYY-MM-DD en local', () => {
    expect(todayStr(new Date(2026, 5, 9))).toBe('2026-06-09')
    expect(todayStr(new Date(2026, 11, 1))).toBe('2026-12-01')
  })
})
