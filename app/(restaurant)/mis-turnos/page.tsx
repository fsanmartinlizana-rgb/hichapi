'use client'

/**
 * Mis turnos — vista del trabajador.
 *
 * Cada miembro del equipo (garzón, cocina, anfitrión, etc.) ve SOLO sus propios
 * turnos programados, de hoy en adelante. Read-only: planificar/editar es del
 * dueño/supervisor en /turnos.
 *
 * Auth: usa la sesión del navegador. Resuelve el/los team_members del usuario
 * (user_id = uid) y carga sus shifts. RLS permite a staff leer los turnos de su
 * restaurante; acá filtramos por staff_id propio.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarDays, Clock, RefreshCw, MapPin, StickyNote, CalendarX } from 'lucide-react'
import {
  upcomingShifts, groupByDate, shiftHours, todayStr,
  type WorkerShift,
} from '@/lib/turnos/grouping'

const STATUS_CONFIG: Record<WorkerShift['status'], { label: string; color: string }> = {
  scheduled: { label: 'Programado', color: 'bg-blue-500/15 text-blue-700 border-blue-500/30' },
  open:      { label: 'En curso',   color: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
  closed:    { label: 'Cerrado',    color: 'bg-[var(--surface-sunken)] text-[var(--text-muted)] border-[var(--border-subtle)]' },
  no_show:   { label: 'Ausente',    color: 'bg-red-500/15 text-red-700 border-red-500/30' },
}

const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${DAYS_FULL[date.getDay()]} ${d} de ${MONTHS_ES[m - 1]}`
}

export default function MisTurnosPage() {
  const supabase = useMemo(() => createClient(), [])
  const [shifts, setShifts]   = useState<WorkerShift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [name, setName]       = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Iniciá sesión para ver tus turnos.'); setLoading(false); return }

    // 1. Encontrar el/los team_members del usuario
    const { data: members, error: memErr } = await supabase
      .from('team_members')
      .select('id, full_name, invited_email, role')
      .eq('user_id', user.id)
      .eq('active', true)

    if (memErr) { setError('No se pudo cargar tu perfil de equipo.'); setLoading(false); return }
    if (!members || members.length === 0) {
      setError('Tu cuenta no está vinculada a ningún equipo todavía. Pedile a tu encargado que te agregue.')
      setLoading(false)
      return
    }

    const first = members[0] as { id: string; full_name: string | null; invited_email: string | null; role: string }
    setName(first.full_name?.trim() || (first.invited_email?.split('@')[0] ?? '') || first.role)
    const staffIds = members.map(m => (m as { id: string }).id)

    // 2. Cargar sus turnos (de hoy en adelante + algunos días atrás por contexto)
    const since = new Date(); since.setDate(since.getDate() - 1)
    const sinceStr = todayStr(since)
    const { data: shiftRows, error: shiftErr } = await supabase
      .from('shifts')
      .select('id, shift_date, start_time, end_time, status, notes, tables_assigned')
      .in('staff_id', staffIds)
      .gte('shift_date', sinceStr)
      .order('shift_date')
      .order('start_time')

    if (shiftErr) { setError('No se pudieron cargar tus turnos.'); setLoading(false); return }
    setShifts((shiftRows ?? []) as WorkerShift[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const today = todayStr()
  const upcoming = useMemo(() => groupByDate(upcomingShifts(shifts, today)), [shifts, today])
  const totalHours = useMemo(
    () => upcomingShifts(shifts, today).reduce((sum, s) => sum + shiftHours(s.start_time.slice(0, 5), s.end_time.slice(0, 5)), 0),
    [shifts, today],
  )
  const nextShift = upcoming[0]?.shifts[0] ?? null

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[var(--text-strong)] text-xl font-bold flex items-center gap-2">
            <CalendarDays size={20} className="text-[#E55A2B]" /> Mis turnos
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            {name ? `Hola ${name}, ` : ''}estos son tus próximos turnos.
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-sunken)] transition-colors"
          aria-label="Refrescar"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-5 text-amber-200 text-sm">
          {error}
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-10 justify-center">
          <RefreshCw size={16} className="animate-spin" /> Cargando tus turnos…
        </div>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
              <p className="text-[var(--text-muted)] text-xs">Próximo turno</p>
              {nextShift ? (
                <>
                  <p className="text-[var(--text-strong)] font-bold text-lg mt-0.5">{formatDayLabel(upcoming[0].date).split(' de ')[0]}</p>
                  <p className="text-[#E55A2B] text-sm font-mono">{nextShift.start_time.slice(0, 5)}–{nextShift.end_time.slice(0, 5)}</p>
                </>
              ) : (
                <p className="text-[var(--text-muted)] text-sm mt-1">Sin turnos próximos</p>
              )}
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4">
              <p className="text-[var(--text-muted)] text-xs">Horas programadas</p>
              <p className="text-[var(--text-strong)] font-bold text-lg mt-0.5 font-mono">{Math.round(totalHours)}h</p>
              <p className="text-[var(--text-muted)] text-xs">próximos días</p>
            </div>
          </div>

          {/* Lista de turnos por día */}
          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-8 text-center">
              <CalendarX size={28} className="mx-auto text-[var(--text-muted)] mb-2" />
              <p className="text-[var(--text-muted)] text-sm">No tenés turnos programados.</p>
              <p className="text-[var(--text-muted)] text-xs mt-1">Cuando tu encargado te asigne turnos, aparecerán acá.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(group => {
                const isToday = group.date === today
                return (
                  <div key={group.date} className={`rounded-2xl border p-4 ${isToday ? 'border-[#FF6B35]/40 bg-[#FF6B35]/5' : 'border-[var(--border-subtle)] bg-[var(--surface-sunken)]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`font-bold text-sm ${isToday ? 'text-[#E55A2B]' : 'text-[var(--text-body)]'}`}>
                        {formatDayLabel(group.date)}{isToday ? ' · Hoy' : ''}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {group.shifts.map(s => {
                        const cfg = STATUS_CONFIG[s.status]
                        return (
                          <div key={s.id} className="flex items-center gap-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] px-3 py-2.5">
                            <div className="flex items-center gap-1.5 text-[var(--text-strong)] font-mono text-sm">
                              <Clock size={13} className="text-[var(--text-muted)]" />
                              {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                            </div>
                            <span className="text-[var(--text-muted)] text-xs">
                              {shiftHours(s.start_time.slice(0, 5), s.end_time.slice(0, 5))}h
                            </span>
                            <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>
                        )
                      })}
                      {group.shifts.some(s => s.notes) && (
                        <div className="space-y-1 pt-1">
                          {group.shifts.filter(s => s.notes).map(s => (
                            <p key={s.id} className="text-[var(--text-muted)] text-[11px] flex items-start gap-1.5">
                              <StickyNote size={11} className="mt-0.5 shrink-0 text-[var(--text-muted)]" /> {s.notes}
                            </p>
                          ))}
                        </div>
                      )}
                      {group.shifts.some(s => (s.tables_assigned?.length ?? 0) > 0) && (
                        <p className="text-[var(--text-muted)] text-[11px] flex items-center gap-1.5">
                          <MapPin size={11} className="text-[var(--text-muted)]" />
                          {group.shifts.reduce((n, s) => n + (s.tables_assigned?.length ?? 0), 0)} mesa(s) asignada(s)
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
