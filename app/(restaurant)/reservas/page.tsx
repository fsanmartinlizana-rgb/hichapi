'use client'

import { useState, useEffect, useCallback } from 'react'
import { CalendarDays, Clock, Users, CheckCircle2, X, Loader2, UserCheck, Ban, Phone, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, Timer, Search } from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'
import { EmptyState } from '@/components/ui/EmptyState'
import { createClient } from '@/lib/supabase/client'

// ── Types ────────────────────────────────────────────────────────────────────

interface Reservation {
  id: string
  restaurant_id: string
  table_id: string | null
  name: string
  phone: string
  email: string | null
  party_size: number
  reservation_date: string
  reservation_time: string
  duration_min: number
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'no_show' | 'cancelled'
  notes: string | null
  token: string
  confirmed_at: string | null
  seated_at: string | null
  completed_at: string | null
  no_show_at: string | null
  created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pendiente',  color: 'text-[var(--warning-text)]', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  confirmed: { label: 'Confirmada', color: 'text-[var(--info-text)]',   bg: 'bg-blue-400/10 border-blue-400/20' },
  seated:    { label: 'Sentado',    color: 'text-[var(--success-text)]', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  completed: { label: 'Completada', color: 'text-[var(--text-muted)]',   bg: 'bg-[var(--surface-sunken)] border-[var(--border-subtle)]' },
  no_show:   { label: 'No llegó',   color: 'text-[var(--danger-text)]',    bg: 'bg-red-400/10 border-red-400/20' },
  cancelled: { label: 'Cancelada',  color: 'text-[var(--text-muted)]',   bg: 'bg-[var(--surface-sunken)] border-[var(--border-subtle)]' },
}

function minutesLate(reservation: Reservation): number {
  const now = new Date()
  const [h, m] = reservation.reservation_time.split(':').map(Number)
  const resDateTime = new Date(reservation.reservation_date + 'T00:00:00')
  resDateTime.setHours(h, m, 0, 0)
  return Math.max(0, Math.floor((now.getTime() - resDateTime.getTime()) / 60000))
}

function formatTime(time: string) {
  return time.slice(0, 5)
}

// ── Reservation Card ─────────────────────────────────────────────────────────

function ReservationCard({
  reservation,
  timeoutMin,
  onAction,
}: {
  reservation: Reservation
  timeoutMin: number
  onAction: (id: string, action: string) => void
}) {
  const status = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.pending
  const late = minutesLate(reservation)
  const isActive = reservation.status === 'confirmed' || reservation.status === 'pending'
  const isLate = isActive && late > 0
  const isDanger = isActive && late >= timeoutMin

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-all ${isDanger ? 'bg-red-500/5 border-red-500/20 animate-pulse' : isLate ? 'bg-yellow-500/5 border-yellow-500/15' : 'bg-white/[0.02] border-[var(--border-subtle)]'}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status.bg} border`}>
            <Users size={16} className={status.color} />
          </div>
          <div>
            <p className="text-[var(--text-strong)] font-semibold text-sm">{reservation.name}</p>
            <p className="text-[var(--text-muted)] text-xs flex items-center gap-1">
              <Users size={10} /> {reservation.party_size} personas
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[var(--text-strong)] font-mono text-sm font-bold">{formatTime(reservation.reservation_time)}</p>
          <span className={`text-[10px] font-medium ${status.color}`}>{status.label}</span>
        </div>
      </div>

      {/* Late warning */}
      {isLate && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${isDanger ? 'bg-red-500/10 text-[var(--danger-text)]' : 'bg-yellow-500/10 text-[var(--warning-text)]'}`}>
          <Timer size={12} />
          <span>{late} min de atraso</span>
          {isDanger && <span className="font-bold ml-auto">Auto-liberar</span>}
        </div>
      )}

      {/* Notes */}
      {reservation.notes && (
        <p className="text-[var(--warning-text)]/60 text-xs italic bg-yellow-500/5 rounded-lg px-3 py-1.5">{reservation.notes}</p>
      )}

      {/* Phone + CTA llamar */}
      <div className="flex items-center gap-2">
        <a
          href={`tel:${reservation.phone.replace(/[^+\d]/g, '')}`}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[#E55A2B] transition-colors"
          title={`Llamar a ${reservation.name}`}
        >
          <Phone size={11} />
          <span className="font-mono tracking-wide">{reservation.phone}</span>
        </a>
        <a
          href={`tel:${reservation.phone.replace(/[^+\d]/g, '')}`}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF6B35]/10 border border-[#FF6B35]/25 text-[#E55A2B] text-[10px] font-semibold hover:bg-[#FF6B35]/20 transition-colors"
        >
          <Phone size={10} /> Llamar
        </a>
        {reservation.phone && /^\+?\d+$/.test(reservation.phone.replace(/\s/g, '')) && (
          <a
            href={`https://wa.me/${reservation.phone.replace(/[^\d]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[var(--success-text)] text-[10px] font-semibold hover:bg-emerald-500/20 transition-colors"
            title="Enviar WhatsApp"
          >
            WhatsApp
          </a>
        )}
      </div>

      {/* Actions */}
      {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
        <div className="flex gap-2 pt-1">
          {reservation.status === 'pending' && (
            <button onClick={() => onAction(reservation.id, 'confirm')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[var(--info-text)] text-xs font-medium hover:bg-blue-500/20 transition-colors">
              <CheckCircle2 size={12} /> Confirmar
            </button>
          )}
          <button onClick={() => onAction(reservation.id, 'seat')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[var(--success-text)] text-xs font-medium hover:bg-emerald-500/20 transition-colors">
            <UserCheck size={12} /> Sentar
          </button>
          <button onClick={() => onAction(reservation.id, 'no_show')} className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[var(--danger-text)] text-xs font-medium hover:bg-red-500/20 transition-colors">
            <Ban size={12} /> No llegó
          </button>
          <button onClick={() => onAction(reservation.id, 'cancel')} className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs hover:bg-[var(--surface-sunken)] transition-colors">
            <X size={12} />
          </button>
        </div>
      )}

      {reservation.status === 'seated' && (
        <div className="flex gap-2 pt-1">
          <button onClick={() => onAction(reservation.id, 'complete')} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs font-medium hover:bg-[var(--surface-sunken)] transition-colors">
            <CheckCircle2 size={12} /> Completar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReservasPage() {
  const { restaurant } = useRestaurant()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [filter, setFilter] = useState<'all' | 'active' | 'past'>('active')
  const [search, setSearch] = useState('')
  const [acting, setActing] = useState<string | null>(null)

  const timeoutMin = 15 // Default, will be read from restaurant config

  const fetchReservations = useCallback(async () => {
    if (!restaurant) return
    try {
      const res = await fetch(`/api/reservations?restaurant_id=${restaurant.id}&date=${date}`)
      const data = await res.json()
      setReservations(data.reservations || [])
    } catch {
      console.error('Error fetching reservations')
    } finally {
      setLoading(false)
    }
  }, [restaurant, date])

  useEffect(() => {
    setLoading(true)
    fetchReservations()
    // Auto-refresh cada 60s como red de seguridad si realtime falla
    const interval = setInterval(fetchReservations, 60_000)
    return () => clearInterval(interval)
  }, [fetchReservations])

  // Realtime: refresca al toque cuando cambia cualquier reserva del restaurant
  useEffect(() => {
    if (!restaurant?.id) return
    const supabase = createClient()
    const ch = supabase
      .channel(`reservas:${restaurant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table:  'reservations',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => fetchReservations(),
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [restaurant?.id, fetchReservations])

  async function handleAction(reservationId: string, action: string) {
    setActing(reservationId)
    try {
      await fetch('/api/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: reservationId, action }),
      })
      await fetchReservations()
    } finally {
      setActing(null)
    }
  }

  // Filter reservations
  const filtered = reservations.filter(r => {
    if (filter === 'active' && !['pending', 'confirmed', 'seated'].includes(r.status)) return false
    if (filter === 'past' && !['completed', 'no_show', 'cancelled'].includes(r.status)) return false
    if (search) {
      const q = search.toLowerCase()
      return r.name.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q)
    }
    return true
  })

  // Stats
  const stats = {
    total: reservations.length,
    active: reservations.filter(r => ['pending', 'confirmed'].includes(r.status)).length,
    seated: reservations.filter(r => r.status === 'seated').length,
    noShow: reservations.filter(r => r.status === 'no_show').length,
    totalPax: reservations.filter(r => ['pending', 'confirmed', 'seated'].includes(r.status)).reduce((s, r) => s + r.party_size, 0),
  }

  // Date navigation
  function changeDate(delta: number) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().split('T')[0])
  }

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const dateObj = new Date(date + 'T12:00:00')
  const isToday = date === new Date().toISOString().split('T')[0]

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={22} className="text-[#E55A2B] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[var(--text-strong)] text-xl font-bold flex items-center gap-2">
            <CalendarDays size={20} className="text-[#E55A2B]" /> Reservas
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">Gestiona las reservas de tu restaurante</p>
        </div>
        <button onClick={fetchReservations} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs hover:bg-[var(--surface-sunken)] transition-colors">
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {/* Date nav + Search */}
      <div className="flex items-center gap-3">
        <button onClick={() => changeDate(-1)} className="p-2 rounded-lg bg-[var(--surface-sunken)] hover:bg-[var(--surface-sunken)] text-[var(--text-muted)] transition-colors">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-[var(--text-strong)] font-semibold text-sm">{dayNames[dateObj.getDay()]} {dateObj.getDate()}/{dateObj.getMonth() + 1}/{dateObj.getFullYear()}</p>
          {isToday && <p className="text-[#E55A2B] text-[10px] font-medium">HOY</p>}
        </div>
        <button onClick={() => changeDate(1)} className="p-2 rounded-lg bg-[var(--surface-sunken)] hover:bg-[var(--surface-sunken)] text-[var(--text-muted)] transition-colors">
          <ChevronRight size={16} />
        </button>
        {!isToday && (
          <button onClick={() => setDate(new Date().toISOString().split('T')[0])} className="px-3 py-1.5 rounded-lg bg-[#FF6B35]/10 text-[#E55A2B] text-xs font-medium hover:bg-[#FF6B35]/20 transition-colors">
            Hoy
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o teléfono..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#FF6B35]/40 focus:bg-white/[0.05] transition-colors"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-[var(--text-strong)]' },
          { label: 'Por llegar', value: stats.active, color: 'text-[var(--info-text)]' },
          { label: 'Sentados', value: stats.seated, color: 'text-[var(--success-text)]' },
          { label: 'No llegaron', value: stats.noShow, color: 'text-[var(--danger-text)]' },
          { label: 'Personas', value: stats.totalPax, color: 'text-[#E55A2B]' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.02] border border-[var(--border-subtle)] rounded-xl p-3 text-center">
            <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
            <p className="text-[var(--text-muted)] text-[10px]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['active', 'all', 'past'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${filter === f ? 'bg-[#FF6B35]/15 text-[#E55A2B] border border-[#FF6B35]/30' : 'bg-[var(--surface-sunken)] text-[var(--text-muted)] border border-transparent hover:bg-[var(--surface-sunken)]'}`}>
            {f === 'active' ? 'Activas' : f === 'all' ? 'Todas' : 'Pasadas'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={22} className="text-[#E55A2B] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Sin reservas" description={`No hay reservas ${filter === 'active' ? 'activas' : ''} para este día`} />
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <ReservationCard key={r.id} reservation={r} timeoutMin={timeoutMin} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  )
}
