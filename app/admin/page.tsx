'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Clock, RefreshCw, LogIn, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

const STATUSES = ['pending', 'approved', 'rejected'] as const
type Status = typeof STATUSES[number]

interface Submission {
  id: string
  name: string
  address: string
  neighborhood: string
  cuisine_type: string
  price_range: string
  owner_name: string
  owner_email: string
  owner_phone?: string
  description?: string
  instagram_url?: string
  status: Status
  notes?: string
  created_at: string
}

const STATUS_STYLES: Record<Status, string> = {
  pending:  'bg-amber-50  text-amber-600  border-amber-200',
  approved: 'bg-green-50  text-green-600  border-green-200',
  rejected: 'bg-red-50    text-red-500    border-red-200',
}

const STATUS_ICONS: Record<Status, React.ElementType> = {
  pending:  Clock,
  approved: CheckCircle,
  rejected: XCircle,
}

const PRICE_LABELS: Record<string, string> = {
  economico: 'Económico',
  medio:     'Precio medio',
  premium:   'Premium',
}

export default function AdminPage() {
  const [secret, setSecret]           = useState('')
  const [authed, setAuthed]           = useState(false)
  const [authError, setAuthError]     = useState(false)
  const [tab, setTab]                 = useState<Status>('pending')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading]         = useState(false)
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async (s = secret, t = tab) => {
    setLoading(true)
    const res = await fetch(`/api/admin/submissions?status=${t}`, {
      headers: { 'x-admin-secret': s },
    })
    if (res.status === 401) { setAuthed(false); setAuthError(true); setLoading(false); return }
    const json = await res.json()
    setSubmissions(json.data ?? [])
    setLoading(false)
  }, [secret, tab])

  async function handleLogin() {
    setAuthError(false)
    const res = await fetch(`/api/admin/submissions?status=pending`, {
      headers: { 'x-admin-secret': secret },
    })
    if (res.status === 401) { setAuthError(true); return }
    const json = await res.json()
    setSubmissions(json.data ?? [])
    setAuthed(true)
  }

  useEffect(() => {
    if (authed) load()
  }, [tab, authed]) // eslint-disable-line

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setActionLoading(id + action)
    const res = await fetch('/api/admin/submissions', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body:    JSON.stringify({ id, action }),
    })
    const json = await res.json()
    setActionLoading(null)
    if (res.ok || res.status === 207) {
      showToast(
        action === 'approve'
          ? `✅ ${json.submission?.name ?? ''} aprobado y creado en restaurants`
          : `❌ Solicitud rechazada`,
        res.ok
      )
      setSubmissions(prev => prev.filter(s => s.id !== id))
    } else {
      showToast('Error: ' + (json.error ?? 'algo salió mal'), false)
    }
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#FAFAF8' }}>
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-[#1A1A2E] mb-1">
            hi<span style={{ color: '#FF6B35' }}>chapi</span> admin
          </h1>
          <p className="text-sm text-neutral-400 mb-6">Panel de solicitudes</p>

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

  // ── Panel ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen" style={{ background: '#FAFAF8' }}>
      {/* Header */}
      <header className="bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-bold text-[#1A1A2E]">
          hi<span style={{ color: '#FF6B35' }}>chapi</span>
          <span className="text-neutral-400 font-normal ml-2 text-sm">· Solicitudes</span>
        </h1>
        <div className="flex gap-2 items-center">
          <a
            href="/"
            target="_blank"
            className="flex items-center gap-1 text-xs text-neutral-400 hover:text-[#FF6B35] transition-colors"
          >
            Ver app <ExternalLink size={11} />
          </a>
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full
                       border border-neutral-200 text-neutral-500 hover:border-[#FF6B35]
                       hover:text-[#FF6B35] transition-colors"
          >
            <RefreshCw size={11} />
            Actualizar
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-6 pt-6">
        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-neutral-100 p-1 w-fit">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setTab(s); setExpanded(null) }}
              className={[
                'px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all',
                tab === s
                  ? 'bg-[#FF6B35] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-[#1A1A2E]',
              ].join(' ')}
            >
              {s === 'pending' ? 'Pendientes' : s === 'approved' ? 'Aprobados' : 'Rechazados'}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-neutral-100 h-20 animate-pulse" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-20 text-neutral-300">
            <Clock size={40} className="mx-auto mb-3" strokeWidth={1} />
            <p className="text-sm">No hay solicitudes {tab === 'pending' ? 'pendientes' : tab === 'approved' ? 'aprobadas' : 'rechazadas'}</p>
          </div>
        ) : (
          <div className="space-y-3 pb-12">
            {submissions.map(sub => {
              const isOpen   = expanded === sub.id
              const Icon     = STATUS_ICONS[sub.status]
              const isActing = actionLoading?.startsWith(sub.id)

              return (
                <div key={sub.id} className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
                  {/* Row header */}
                  <button
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-neutral-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : sub.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-[#1A1A2E] text-sm truncate">{sub.name}</p>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[sub.status]}`}>
                          {sub.status}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 truncate">
                        {sub.neighborhood} · {sub.cuisine_type} · {PRICE_LABELS[sub.price_range] ?? sub.price_range}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-xs text-neutral-300 hidden sm:block">
                        {new Date(sub.created_at).toLocaleDateString('es-CL')}
                      </p>
                      {isOpen ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
                    </div>
                  </button>

                  {/* Detail panel */}
                  {isOpen && (
                    <div className="px-5 pb-5 border-t border-neutral-50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 mt-4 mb-5">
                        <Detail label="Dirección"   value={sub.address} />
                        <Detail label="Barrio"      value={sub.neighborhood} />
                        <Detail label="Cocina"      value={sub.cuisine_type} />
                        <Detail label="Precio"      value={PRICE_LABELS[sub.price_range] ?? sub.price_range} />
                        <Detail label="Dueño"       value={sub.owner_name} />
                        <Detail label="Email"       value={sub.owner_email} />
                        {sub.owner_phone   && <Detail label="Teléfono"   value={sub.owner_phone} />}
                        {sub.instagram_url && (
                          <div>
                            <p className="text-[10px] text-neutral-400 uppercase tracking-wide font-medium mb-0.5">Instagram</p>
                            <a href={sub.instagram_url} target="_blank" rel="noopener noreferrer"
                               className="text-sm text-[#FF6B35] hover:underline break-all">
                              {sub.instagram_url}
                            </a>
                          </div>
                        )}
                        {sub.description && (
                          <div className="sm:col-span-2">
                            <Detail label="Descripción" value={sub.description} />
                          </div>
                        )}
                      </div>

                      {/* Actions — only for pending */}
                      {sub.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(sub.id, 'approve')}
                            disabled={!!isActing}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium
                                       bg-green-500 hover:bg-green-600 disabled:bg-neutral-200
                                       text-white transition-colors"
                          >
                            <CheckCircle size={14} />
                            {actionLoading === sub.id + 'approve' ? 'Aprobando…' : 'Aprobar y publicar'}
                          </button>
                          <button
                            onClick={() => handleAction(sub.id, 'reject')}
                            disabled={!!isActing}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium
                                       border border-red-200 text-red-400 hover:bg-red-50
                                       disabled:opacity-50 transition-colors"
                          >
                            <XCircle size={14} />
                            {actionLoading === sub.id + 'reject' ? 'Rechazando…' : 'Rechazar'}
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
          toast.ok ? 'bg-[#1A1A2E] text-white' : 'bg-red-500 text-white',
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
      <p className="text-[10px] text-neutral-400 uppercase tracking-wide font-medium mb-0.5">{label}</p>
      <p className="text-sm text-[#1A1A2E]">{value}</p>
    </div>
  )
}
