'use client'

import { useState } from 'react'
import {
  Users, Clock, Bell, CheckCircle2, X, ChevronRight,
  QrCode, Plus, Phone, UserCheck, Ban,
} from 'lucide-react'
import type { WaitlistEntry } from '@/lib/waitlist/types'
import { formatEta } from '@/lib/waitlist/eta'

// ── Mock data ─────────────────────────────────────────────────────────────────

type MesaStatus = 'ocupada' | 'cuenta' | 'libre' | 'limpia' | 'reserva'

interface Mesa {
  id: string
  label: string
  seats: number
  status: MesaStatus
  seatedAt?: string   // ISO string
  pax?: number
}

const MESAS_INIT: Mesa[] = [
  { id: 'm1',  label: '01', seats: 4, status: 'ocupada', seatedAt: new Date(Date.now() - 45*60000).toISOString(), pax: 3 },
  { id: 'm2',  label: '02', seats: 2, status: 'cuenta',  seatedAt: new Date(Date.now() - 72*60000).toISOString(), pax: 2 },
  { id: 'm3',  label: '03', seats: 4, status: 'libre' },
  { id: 'm4',  label: '04', seats: 6, status: 'ocupada', seatedAt: new Date(Date.now() - 28*60000).toISOString(), pax: 4 },
  { id: 'm5',  label: '05', seats: 2, status: 'libre' },
  { id: 'm6',  label: '06', seats: 4, status: 'libre' },
  { id: 'm7',  label: '07', seats: 4, status: 'ocupada', seatedAt: new Date(Date.now() - 15*60000).toISOString(), pax: 2 },
  { id: 'm8',  label: '08', seats: 6, status: 'reserva' },
  { id: 'm9',  label: '09', seats: 4, status: 'ocupada', seatedAt: new Date(Date.now() - 58*60000).toISOString(), pax: 4 },
  { id: 'm10', label: '10', seats: 2, status: 'libre' },
  { id: 'm11', label: '11', seats: 4, status: 'cuenta',  seatedAt: new Date(Date.now() - 80*60000).toISOString(), pax: 5 },
  { id: 'm12', label: '12', seats: 4, status: 'limpia' },
]

const WAITLIST_INIT: WaitlistEntry[] = [
  { id: 'w1', restaurant_id: 'r1', table_id: null, name: 'Carlos Muñoz',    phone: '+56 9 8832 1234', party_size: 3, token: 'abc', status: 'waiting',   position: 1, joined_at: new Date(Date.now()-12*60000).toISOString(), notified_at: null, seated_at: null, estimated_wait_min: 8,  notes: null },
  { id: 'w2', restaurant_id: 'r1', table_id: null, name: 'Ana Torres',      phone: '+56 9 7721 5678', party_size: 2, token: 'def', status: 'waiting',   position: 2, joined_at: new Date(Date.now()-8*60000).toISOString(),  notified_at: null, seated_at: null, estimated_wait_min: 18, notes: 'Alérgica al gluten' },
  { id: 'w3', restaurant_id: 'r1', table_id: null, name: 'Pedro Salinas',   phone: '+56 9 6612 9012', party_size: 4, token: 'ghi', status: 'notified',  position: 3, joined_at: new Date(Date.now()-20*60000).toISOString(), notified_at: new Date(Date.now()-2*60000).toISOString(), seated_at: null, estimated_wait_min: 0, notes: null },
  { id: 'w4', restaurant_id: 'r1', table_id: null, name: 'Valentina Ríos',  phone: '+56 9 5501 3456', party_size: 2, token: 'jkl', status: 'waiting',   position: 4, joined_at: new Date(Date.now()-3*60000).toISOString(),  notified_at: null, seated_at: null, estimated_wait_min: 32, notes: null },
]

// ── Styles ────────────────────────────────────────────────────────────────────

