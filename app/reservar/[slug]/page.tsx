'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { CalendarDays, Clock, Users, CheckCircle2, X, Loader2, ChevronLeft, ChevronRight, MapPin, Phone as PhoneIcon } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface RestaurantInfo {
  id: string
  name: string
  address: string | null
  phone: string | null
  photo_url: string | null
  hours: Record<string, { open: string; close: string; closed: boolean }> | null
  reservations_enabled: boolean
  reservation_max_party: number
  reservation_advance_days: number
}

interface TimeSlot {
  time: string
  available: boolean
  remaining: number
}

interface ReservationResult {
  reservation: { id: string; token: string; reservation_date: string; reservation_time: string; status: string }
  restaurant_name: string
}

// ── Reservation Form ─────────────────────────────────────────────────────────

function ReservationForm({
  restaurant,
  onSuccess,
}: {
  restaurant: RestaurantInfo
  onSuccess: (result: ReservationResult) => void
}) {
  const [step, setStep] = useState<'date' | 'time' | 'info'>('date')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Generate available dates (next N days)
  const dates = Array.from({ length: Math.min(restaurant.reservation_advance_days || 30, 14) }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  // Fetch time slots when date or partySize changes
  useEffect(() => {
    if (!date) return
    setLoadingSlots(true)
    setSlots([])
    setTime('')
    fetch(`/api/reservations/availability?restaurant_id=${restaurant.id}&date=${date}&party_size=${partySize}`)
      .then(r => r.json())
      .then(data => {
        if (data.closed) {
          setSlots([])
          setError('El restaurante está cerrado este día')
        } else {
          setSlots(data.slots || [])
          setError('')
        }
      })
      .catch(() => setError('Error al cargar horarios'))
      .finally(() => setLoadingSlots(false))
  }, [date, partySize, restaurant.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          party_size: partySize,
          reservation_date: date,
          reservation_time: time,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSuccess(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al reservar')
    } finally {
      setSubmitting(false)
    }
  }

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  function formatDateLabel(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00')
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (d.toDateString() === today.toDateString()) return 'Hoy'
    if (d.toDateString() === tomorrow.toDateString()) return 'Mañana'
    return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Party size ── */}
      <div>
        <label className="text-white/50 text-xs mb-2 block flex items-center gap-1.5">
          <Users size={12} /> ¿Cuántos son?
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {Array.from({ length: Math.min(restaurant.reservation_max_party || 10, 10) }, (_, i) => i + 1).map(n => (
            <button key={n} type="button" onClick={() => setPartySize(n)} className={`w-10 h-10 rounded-xl text-sm font-semibold transition-all ${partySize === n ? 'bg-[#FF6B35] text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── Date picker ── */}
      <div>
        <label className="text-white/50 text-xs mb-2 block flex items-center gap-1.5">
          <CalendarDays size={12} /> ¿Qué día?
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
          {dates.map(d => (
            <button key={d} type="button" onClick={() => { setDate(d); if (step === 'date') setStep('time') }} className={`shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all ${date === d ? 'bg-[#FF6B35] text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
              {formatDateLabel(d)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Time slots ── */}
      {date && (
        <div>
          <label className="text-white/50 text-xs mb-2 block flex items-center gap-1.5">
            <Clock size={12} /> ¿A qué hora?
          </label>
          {loadingSlots ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 size={16} className="text-[#FF6B35] animate-spin" />
              <span className="text-white/30 text-xs">Cargando horarios...</span>
            </div>
          ) : slots.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-4">No hay horarios disponibles para este día</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
              {slots.filter(s => s.available).map(s => (
                <button key={s.time} type="button" onClick={() => { setTime(s.time); setStep('info') }} className={`px-2 py-2 rounded-xl text-xs font-medium transition-all ${time === s.time ? 'bg-[#FF6B35] text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                  {s.time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Contact info ── */}
      {time && (
        <>
          <div className="border-t border-white/8 pt-4 space-y-3">
            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Tu nombre</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="Ej: Carlos" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Teléfono</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+56 9 1234 5678" type="tel" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Email <span className="text-white/20">(opcional)</span></label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" type="email" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Notas <span className="text-white/20">(opcional)</span></label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: cumpleaños, silla para bebé..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white/3 border border-white/8 rounded-xl p-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Fecha</span>
              <span className="text-white">{formatDateLabel(date)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Hora</span>
              <span className="text-white">{time} hrs</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Personas</span>
              <span className="text-white">{partySize}</span>
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="text-red-400 text-xs text-center bg-red-500/10 rounded-xl py-2 px-3">{error}</p>
      )}

      {time && (
        <button type="submit" disabled={submitting || !name || !phone} className="w-full py-3.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <CalendarDays size={16} />}
          {submitting ? 'Reservando...' : 'Confirmar reserva'}
        </button>
      )}
    </form>
  )
}

// ── Confirmation View ────────────────────────────────────────────────────────

function ConfirmationView({ result, restaurant }: { result: ReservationResult; restaurant: RestaurantInfo }) {
  const res = result.reservation
  const dateObj = new Date(res.reservation_date + 'T12:00:00')
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  return (
    <div className="space-y-5 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mx-auto">
        <CheckCircle2 size={28} className="text-emerald-400" />
      </div>

      <div>
        <p className="text-emerald-400 font-bold text-lg">Reserva confirmada</p>
        <p className="text-white/40 text-sm mt-1">Te esperamos en {result.restaurant_name}</p>
      </div>

      <div className="bg-white/3 border border-white/8 rounded-2xl p-4 space-y-3 text-left">
        <div className="flex justify-between text-sm">
          <span className="text-white/40">Fecha</span>
          <span className="text-white font-medium">{dayNames[dateObj.getDay()]} {dateObj.getDate()} de {monthNames[dateObj.getMonth()]}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/40">Hora</span>
          <span className="text-white font-medium">{res.reservation_time.slice(0, 5)} hrs</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/40">Estado</span>
          <span className="text-emerald-400 font-medium flex items-center gap-1"><CheckCircle2 size={12} /> Confirmada</span>
        </div>
      </div>

      {restaurant.address && (
        <div className="flex items-center gap-2 text-white/30 text-xs justify-center">
          <MapPin size={12} /> {restaurant.address}
        </div>
      )}
      {restaurant.phone && (
        <div className="flex items-center gap-2 text-white/30 text-xs justify-center">
          <PhoneIcon size={12} /> {restaurant.phone}
        </div>
      )}

      <p className="text-white/15 text-[10px]">
        Si no llegas dentro de los primeros minutos de tu reserva, tu mesa podría ser liberada.
      </p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReservarPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const slug = params.slug as string
  const token = searchParams.get('token')

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [result, setResult] = useState<ReservationResult | null>(null)

  // Fetch restaurant info by slug
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/restaurants/by-slug?slug=${slug}`)
        if (!res.ok) { setNotFound(true); return }
        const data = await res.json()
        setRestaurant(data.restaurant)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  // If token provided, show status
  const [statusData, setStatusData] = useState<{ reservation: Record<string, unknown>; restaurant: Record<string, unknown> } | null>(null)
  useEffect(() => {
    if (!token) return
    fetch(`/api/reservations/status?token=${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStatusData(data) })
  }, [token])

  return (
    <div className="min-h-screen bg-[#0A0A14] flex flex-col items-center justify-start px-4 pt-10 pb-16" style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>

      {/* Header */}
      <div className="w-full max-w-sm mb-6 text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#FF6B35] flex items-center justify-center text-white font-bold text-sm">hi</div>
          <span className="text-white/50 text-sm">HiChapi</span>
        </div>
        <h1 className="text-white font-bold text-lg">{restaurant?.name || 'Cargando...'}</h1>
        <p className="text-white/30 text-sm mt-0.5">Reservar mesa</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-[#161622] border border-white/8 rounded-2xl p-6">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={24} className="text-[#FF6B35] animate-spin" />
            <p className="text-white/40 text-sm">Cargando...</p>
          </div>
        ) : notFound ? (
          <div className="text-center py-6 space-y-3">
            <X size={28} className="text-white/20 mx-auto" />
            <p className="text-white/50 text-sm">Restaurante no encontrado</p>
          </div>
        ) : restaurant && !restaurant.reservations_enabled ? (
          <div className="text-center py-6 space-y-3">
            <CalendarDays size={28} className="text-white/20 mx-auto" />
            <p className="text-white/50 text-sm">Este restaurante aún no acepta reservas online</p>
            {restaurant.phone && (
              <a href={`tel:${restaurant.phone}`} className="text-[#FF6B35] text-sm hover:underline flex items-center gap-1 justify-center">
                <PhoneIcon size={12} /> Llamar para reservar
              </a>
            )}
          </div>
        ) : result ? (
          <ConfirmationView result={result} restaurant={restaurant!} />
        ) : restaurant ? (
          <ReservationForm restaurant={restaurant} onSuccess={setResult} />
        ) : null}
      </div>

      {/* Footer */}
      <p className="text-white/15 text-[10px] mt-6 text-center">Powered by HiChapi</p>
    </div>
  )
}
