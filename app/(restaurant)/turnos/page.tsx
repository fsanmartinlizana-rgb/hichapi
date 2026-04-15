'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  CalendarDays, Clock, User, Plus, RefreshCw,
  ChevronLeft, ChevronRight, Check, X, AlertCircle,
  Download, Info, Zap, Sparkles, MoveRight,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string
  role: string
  user_id: string | null
  invited_email?: string | null
  full_name?: string | null
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

type ViewMode = 'day' | 'week' | 'month'

const VIEW_LABELS: Record<ViewMode, string> = { day: 'Día', week: 'Semana', month: 'Mes' }

const PRESET_SHIFTS = [
  { name: 'Apertura', ranges: [{ start: '08:00', end: '16:00' }] },
  { name: 'Cierre',   ranges: [{ start: '16:00', end: '00:00' }] },
  { name: 'Completo', ranges: [{ start: '10:00', end: '22:00' }] },
  { name: 'Cortado',  ranges: [{ start: '10:00', end: '15:00' }, { start: '19:00', end: '23:00' }] },
]

const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

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

function getMonthDates(anchor: Date): Date[] {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  // Pad from Monday of the first week to Sunday of the last week
  const startDay = first.getDay()
  const startOffset = startDay === 0 ? 6 : startDay - 1
  const dates: Date[] = []
  const cur = new Date(first)
  cur.setDate(cur.getDate() - startOffset)
  while (dates.length < 42) { // 6 rows x 7 cols
    dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
    if (dates.length >= 35 && cur.getMonth() !== month) break
  }
  // Ensure we fill complete weeks
  while (dates.length % 7 !== 0) {
    dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function getDateRange(view: ViewMode, anchor: Date): { start: string; end: string; dates: Date[] } {
  if (view === 'day') {
    return { start: toDateStr(anchor), end: toDateStr(anchor), dates: [anchor] }
  }
  if (view === 'week') {
    const dates = getWeekDates(anchor)
    return { start: toDateStr(dates[0]), end: toDateStr(dates[6]), dates }
  }
  // month
  const dates = getMonthDates(anchor)
  return { start: toDateStr(dates[0]), end: toDateStr(dates[dates.length - 1]), dates }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TurnosPage() {
  // Singleton del cliente para evitar re-suscripciones infinitas en Realtime
  const supabase = useMemo(() => createClient(), [])
  const { restaurant } = useRestaurant()
  const restId = restaurant?.id

  const [viewMode,   setViewMode]   = useState<ViewMode>('week')
  const [anchor,     setAnchor]     = useState(new Date())
  const [shifts,     setShifts]     = useState<Shift[]>([])
  const [team,       setTeam]       = useState<TeamMember[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [showPresets, setShowPresets] = useState(false)

  // Form state
  const [form, setForm] = useState({
    staff_id:   '',
    shift_date: toDateStr(new Date()),
    start_time: '09:00',
    end_time:   '17:00',
    notes:      '',
  })

  const { start: rangeStart, end: rangeEnd, dates: viewDates } = getDateRange(viewMode, anchor)
  // Keep weekDates for backward compat in week view
  const weekDates = viewMode === 'week' ? viewDates : getWeekDates(anchor)

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!restId) return
    setLoading(true)

    const [shiftsRes, teamRes] = await Promise.all([
      supabase
        .from('shifts')
        .select('*, team_members(role)')
        .eq('restaurant_id', restId)
        .gte('shift_date', rangeStart)
        .lte('shift_date', rangeEnd)
        .order('start_time'),
      // Try to pull full_name; falls back silently if column doesn't exist
      supabase
        .from('team_members')
        .select('id, role, user_id, invited_email, full_name')
        .eq('restaurant_id', restId)
        .eq('active', true),
    ])

    setShifts(shiftsRes.data ?? [])

    if (teamRes.error) {
      // Fallback: columnas nuevas no existen aún
      const { data: basic } = await supabase
        .from('team_members')
        .select('id, role, user_id, invited_email')
        .eq('restaurant_id', restId)
        .eq('active', true)
      setTeam((basic ?? []) as TeamMember[])
    } else {
      setTeam(teamRes.data ?? [])
    }
    setLoading(false)
  }, [restId, supabase, rangeStart, rangeEnd])

  useEffect(() => { load() }, [load])

  // Realtime: cuando alguien crea/edita/borra un turno o entra/sale un team member,
  // la vista se refresca sola. Reusamos el cliente supabase ya instanciado.
  useEffect(() => {
    if (!restId) return
    const ch = supabase
      .channel(`turnos:${restId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts', filter: `restaurant_id=eq.${restId}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members', filter: `restaurant_id=eq.${restId}` },
        () => load(),
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [restId, supabase, load])

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

  // ── Quick assign: one-click shift creation ────────────────────────────────
  // Click a preset, then click a team member → instant shift for the target date.
  const [quickPreset, setQuickPreset] = useState<typeof PRESET_SHIFTS[number] | null>(null)
  const [quickDate,   setQuickDate]   = useState(toDateStr(new Date()))
  const [assigning,   setAssigning]   = useState<string | null>(null)

  async function quickAssign(staffId: string) {
    if (!quickPreset || !restId) return
    setAssigning(staffId)
    const r = quickPreset.ranges[0]
    const { error } = await supabase.from('shifts').insert({
      restaurant_id: restId,
      staff_id:      staffId,
      shift_date:    quickDate,
      start_time:    r.start,
      end_time:      r.end,
      notes:         quickPreset.ranges.length > 1
        ? `${quickPreset.name}: ${quickPreset.ranges.map(rr => `${rr.start}-${rr.end}`).join(', ')}`
        : quickPreset.name,
      status:        'scheduled',
    })
    setAssigning(null)
    if (!error) await load()
  }

  function memberName(m: TeamMember): string {
    if (m.full_name && m.full_name.trim()) return m.full_name.trim()
    if (m.invited_email) {
      const local = m.invited_email.split('@')[0].replace(/[._-]/g, ' ')
      return local.charAt(0).toUpperCase() + local.slice(1)
    }
    return m.role.charAt(0).toUpperCase() + m.role.slice(1)
  }

  function memberInitials(m: TeamMember): string {
    const name = memberName(m)
    const parts = name.split(/[\s._-]+/).filter(Boolean)
    return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
  }

  // Mesas asignables hoy (staff con shift programado para quickDate)
  const staffAssignedToday = new Set(shifts.filter(s => s.shift_date === quickDate).map(s => s.staff_id))

  // ── Navigation ─────────────────────────────────────────────────────────────

  function navigate(dir: -1 | 1) {
    const d = new Date(anchor)
    if (viewMode === 'day')   d.setDate(d.getDate() + dir)
    if (viewMode === 'week')  d.setDate(d.getDate() + dir * 7)
    if (viewMode === 'month') d.setMonth(d.getMonth() + dir)
    setAnchor(d)
  }

  function getPeriodLabel(): string {
    if (viewMode === 'day') {
      return anchor.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (viewMode === 'week') {
      const wd = getWeekDates(anchor)
      return `Semana del ${wd[0].getDate()} - ${wd[6].getDate()} ${MONTHS_ES[wd[6].getMonth()]} ${wd[6].getFullYear()}`
    }
    return `${MONTHS_ES[anchor.getMonth()]} ${anchor.getFullYear()}`
  }

  function exportCSV() {
    const header = 'fecha,empleado,turno,hora_inicio,hora_fin'
    const rows = shifts.map(s => {
      const member = team.find(t => t.id === s.staff_id)
      const name = member ? memberName(member) : (s.team_members?.role ?? 'Sin rol')
      const status = STATUS_CONFIG[s.status]?.label ?? s.status
      return `${s.shift_date},${name},${status},${s.start_time.slice(0, 5)},${s.end_time.slice(0, 5)}`
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `turnos_${rangeStart}_${rangeEnd}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function applyPreset(preset: typeof PRESET_SHIFTS[number]) {
    setForm(f => ({
      ...f,
      start_time: preset.ranges[0].start,
      end_time:   preset.ranges[0].end,
      notes:      preset.ranges.length > 1
        ? `Turno ${preset.name}: ${preset.ranges.map(r => `${r.start}-${r.end}`).join(', ')}`
        : f.notes,
    }))
    setShowPresets(false)
    setShowForm(true)
  }

  const todayStr = toDateStr(new Date())

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-6xl">

      {/* Chilean labor law compliance banner */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <Info size={14} className="text-blue-400 shrink-0" />
        <p className="text-blue-300 text-xs">
          <span className="font-semibold">Normativa laboral Chile:</span>{' '}
          Maximo legal: 45 hrs/semana &middot; 10 hrs/dia &middot; Descanso dominical obligatorio
        </p>
      </div>

      {/* ── Quick Assign — 2-step shift creation ───────────────────────── */}
      <div className="bg-gradient-to-br from-[#FF6B35]/10 to-purple-500/5 border border-[#FF6B35]/20 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#FF6B35]/20 border border-[#FF6B35]/30 flex items-center justify-center">
              <Sparkles size={13} className="text-[#FF6B35]" />
            </span>
            <div>
              <p className="text-white text-sm font-semibold">Asignación rápida</p>
              <p className="text-white/40 text-[11px]">1. Elige un turno · 2. Toca al miembro del equipo</p>
            </div>
          </div>
          <input
            type="date"
            value={quickDate}
            onChange={e => setQuickDate(e.target.value)}
            className="bg-[#0F0F1C] border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-[#FF6B35]/40"
          />
        </div>

        {/* Step 1: pick preset */}
        <div className="flex gap-2 flex-wrap">
          {PRESET_SHIFTS.map(p => {
            const active = quickPreset?.name === p.name
            return (
              <button
                key={p.name}
                onClick={() => setQuickPreset(active ? null : p)}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                  ${active
                    ? 'bg-[#FF6B35] text-white border-[#FF6B35] shadow-lg shadow-[#FF6B35]/30 scale-105'
                    : 'bg-white/3 text-white/60 border-white/10 hover:border-white/25 hover:text-white/90'}`}
              >
                <Clock size={11} />
                {p.name}
                <span className={`text-[10px] ${active ? 'text-white/80' : 'text-white/30'}`}>
                  {p.ranges.map(r => `${r.start}–${r.end}`).join(' · ')}
                </span>
              </button>
            )
          })}
        </div>

        {/* Step 2: pick member */}
        {quickPreset && (
          <div className="pt-2 border-t border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <span>Turno <span className="text-[#FF6B35] font-semibold">{quickPreset.name}</span> listo</span>
              <MoveRight size={12} />
              <span>toca al miembro</span>
            </div>
            {team.length === 0 ? (
              <p className="text-white/40 text-xs italic">Invita miembros en /equipo primero.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {team.map(m => {
                  const alreadyAssigned = staffAssignedToday.has(m.id)
                  const isLoading = assigning === m.id
                  return (
                    <button
                      key={m.id}
                      disabled={alreadyAssigned || isLoading}
                      onClick={() => quickAssign(m.id)}
                      className={`group flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all
                        ${alreadyAssigned
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300/80 cursor-not-allowed'
                          : 'bg-white/5 border-white/10 text-white/80 hover:border-[#FF6B35]/60 hover:bg-[#FF6B35]/10 hover:text-[#FF6B35] cursor-pointer active:scale-95'}`}
                      title={alreadyAssigned ? 'Ya tiene un turno este día' : `Asignar ${quickPreset.name} a ${memberName(m)}`}
                    >
                      <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                        {isLoading ? <RefreshCw size={10} className="animate-spin" /> : memberInitials(m)}
                      </span>
                      <span className="text-xs">{memberName(m)}</span>
                      {alreadyAssigned && <Check size={11} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-white text-xl font-bold">Turnos</h1>
          <p className="text-white/40 text-sm mt-0.5">Calendario de garzones</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex rounded-xl border border-white/12 overflow-hidden">
            {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === mode ? 'bg-[#FF6B35] text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                {VIEW_LABELS[mode]}
              </button>
            ))}
          </div>

          <button onClick={exportCSV} title="Exportar CSV"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/12 text-white/50 hover:text-white hover:bg-white/5 text-xs transition-colors">
            <Download size={13} /> Exportar
          </button>

          <div className="relative">
            <button onClick={() => setShowPresets(!showPresets)} title="Turnos predeterminados"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/12 text-white/50 hover:text-white hover:bg-white/5 text-xs transition-colors">
              <Zap size={13} /> Predeterminados
            </button>
            {showPresets && (
              <div className="absolute right-0 top-full mt-1 z-40 bg-[#1A1A2E] border border-white/12 rounded-xl p-2 w-56 shadow-xl">
                <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wide px-2 mb-1.5">Turnos predeterminados</p>
                {PRESET_SHIFTS.map(preset => (
                  <button key={preset.name} onClick={() => applyPreset(preset)}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors group">
                    <span className="text-white text-xs font-semibold">{preset.name}</span>
                    <span className="block text-white/40 text-[10px]">
                      {preset.ranges.map(r => `${r.start} - ${r.end}`).join(' / ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

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

      {/* Date navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-white font-semibold text-sm capitalize">{getPeriodLabel()}</p>
        </div>
        <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
          <ChevronRight size={18} />
        </button>
        <div className="h-5 w-px bg-white/10 mx-1" />
        <input
          type="date"
          value={toDateStr(anchor)}
          onChange={e => { if (e.target.value) setAnchor(new Date(e.target.value + 'T00:00:00')) }}
          title="Ir a fecha"
          className="bg-white/5 border border-white/10 text-white/70 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[#FF6B35]/50"
        />
        <button
          onClick={() => setAnchor(new Date())}
          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs font-medium hover:bg-white/10 hover:text-white transition-colors"
        >
          Hoy
        </button>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-white/30">
          <RefreshCw size={18} className="animate-spin mr-2" />Cargando...
        </div>
      ) : viewMode === 'day' ? (
        /* ── Day view ──────────────────────────────────────────────────── */
        <div className="rounded-2xl border border-white/8 bg-white/3 p-5 min-h-[300px]">
          <div className="mb-4">
            <p className="text-white text-lg font-bold capitalize">
              {anchor.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="space-y-2">
            {shifts.filter(s => s.shift_date === toDateStr(anchor)).length === 0 ? (
              <p className="text-white/30 text-sm py-8 text-center">Sin turnos programados para este dia</p>
            ) : (
              shifts.filter(s => s.shift_date === toDateStr(anchor)).map(shift => {
                const cfg = STATUS_CONFIG[shift.status]
                const role = shift.team_members?.role ?? '—'
                return (
                  <div key={shift.id}
                    className={`rounded-xl border px-4 py-3 ${cfg.color} group relative flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <User size={14} className="opacity-70" />
                      <div>
                        <span className="font-semibold capitalize text-sm">{role}</span>
                        <div className="flex items-center gap-1.5 opacity-70 text-xs mt-0.5">
                          <Clock size={10} />
                          <span>{shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}</span>
                        </div>
                        {shift.notes && <p className="text-[10px] opacity-50 mt-0.5">{shift.notes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs opacity-60">{cfg.label}</span>
                      <div className="hidden group-hover:flex gap-0.5 bg-[#1A1A2E] rounded-lg border border-white/10 p-0.5">
                        {shift.status === 'scheduled' && (
                          <button onClick={() => updateStatus(shift.id, 'open')} title="Abrir turno"
                            className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors"><Check size={12} /></button>
                        )}
                        {shift.status === 'open' && (
                          <button onClick={() => updateStatus(shift.id, 'closed')} title="Cerrar turno"
                            className="p-1 rounded hover:bg-white/10 text-white/40 transition-colors"><Check size={12} /></button>
                        )}
                        {shift.status === 'scheduled' && (
                          <button onClick={() => updateStatus(shift.id, 'no_show')} title="Marcar ausencia"
                            className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"><AlertCircle size={12} /></button>
                        )}
                        <button onClick={() => deleteShift(shift.id)} title="Eliminar"
                          className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"><X size={12} /></button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : viewMode === 'month' ? (
        /* ── Month view ────────────────────────────────────────────────── */
        <div>
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map(d => (
              <div key={d} className="text-center text-white/30 text-[10px] font-semibold py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {viewDates.map(date => {
              const dateStr = toDateStr(date)
              const isToday = dateStr === todayStr
              const isCurrentMonth = date.getMonth() === anchor.getMonth()
              const dayShifts = shifts.filter(s => s.shift_date === dateStr)
              return (
                <div key={dateStr}
                  onClick={() => { setAnchor(new Date(date)); setViewMode('day') }}
                  className={`rounded-xl border p-2 min-h-[70px] cursor-pointer transition-colors hover:bg-white/5
                    ${isToday ? 'border-[#FF6B35]/40 bg-[#FF6B35]/5' : 'border-white/5 bg-white/2'}
                    ${!isCurrentMonth ? 'opacity-30' : ''}`}>
                  <p className={`text-xs font-bold ${isToday ? 'text-[#FF6B35]' : 'text-white/60'}`}>
                    {date.getDate()}
                  </p>
                  {dayShifts.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {dayShifts.slice(0, 3).map(s => (
                        <div key={s.id}
                          className={`w-1.5 h-1.5 rounded-full ${
                            s.status === 'open' ? 'bg-emerald-400' :
                            s.status === 'scheduled' ? 'bg-blue-400' :
                            s.status === 'no_show' ? 'bg-red-400' : 'bg-white/20'
                          }`} />
                      ))}
                      {dayShifts.length > 3 && (
                        <span className="text-[8px] text-white/30">+{dayShifts.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* ── Week view (default) ───────────────────────────────────────── */
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
                    {DAYS_ES[date.getDay()]}
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
                      {memberName(m)} · {m.role}
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