const MESA_STYLES: Record<MesaStatus, { bg: string; border: string; text: string; label: string }> = {
  ocupada: { bg: 'bg-[#FF6B35]/10', border: 'border-[#FF6B35]/30', text: 'text-[#FF6B35]', label: 'ocupada'  },
  cuenta:  { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', label: 'cuenta' },
  libre:   { bg: 'bg-white/3',       border: 'border-white/8',       text: 'text-white/25',   label: 'libre'  },
  limpia:  { bg: 'bg-teal-500/15',   border: 'border-teal-400/40',   text: 'text-teal-400',   label: 'limpia' },
  reserva: { bg: 'bg-violet-500/10', border: 'border-violet-400/30', text: 'text-violet-400', label: 'reserva'},
}

const STATUS_ORDER: Record<WaitlistEntry['status'], number> = {
  notified: 0, waiting: 1, seated: 2, cancelled: 3,
}

function elapsedMin(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
}

function maskPhone(p: string) {
  return p.replace(/(\d{4})$/, '****')
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MesaCard({
  mesa,
  onMarkClean,
  onAssign,
}: {
  mesa: Mesa
  onMarkClean: (id: string) => void
  onAssign: (id: string) => void
}) {
  const s = MESA_STYLES[mesa.status]
  const elapsed = mesa.seatedAt ? elapsedMin(mesa.seatedAt) : null
  const isLong = elapsed !== null && elapsed > 70

  return (
    <div className={`${s.bg} border ${s.border} rounded-xl p-3 flex flex-col gap-2 relative
                     ${mesa.status === 'limpia' ? 'ring-1 ring-teal-400/30' : ''}`}>
      {/* Pulsing ring for limpia */}
      {mesa.status === 'limpia' && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping opacity-60" />
      )}

      <div className="flex items-center justify-between">
        <span className="text-white font-bold text-lg leading-none" style={{ fontFamily: 'var(--font-dm-mono)' }}>
          {mesa.label}
        </span>
        {mesa.pax && (
          <div className="flex items-center gap-1">
            <Users size={9} className="text-white/25" />
            <span className="text-white/30 text-[9px]">{mesa.pax}</span>
          </div>
        )}
      </div>

      <p className={`text-[9px] font-semibold uppercase tracking-wide ${s.text}`}>
        {s.label}
      </p>

      {elapsed !== null && (
        <p className={`text-[9px] font-mono ${isLong ? 'text-red-400' : 'text-white/25'}`}>
          {elapsed} min
        </p>
      )}

      {/* Actions */}
      {mesa.status === 'ocupada' && (
        <button
          onClick={() => onMarkClean(mesa.id)}
          className="mt-1 w-full py-1 rounded-lg text-[9px] font-medium text-white/40
                     border border-white/8 hover:border-teal-400/30 hover:text-teal-400 transition-colors"
        >
          Marcar limpia
        </button>
      )}
      {mesa.status === 'limpia' && (
        <button
          onClick={() => onAssign(mesa.id)}
          className="mt-1 w-full py-1 rounded-lg text-[9px] font-semibold text-teal-400
                     border border-teal-400/30 bg-teal-400/10 hover:bg-teal-400/20 transition-colors"
        >
          Asignar →
        </button>
      )}
    </div>
  )
}

function WaitlistCard({
  entry,
  onNotify,
  onSeat,
  onCancel,
}: {
  entry: WaitlistEntry
  onNotify: (id: string) => void
  onSeat: (id: string) => void
  onCancel: (id: string) => void
}) {
  const waitMins = elapsedMin(entry.joined_at)
  const notifiedMins = entry.notified_at ? elapsedMin(entry.notified_at) : null

  const statusConfig = {
    waiting:   { color: 'text-white/50',   bg: 'bg-white/5',        label: `#${entry.position} en cola` },
    notified:  { color: 'text-[#FF6B35]',  bg: 'bg-[#FF6B35]/10',   label: 'Notificado' },
    seated:    { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Sentado' },
    cancelled: { color: 'text-white/20',   bg: 'bg-white/3',        label: 'Cancelado' },
  }[entry.status]

  return (
    <div className={`rounded-xl border p-3.5 space-y-2.5
      ${entry.status === 'notified' ? 'border-[#FF6B35]/30 bg-[#FF6B35]/5' : 'border-white/6 bg-[#1C1C2E]'}`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-white text-sm font-semibold">{entry.name}</p>
            {entry.status === 'notified' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-white/35">
            <span className="flex items-center gap-1">
              <Users size={9} /> {entry.party_size} personas
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Phone size={9} /> {maskPhone(entry.phone)}
            </span>
          </div>
        </div>
        <span className={`text-[9px] font-semibold px-2 py-1 rounded-full shrink-0 ${statusConfig.bg} ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </div>

      {/* Notes */}
      {entry.notes && (
        <p className="text-[10px] text-yellow-400/70 bg-yellow-500/8 rounded-lg px-2 py-1.5 italic">
          ⚠ {entry.notes}
        </p>
      )}

      {/* ETA / timing */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-white/25 flex items-center gap-1">
          <Clock size={9} /> Esperando {waitMins} min
        </span>
        {entry.status === 'waiting' && entry.estimated_wait_min != null && (
          <span className="text-[#FF6B35]/80 font-mono font-medium">
            ETA {formatEta(entry.estimated_wait_min)}
          </span>
        )}
        {entry.status === 'notified' && notifiedMins !== null && (
          <span className="text-[#FF6B35] font-medium animate-pulse">
            Avisado hace {notifiedMins} min
          </span>
        )}
      </div>

      {/* Actions */}
      {entry.status === 'waiting' && (
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => onNotify(entry.id)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg
                       bg-[#FF6B35]/15 text-[#FF6B35] text-[10px] font-semibold
                       border border-[#FF6B35]/20 hover:bg-[#FF6B35]/25 transition-colors"
          >
            <Bell size={10} /> Notificar
          </button>
          <button
            onClick={() => onCancel(entry.id)}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg
                       border border-white/8 text-white/30 text-[10px]
                       hover:border-red-500/30 hover:text-red-400 transition-colors"
          >
            <X size={10} />
          </button>
        </div>
      )}
      {entry.status === 'notified' && (
        <div className="flex gap-1.5 pt-0.5">
          <button
            onClick={() => onSeat(entry.id)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg
                       bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold
                       border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors"
          >
            <UserCheck size={10} /> Confirmar asiento
          </button>
          <button
            onClick={() => onCancel(entry.id)}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg
                       border border-white/8 text-white/30 text-[10px]
                       hover:border-red-500/30 hover:text-red-400 transition-colors"
          >
            <Ban size={10} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Assign modal ──────────────────────────────────────────────────────────────

function AssignModal({
  mesa,
  next,
  onConfirm,
  onClose,
}: {
  mesa: Mesa
  next: WaitlistEntry | null
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
         onClick={onClose}>
      <div className="bg-[#1C1C2E] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold">Asignar Mesa {mesa.label}</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X size={16} /></button>
        </div>

        {next ? (
          <>
            <div className="bg-[#FF6B35]/8 border border-[#FF6B35]/20 rounded-xl p-4 space-y-2">
              <p className="text-white font-semibold">{next.name}</p>
              <div className="flex items-center gap-3 text-xs text-white/50">
                <span className="flex items-center gap-1"><Users size={11} /> {next.party_size} personas</span>
                <span className="flex items-center gap-1"><Phone size={11} /> {maskPhone(next.phone)}</span>
              </div>
              <p className="text-white/30 text-xs">Esperando {elapsedMin(next.joined_at)} min · Pos #{next.position}</p>
              {next.notes && <p className="text-yellow-400/80 text-xs italic">⚠ {next.notes}</p>}
            </div>
            <p className="text-white/40 text-xs text-center">
              Se marcará como "Notificado". El cliente verá su estado actualizado en tiempo real.
            </p>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:border-white/20 transition-colors">
                Cancelar
              </button>
              <button onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] transition-colors">
                Notificar y asignar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-white/50 text-sm text-center py-4">
              No hay nadie en lista de espera.<br />La mesa quedará marcada como libre.
            </p>
            <button onClick={onConfirm}
              className="w-full py-2.5 rounded-xl bg-white/8 text-white/70 text-sm hover:bg-white/12 transition-colors">
              Marcar como libre
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MesasPage() {
  const [mesas, setMesas] = useState<Mesa[]>(MESAS_INIT)
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(WAITLIST_INIT)
  const [assignModal, setAssignModal] = useState<{ mesaId: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function markClean(mesaId: string) {
    setMesas(prev => prev.map(m => m.id === mesaId ? { ...m, status: 'limpia', seatedAt: undefined, pax: undefined } : m))
  }

  function openAssign(mesaId: string) {
    setAssignModal({ mesaId })
  }

  function confirmAssign() {
    if (!assignModal) return
    const nextEntry = waitlist.filter(e => e.status === 'waiting').sort((a, b) => a.position - b.position)[0]

    // Update mesa
    setMesas(prev => prev.map(m =>
      m.id === assignModal.mesaId
        ? { ...m, status: nextEntry ? 'ocupada' : 'libre', seatedAt: nextEntry ? new Date().toISOString() : undefined, pax: nextEntry?.party_size }
        : m
    ))

    // Notify entry
    if (nextEntry) {
      setWaitlist(prev => prev.map(e =>
        e.id === nextEntry.id
          ? { ...e, status: 'notified', notified_at: new Date().toISOString() }
          : e
      ))
      showToast(`Notificado ${nextEntry.name} — Mesa ${mesas.find(m => m.id === assignModal.mesaId)?.label}`)
    }

    setAssignModal(null)
  }

  function notifyEntry(id: string) {
    setWaitlist(prev => prev.map(e =>
      e.id === id ? { ...e, status: 'notified', notified_at: new Date().toISOString() } : e
    ))
  }

  function seatEntry(id: string) {
    setWaitlist(prev => {
      const updated = prev.map(e =>
        e.id === id ? { ...e, status: 'seated' as const, seated_at: new Date().toISOString() } : e
      )
      // Reorder remaining waiting
      let pos = 1
      return updated.map(e => e.status === 'waiting' ? { ...e, position: pos++ } : e)
    })
  }

  function cancelEntry(id: string) {
    setWaitlist(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, status: 'cancelled' as const } : e)
      let pos = 1
      return updated.map(e => e.status === 'waiting' ? { ...e, position: pos++ } : e)
    })
  }

  const activeWaitlist = waitlist
    .filter(e => e.status !== 'cancelled' && e.status !== 'seated')
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.position - b.position)

  const assignMesa = mesas.find(m => m.id === assignModal?.mesaId)
  const nextInQueue = waitlist.filter(e => e.status === 'waiting').sort((a, b) => a.position - b.position)[0] ?? null

  const stats = {
    ocupadas: mesas.filter(m => m.status === 'ocupada' || m.status === 'cuenta').length,
    libres: mesas.filter(m => m.status === 'libre').length,
    limpias: mesas.filter(m => m.status === 'limpia').length,
    enEspera: waitlist.filter(e => e.status === 'waiting').length,
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: table grid ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-y-auto p-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-5 shrink-0">
          <div>
            <h1 className="text-white text-xl font-bold">Mesas</h1>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className="flex items-center gap-1.5 text-[#FF6B35]/80">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" /> {stats.ocupadas} ocupadas
              </span>
              <span className="flex items-center gap-1.5 text-teal-400/80">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" /> {stats.limpias} limpias
              </span>
              <span className="flex items-center gap-1.5 text-white/25">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20" /> {stats.libres} libres
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1.5 text-white/40 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              En vivo
            </span>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-4 gap-3">
          {mesas.map(m => (
            <MesaCard
              key={m.id}
              mesa={m}
              onMarkClean={markClean}
              onAssign={openAssign}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-white/5">
          {[
            { color: 'bg-[#FF6B35]',    label: 'Ocupada' },
            { color: 'bg-yellow-400',   label: 'Pidiendo cuenta' },
            { color: 'bg-teal-400',     label: 'Limpia — lista para sentar' },
            { color: 'bg-violet-400',   label: 'Reserva' },
            { color: 'bg-white/20',     label: 'Libre' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-white/30 text-[10px]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: waitlist sidebar ───────────────────────────────────────── */}
      <div className="w-80 shrink-0 border-l border-white/5 flex flex-col bg-[#0D0D1A]">

        {/* Sidebar header */}
        <div className="px-4 pt-5 pb-3 border-b border-white/5 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-white font-bold text-sm">Lista de espera</h2>
            <div className="flex items-center gap-2">
              {stats.enEspera > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF6B35]/20 text-[#FF6B35]">
                  {stats.enEspera}
                </span>
              )}
              <a
                href="/espera/el-rincon-de-don-jose"
                target="_blank"
                className="flex items-center gap-1 text-white/30 hover:text-white/60 transition-colors"
                title="Abrir QR público"
              >
                <QrCode size={13} />
              </a>
            </div>
          </div>
          <p className="text-white/25 text-[10px]">
            Los clientes se unen escaneando el QR de la entrada
          </p>
        </div>

        {/* ETA summary */}
        {stats.enEspera > 0 && (
          <div className="mx-3 my-3 p-3 rounded-xl bg-white/3 border border-white/6 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-[10px]">Tiempo promedio de espera</span>
              <span className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                ~{waitlist.find(e => e.status === 'waiting')?.estimated_wait_min ?? '?'} min
              </span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#FF6B35]/60 transition-all"
                style={{ width: `${Math.min(100, (stats.ocupadas / mesas.length) * 100)}%` }}
              />
            </div>
            <p className="text-white/20 text-[9px] mt-1">Basado en ocupación actual e historial</p>
          </div>
        )}

        {/* Entries */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
          {activeWaitlist.length === 0 ? (
            <div className="border border-dashed border-white/8 rounded-xl mt-4 h-28
                            flex flex-col items-center justify-center gap-2">
              <CheckCircle2 size={20} className="text-white/15" />
              <p className="text-white/20 text-xs">Sin personas en espera</p>
            </div>
          ) : (
            activeWaitlist.map(entry => (
              <WaitlistCard
                key={entry.id}
                entry={entry}
                onNotify={notifyEntry}
                onSeat={seatEntry}
                onCancel={cancelEntry}
              />
            ))
          )}
        </div>

        {/* Add manually */}
        <div className="px-3 pb-4 shrink-0">
          <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl
                             border border-dashed border-white/10 text-white/25 text-xs
                             hover:border-white/20 hover:text-white/50 transition-colors">
            <Plus size={12} /> Agregar manualmente
          </button>
        </div>
      </div>

      {/* ── Assign modal ─────────────────────────────────────────────────── */}
      {assignModal && assignMesa && (
        <AssignModal
          mesa={assignMesa}
          next={nextInQueue}
          onConfirm={confirmAssign}
          onClose={() => setAssignModal(null)}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                        bg-[#1C1C2E] border border-[#FF6B35]/30 text-white px-5 py-3
                        rounded-xl text-sm shadow-xl flex items-center gap-2">
          <Bell size={14} className="text-[#FF6B35]" />
          {toast}
        </div>
      )}
    </div>
  )
}
