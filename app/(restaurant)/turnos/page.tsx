'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  CalendarDays, Clock, User, Plus, RefreshCw,
  ChevronLeft, ChevronRight, Check, X, AlertCircle
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string
  role: string
  user_id: string
}

interface Shift {
  id: string
  staff_id: string
  shift_date: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'open' | 'closed' | 'no_show'
  notes: string | null
  tables_assigned: string[]
  team_members: { role: string } | null
}

const STATUS_CONFIG = {
  scheduled: { label: 'Programado',  color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  open:      { label: 'Activo',      color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  closed:    { label: 'Cerrado',     color: 'bg-white/10 text-white/40 border-white/10' },
  no_show:   { label: 'Ausente',     color: 'bg-red-500/15 text-red-300 border-red-500/30' },
}

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function getWeekDates(anchor: Date): Date[] {
  const monday = new Date(anchor)
  const day = monday.getDay()
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TurnosPage() {
  const supabase = createClient()
  const { restaurant } = useRestaurant()
  const restId = restaurant?.id

  const [weekAnchor, setWeekAnchor] = useState(new Date())
  const [shifts,     setShifts]     = useState<Shift[]>([])
  const [team,       setTeam]       = useState<TeamMember[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)

  // Form state
  const [form, setForm] = useState({
    staff_id:   '',
    shift_date: toDateStr(new Date()),
    start_time: '09:00',
    end_time:   '17:00',
    notes:      '',
  })

  const weekDates = getWeekDates(weekAnchor)
  const weekStart = toDateStr(weekDates[0])
  const weekEnd   = toDateStr(weekDates[6])

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!restId) return
    setLoading(true)

    const [shiftsRes, teamRes] = await Promise.all([
      supabase
        .from('shifts')
        .select('*, team_members(role)')
        .eq('restaurant_id', restId)
        .gte('shift_date', weekStart)
        .lte('shift_date', weekEnd)
        .order('start_time'),
      supabase
        .from('team_members')
        .select('id, role, user_id')
        .eq('restaurant_id', restId)
        .eq('active', true),
    ])

    setShifts(shiftsRes.data ?? [])
    setTeam(teamRes.data ?? [])
    setLoading(false)
  }, [restId, supabase, weekStart, weekEnd])

  useEffect(() => { load() }, [load])

  // ── Create shift ───────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.staff_id) return

    // Get restaurant_id from staff member
    const { data: member } = await supabase
      .from('team_members')
      .select('restaurant_id')
      .eq('id', form.staff_id)
      .single()

    if (!member) return

    const { error } = await supabase.from('shifts').insert({
      restaurant_id:  member.restaurant_id,
      staff_id:       form.staff_id,
      shift_date:     form.shift_date,
      start_time:     form.start_time,
      end_time:       form.end_time,
      notes:          form.notes || null,
      status:         'scheduled',
    })

    if (!error) {
      setShowForm(false)
      await load()
    }
  }

  // ── Update shift status ────────────────────────────────────────────────────

  async function updateStatus(id: string, status: Shift['status']) {
    const extra: Record<string, string> = {}
    if (status === 'open')   extra.opened_at = new Date().toISOString()
    if (status === 'closed') extra.closed_at = new Date().toISOString()

    await supabase.from('shifts').update({ status, ...extra }).eq('id', id)
    await load()
  }

  async function deleteShift(id: string) {
    await supabase.from('shifts').delete().eq('id', id)
    await load()
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function prevWeek() { const d = new Date(weekAnchor); d.setDate(d.getDate() - 7); setWeekAnchor(d) }
  function nextWeek() { const d = new Date(weekAnchor); d.setDate(d.getDate() + 7); setWeekAnchor(d) }

  const todayStr = toDateStr(new Date())

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-bold">Turnos</h1>
          <p className="text-white/40 text-sm mt-0.5">Calendario semanal de garzones</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] text-white text-sm font-semibold transition-colors"
          >
            <Plus size={14} /> Asignar turno
          </button>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-4">
        <button onClick={prevWeek} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-white font-semibold text-sm">
            {weekDates[0].toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}
            {' — '}
            {weekDates[6].toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={nextWeek} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-white/30">
          <RefreshCw size={18} className="animate-spin mr-2" />Cargando...
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, idx) => {
            const dateStr    = toDateStr(date)
            const isToday    = dateStr === todayStr
            const dayShifts  = shifts.filter(s => s.shift_date === dateStr)

            return (
              <div key={dateStr}
                className={`rounded-2xl border p-3 min-h-[180px] ${isToday ? 'border-[#FF6B35]/40 bg-[#FF6B35]/5' : 'border-white/8 bg-white/3'}`}>

                {/* Day header */}
                <div className="mb-2">
                  <p className={`text-xs font-semibold ${isToday ? 'text-[#FF6B35]' : 'text-white/40'}`}>
                    {DAYS_ES[idx]}
                  </p>
                  <p className={`text-xl font-bold ${isToday ? 'text-[#FF6B35]' : 'text-white'}`}>
                    {date.getDate()}
                  </p>
                </div>

                {/* Shifts for the day */}
                <div className="space-y-1.5">
                  {dayShifts.length === 0 ? (
                    <p className="text-white/15 text-[10px]">Sin turnos</p>
                  ) : (
                    dayShifts.map(shift => {
                      const cfg = STATUS_CONFIG[shift.status]
                      const role = shift.team_members?.role ?? '—'
                      return (
                        <div key={shift.id}
                          className={`rounded-lg border px-2 py-1.5 text-[10px] ${cfg.color} group relative`}>
                          <div className="flex items-center gap-1 mb-0.5">
                            <User size={8} className="shrink-0 opacity-70" />
                            <span className="font-semibold truncate capitalize">{role}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-70">
                            <Clock size={8} />
                            <span>{shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}</span>
                          </div>
                          <span className="block mt-0.5 opacity-60">{cfg.label}</span>

                          {/* Quick actions on hover */}
                          <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5 bg-[#1A1A2E] rounded-lg border border-white/10 p-0.5">
                            {shift.status === 'scheduled' && (
                              <button onClick={() => updateStatus(shift.id, 'open')}
                                title="Abrir turno"
                                className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors">
                                <Check size={10} />
                              </button>
                            )}
                            {shift.status === 'open' && (
                              <button onClick={() => updateStatus(shift.id, 'closed')}
                                title="Cerrar turno"
                                className="p-1 rounded hover:bg-white/10 text-white/40 transition-colors">
                                <Check size={10} />
                              </button>
                            )}
                            {shift.status === 'scheduled' && (
                              <button onClick={() => updateStatus(shift.id, 'no_show')}
                                title="Marcar ausencia"
                                className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors">
                                <AlertCircle size={10} />
                              </button>
                            )}
                            <button onClick={() => deleteShift(shift.id)}
                              title="Eliminar"
                              className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors">
                              <X size={10} />
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] ${cfg.color}`}>
            <span>{cfg.label}</span>
          </div>
        ))}
        <p className="text-white/30 text-xs self-center">Pasa el cursor sobre un turno para ver acciones</p>
      </div>

      {/* Create shift modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A2E] rounded-2xl border border-white/12 p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">Asignar turno</h3>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-white/50 text-xs mb-1.5 block">Miembro del equipo</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                  required
                  className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm appearance-none focus:outline-none focus:border-[#FF6B35]/50">
                  <option value="">Selecciona...</option>
                  {team.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.role} — {m.user_id.slice(-8)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-white/50 text-xs mb-1.5 block">Fecha</label>
                <input type="date" value={form.shift_date}
                  onChange={e => setForm(f => ({ ...f, shift_date: e.target.value }))}
                  className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Inicio</label>
                  <input type="time" value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50" />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1.5 block">Fin</label>
                  <input type="time" value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50" />
                </div>
              </div>

              <div>
                <label className="text-white/50 text-xs mb-1.5 block">Notas (opcional)</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Observaciones..."
                  className="w-full bg-white/8 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50" />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/12 text-white/60 text-sm hover:bg-white/5 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  <CalendarDays size={14} /> Asignar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
