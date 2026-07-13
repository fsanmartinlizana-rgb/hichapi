'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Clock, RefreshCw, LogIn, ExternalLink, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react'

const STATUSES = ['documents_submitted', 'approved', 'rejected'] as const
type DocStatus = typeof STATUSES[number]

interface RiderProfile {
  id: string
  user_id: string
  full_name: string
  phone: string
  national_id: string
  vehicle_type: string
  vehicle_model?: string
  license_plate?: string
  document_status: DocStatus
  doc_national_id_url?: string
  doc_license_url?: string
  doc_insurance_url?: string
  updated_at: string
}

const STATUS_STYLES: Record<DocStatus, string> = {
  documents_submitted: 'bg-amber-50  text-amber-600  border-amber-200',
  approved:            'bg-green-50  text-green-600  border-green-200',
  rejected:            'bg-red-50    text-red-500    border-red-200',
}

const STATUS_LABELS: Record<DocStatus, string> = {
  documents_submitted: 'Por revisar',
  approved:            'Aprobado',
  rejected:            'Rechazado',
}

const VEHICLE_LABELS: Record<string, string> = {
  bicycle:    'Bicicleta',
  motorcycle: 'Moto',
  car:        'Auto',
  cargo_bike: 'Cargo bike',
}

export default function AdminRidersPage() {
  const [secret, setSecret]     = useState('')
  const [authed, setAuthed]     = useState(false)
  const [authError, setAuthError] = useState(false)
  const [tab, setTab]           = useState<DocStatus>('documents_submitted')
  const [riders, setRiders]     = useState<RiderProfile[]>([])
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async (s = secret, t = tab) => {
    setLoading(true)
    const res = await fetch(`/api/admin/riders?status=${t}`, {
      headers: { 'x-admin-secret': s },
    })
    if (res.status === 401) {
      setAuthed(false)
      setAuthError(true)
      setLoading(false)
      return
    }
    const json = await res.json()
    setRiders(json.data ?? [])
    setLoading(false)
  }, [secret, tab])

  async function handleLogin() {
    setAuthError(false)
    const res = await fetch(`/api/admin/riders?status=documents_submitted`, {
      headers: { 'x-admin-secret': secret },
    })
    if (res.status === 401) {
      setAuthError(true)
      return
    }
    const json = await res.json()
    setRiders(json.data ?? [])
    setAuthed(true)
  }

  useEffect(() => {
    if (authed) load()
  }, [tab, authed]) // eslint-disable-line

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setActionLoading(id + action)
    try {
      const res = await fetch('/api/admin/riders', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body:    JSON.stringify({ id, action }),
      })
      const json = await res.json()
      if (res.ok) {
        showToast(
          action === 'approve'
            ? `✅ Repartidor aprobado con éxito`
            : `❌ Documentos rechazados`,
          true
        )
        setRiders(prev => prev.filter(r => r.id !== id))
      } else {
        showToast('Error: ' + (json.error ?? 'algo salió mal'), false)
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, false)
    } finally {
      setActionLoading(null)
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#FAFAF8' }}>
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-[#1A1A2E] mb-1">
            hi<span style={{ color: '#E55A2B' }}>chapi</span> admin
          </h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">Verificación de Repartidores</p>

          <div className="flex flex-col gap-3">
            <input
              type="password"
              placeholder="Clave de acceso"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm
                         text-[#1A1A2E] focus:outline-none focus:border-[#FF6B35] transition-colors"
            />
            {authError && (
              <p className="text-xs text-red-500">Clave incorrecta</p>
            )}
            <button
              onClick={handleLogin}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                         bg-[#FF6B35] hover:bg-[#e55a2b] text-white font-semibold text-sm
                         transition-colors"
            >
              <LogIn size={15} />
              Entrar
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen" style={{ background: '#FAFAF8' }}>
      {/* Header */}
      <header className="bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-bold text-[#1A1A2E]">
          hi<span style={{ color: '#E55A2B' }}>chapi</span>
          <span className="text-[var(--text-muted)] font-normal ml-2 text-sm">· Panel Repartidores</span>
        </h1>
        <div className="flex gap-4 items-center">
          <a
            href="/admin"
            className="text-xs text-neutral-500 hover:text-[#E55A2B] font-semibold transition-colors"
          >
            Ver Solicitudes de Locales
          </a>
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full
                       border border-neutral-200 text-neutral-500 hover:border-[#FF6B35]
                       hover:text-[#E55A2B] transition-colors"
          >
            <RefreshCw size={11} />
            Actualizar
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex gap-1 bg-white rounded-xl border border-neutral-100 p-1 w-fit">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => { setTab(s); setExpanded(null) }}
                className={[
                  'px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all',
                  tab === s
                    ? 'bg-[#FF6B35] text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[#1A1A2E]',
                ].join(' ')}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-neutral-100 h-20 animate-pulse" />
            ))}
          </div>
        ) : riders.length === 0 ? (
          <div className="text-center py-20 text-[var(--text-muted)]">
            <Clock size={40} className="mx-auto mb-3" strokeWidth={1} />
            <p className="text-sm">No hay repartidores con documentos en estado {STATUS_LABELS[tab].toLowerCase()}</p>
          </div>
        ) : (
          <div className="space-y-3 pb-12">
            {riders.map(rider => {
              const isOpen   = expanded === rider.id
              const isActing = actionLoading?.startsWith(rider.id)

              return (
                <div key={rider.id} className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
                  {/* Row Header */}
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-50 transition-colors text-left"
                    onClick={() => setExpanded(isOpen ? null : rider.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#FF6B35]/10 border border-[#FF6B35]/20 flex items-center justify-center text-[#E55A2B] font-bold text-sm shrink-0">
                        {rider.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-[#1A1A2E] text-sm truncate">{rider.full_name}</p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[rider.document_status]}`}>
                            {STATUS_LABELS[rider.document_status]}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          Vehículo: {VEHICLE_LABELS[rider.vehicle_type] ?? rider.vehicle_type}
                          {rider.vehicle_model ? ` (${rider.vehicle_model})` : ''}
                          {rider.license_plate ? ` · Patente: ${rider.license_plate}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-xs text-[var(--text-muted)] hidden sm:block">
                        Actualizado: {new Date(rider.updated_at).toLocaleDateString('es-CL')}
                      </p>
                      {isOpen ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
                    </div>
                  </button>

                  {/* Detail Panel */}
                  {isOpen && (
                    <div className="px-5 pb-5 border-t border-neutral-50 bg-neutral-50/50">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 mb-5">
                        <Detail label="RUT" value={rider.national_id} />
                        <Detail label="Teléfono" value={rider.phone} />
                        <Detail label="ID de Usuario Supabase" value={rider.user_id} />
                      </div>

                      {/* Documents Grid */}
                      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-bold mb-3">Documentos Cargados</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <DocumentCard label="RUT (Cédula de Identidad)" url={rider.doc_national_id_url} />
                        <DocumentCard label="Licencia de Conducir" url={rider.doc_license_url} />
                        <DocumentCard label="Seguro / Padrón" url={rider.doc_insurance_url} />
                      </div>

                      {/* Actions */}
                      {rider.document_status === 'documents_submitted' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(rider.id, 'approve')}
                            disabled={!!isActing}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold
                                       bg-green-500 hover:bg-green-600 disabled:bg-neutral-200
                                       text-[var(--text-strong)] transition-colors shadow-sm"
                          >
                            <CheckCircle size={14} />
                            {actionLoading === rider.id + 'approve' ? 'Aprobando…' : 'Aprobar Repartidor'}
                          </button>
                          <button
                            onClick={() => handleAction(rider.id, 'reject')}
                            disabled={!!isActing}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold
                                       border border-red-200 text-red-500 hover:bg-red-50
                                       disabled:opacity-50 transition-colors bg-white shadow-sm"
                          >
                            <XCircle size={14} />
                            {actionLoading === rider.id + 'reject' ? 'Rechazando…' : 'Rechazar Documentos'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={[
          'fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium shadow-lg',
          'transition-all duration-200 z-50',
          toast.ok ? 'bg-[var(--surface-card)] text-white' : 'bg-red-500 text-white',
        ].join(' ')}>
          {toast.msg}
        </div>
      )}
    </main>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-medium mb-0.5">{label}</p>
      <p className="text-sm text-[#1A1A2E] font-medium">{value}</p>
    </div>
  )
}

function DocumentCard({ label, url }: { label: string; url?: string }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-neutral-100 shadow-sm flex flex-col h-64">
      <p className="text-xs text-neutral-500 font-semibold mb-2">{label}</p>
      {url ? (
        <div className="relative flex-1 rounded-lg overflow-hidden border border-neutral-100 bg-neutral-50 flex items-center justify-center group">
          <img
            src={url}
            alt={label}
            className="max-h-full max-w-full object-contain"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[var(--text-strong)] text-xs font-semibold transition-opacity"
          >
            Abrir original <ExternalLink size={12} className="ml-1" />
          </a>
        </div>
      ) : (
        <div className="flex-1 rounded-lg border border-dashed border-neutral-200 flex flex-col items-center justify-center bg-neutral-50/50">
          <ImageIcon className="text-[var(--text-muted)] mb-1" size={24} />
          <p className="text-[11px] text-[var(--text-muted)]">No cargado</p>
        </div>
      )}
    </div>
  )
}
