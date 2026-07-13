'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Clock, Users, Bell, CheckCircle2, X, ChevronRight, Loader2 } from 'lucide-react'
import { formatEta } from '@/lib/waitlist/eta'
import type { WaitlistEntry } from '@/lib/waitlist/types'
import HiChapiLogo from '@/components/landing/HiChapiLogo'

// ── Join form ─────────────────────────────────────────────────────────────────

function JoinForm({ slug, onJoined }: { slug: string; onJoined: (token: string) => void }) {
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [partySize, setPartySize] = useState(2)
  const [notes, setNotes]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      // In production: fetch restaurant_id from slug, then POST
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: 'RESTAURANT_ID_FROM_SLUG', // resolved from slug in real impl
          name: name.trim(),
          phone: phone.trim(),
          party_size: partySize,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onJoined(data.token)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al unirse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-[var(--text-muted)] text-xs mb-1.5 block">Tu nombre</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="Ej: Carlos"
          className="w-full px-4 py-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)]
                     text-[var(--text-strong)] placeholder:text-[var(--text-muted)] text-sm
                     focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
        />
      </div>

      <div>
        <label className="text-[var(--text-muted)] text-xs mb-1.5 block">Teléfono (para avisarte)</label>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          required
          placeholder="+56 9 1234 5678"
          type="tel"
          className="w-full px-4 py-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)]
                     text-[var(--text-strong)] placeholder:text-[var(--text-muted)] text-sm
                     focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
        />
      </div>

      <div>
        <label className="text-[var(--text-muted)] text-xs mb-1.5 block">¿Cuántos son?</label>
        <div className="flex items-center gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setPartySize(n)}
              className={`w-10 h-10 rounded-xl text-sm font-semibold transition-all
                ${partySize === n
                  ? 'bg-[#FF6B35] text-white'
                  : 'bg-[var(--surface-sunken)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]'}`}
            >
              {n}
            </button>
          ))}
          {partySize > 8 && (
            <span className="text-[var(--text-muted)] text-sm">+{partySize - 8}</span>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <button type="button" onClick={() => setPartySize(p => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg bg-[var(--surface-sunken)] text-[var(--text-muted)] text-xs hover:bg-[var(--surface-sunken)]">−</button>
          <span className="px-3 py-1.5 text-[var(--text-strong)] text-xs">{partySize} personas</span>
          <button type="button" onClick={() => setPartySize(p => Math.min(20, p + 1))}
            className="px-3 py-1.5 rounded-lg bg-[var(--surface-sunken)] text-[var(--text-muted)] text-xs hover:bg-[var(--surface-sunken)]">+</button>
        </div>
      </div>

      <div>
        <label className="text-[var(--text-muted)] text-xs mb-1.5 block">¿Algo que debamos saber? <span className="text-[var(--text-muted)]">(opcional)</span></label>
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ej: alérgica al gluten, silla para bebé..."
          className="w-full px-4 py-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)]
                     text-[var(--text-strong)] placeholder:text-[var(--text-muted)] text-sm
                     focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
        />
      </div>

      {error && (
        <p className="text-red-700 text-xs text-center bg-red-500/10 rounded-xl py-2 px-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !name || !phone}
        className="w-full py-3.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm
                   hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {loading ? 'Uniéndome...' : 'Unirme a la lista'}
      </button>
    </form>
  )
}

// ── Status view ───────────────────────────────────────────────────────────────

function QueueDots({ position }: { position: number }) {
  const show = Math.min(position + 2, 6)
  return (
    <div className="flex items-center gap-2 justify-center">
      {Array.from({ length: show }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all ${
            i < position - 1
              ? 'w-2.5 h-2.5 bg-[var(--surface-sunken)]'
              : i === position - 1
              ? 'w-4 h-4 bg-[#FF6B35] ring-2 ring-[#FF6B35]/30'
              : 'w-2 h-2 bg-[var(--surface-sunken)]'
          }`}
        />
      ))}
      {position > show && (
        <span className="text-[var(--text-muted)] text-xs">+{position - show}</span>
      )}
    </div>
  )
}

interface StatusData {
  entry: WaitlistEntry
  restaurantName: string
  restaurantNeighborhood: string
  etaMin: number
}

function StatusView({ data, onCancel }: { data: StatusData; onCancel: () => void }) {
  const { entry, restaurantName, etaMin } = data
  const [cancelling, setCancelling] = useState(false)

  const isWaiting  = entry.status === 'waiting'
  const isNotified = entry.status === 'notified'
  const isSeated   = entry.status === 'seated'

  async function handleCancel() {
    if (!confirm('¿Seguro que quieres cancelar tu lugar?')) return
    setCancelling(true)
    await fetch('/api/waitlist/notify', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_id: entry.id, action: 'cancel' }),
    })
    onCancel()
  }

  return (
    <div className="space-y-5">

      {/* Status badge */}
      {isWaiting && (
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#FF6B35]/15 border border-[#FF6B35]/25
                          flex items-center justify-center mx-auto">
            <Clock size={24} className="text-[#E55A2B]" />
          </div>
          <div>
            <p className="text-[var(--text-muted)] text-sm">Esperando tu mesa</p>
            <p className="text-[var(--text-strong)] font-bold text-lg mt-0.5">Posición #{entry.position} en cola</p>
          </div>
          <QueueDots position={entry.position} />
        </div>
      )}

      {isNotified && (
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/30
                          flex items-center justify-center mx-auto animate-bounce">
            <Bell size={24} className="text-emerald-700" />
          </div>
          <div>
            <p className="text-emerald-700 font-bold text-lg">¡Tu mesa está lista!</p>
            <p className="text-[var(--text-muted)] text-sm mt-1">Dirígete al restaurante ahora</p>
          </div>
        </div>
      )}

      {isSeated && (
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)]
                          flex items-center justify-center mx-auto">
            <CheckCircle2 size={24} className="text-[var(--text-muted)]" />
          </div>
          <div>
            <p className="text-[var(--text-strong)] font-semibold">¡Ya estás sentado!</p>
            <p className="text-[var(--text-muted)] text-sm mt-1">Buen provecho 🍽️</p>
          </div>
        </div>
      )}

      {/* ETA card */}
      {isWaiting && (
        <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-2xl p-4 text-center">
          <p className="text-[var(--text-muted)] text-xs mb-2">Tiempo estimado de espera</p>
          <p className="font-bold text-4xl" style={{ color: '#E55A2B', fontFamily: 'var(--font-dm-mono)' }}>
            {formatEta(etaMin)}
          </p>
          <p className="text-[var(--text-muted)] text-[10px] mt-2">Estimado según ocupación actual e historial</p>
          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[var(--text-muted)] text-[10px]">Se actualiza en tiempo real</span>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-muted)]">Nombre</span>
          <span className="text-[var(--text-strong)] font-medium">{entry.name}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-muted)]">Grupo</span>
          <span className="text-[var(--text-strong)] flex items-center gap-1">
            <Users size={12} className="text-[var(--text-muted)]" /> {entry.party_size} personas
          </span>
        </div>
        {entry.notes && (
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <p className="text-yellow-700/70 text-xs italic">⚠ {entry.notes}</p>
          </div>
        )}
      </div>

      {/* Cancel */}
      {(isWaiting || isNotified) && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="w-full py-3 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm
                     hover:border-red-500/30 hover:text-red-700 transition-colors
                     disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <X size={14} />
          {cancelling ? 'Cancelando...' : 'Cancelar mi lugar'}
        </button>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EsperaPage() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const slug         = params.slug as string
  const token        = searchParams.get('token')

  const [statusData, setStatusData] = useState<StatusData | null>(null)
  const [loading, setLoading]       = useState(!!token)
  const [notFound, setNotFound]     = useState(false)

  // Restaurant name mock (replace with fetch in production)
  const restaurantName = 'El Rincón de Don José'

  const fetchStatus = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/waitlist/status?token=${token}`)
      if (!res.ok) { setNotFound(true); return }
      const data = await res.json()
      setStatusData(data)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchStatus()
    // Poll every 30 seconds as realtime fallback
    const interval = setInterval(fetchStatus, 30_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  function handleJoined(newToken: string) {
    router.replace(`/espera/${slug}?token=${newToken}`)
    setLoading(true)
    setTimeout(fetchStatus, 500)
  }

  function handleCancel() {
    router.replace(`/espera/${slug}`)
    setStatusData(null)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] flex flex-col items-center justify-start px-4 pt-10 pb-16"
         style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>

      {/* Header */}
      <div className="w-full max-w-sm mb-6 text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <HiChapiLogo size={24} />
          <span className="text-[var(--text-body)] text-sm font-bold"><span className="text-[#E55A2B]">Hi</span>Chapi</span>
        </div>
        <h1 className="text-[var(--text-strong)] font-bold text-lg">{restaurantName}</h1>
        <p className="text-[var(--text-muted)] text-sm mt-0.5">Lista de espera</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl p-6">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={24} className="text-[#E55A2B] animate-spin" />
            <p className="text-[var(--text-muted)] text-sm">Cargando tu estado...</p>
          </div>
        ) : notFound ? (
          <div className="text-center py-6 space-y-3">
            <X size={28} className="text-[var(--text-muted)] mx-auto" />
            <p className="text-[var(--text-muted)] text-sm">Link inválido o expirado</p>
            <button
              onClick={() => { setNotFound(false); router.replace(`/espera/${slug}`) }}
              className="text-[#E55A2B] text-sm hover:underline"
            >
              Unirme a la lista →
            </button>
          </div>
        ) : statusData ? (
          <StatusView data={statusData} onCancel={handleCancel} />
        ) : (
          <JoinForm slug={slug} onJoined={handleJoined} />
        )}
      </div>

      {/* Footer */}
      <p className="text-[var(--text-muted)] text-[10px] mt-6 text-center">
        Powered by HiChapi · Esta página se actualiza automáticamente
      </p>
    </div>
  )
}
