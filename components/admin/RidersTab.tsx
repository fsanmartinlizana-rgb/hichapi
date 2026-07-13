'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp, Image as ImageIcon, ExternalLink } from 'lucide-react'

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
  doc_permit_url?: string
  doc_inspection_url?: string
  doc_driver_record_url?: string
  updated_at: string
}

const STATUS_STYLES: Record<DocStatus, string> = {
  documents_submitted: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  approved:            'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  rejected:            'bg-red-500/10 text-red-700 border-red-500/30',
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

interface RidersTabProps {
  adminSecret: string
}

export default function RidersTab({ adminSecret }: RidersTabProps) {
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/riders?status=${tab}`, {
        headers: { 'x-admin-secret': adminSecret },
        cache: 'no-store',
      })
      if (res.ok) {
        const json = await res.json()
        setRiders(json.data ?? [])
      } else {
        console.error('Failed to fetch riders')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [adminSecret, tab])

  useEffect(() => {
    load()
  }, [load])

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setActionLoading(id + action)
    try {
      const res = await fetch('/api/admin/riders', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
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

  return (
    <div className="space-y-4">
      {/* Sub-Tabs */}
      <div className="flex gap-2">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => { setTab(s); setExpanded(null) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              tab === s
                ? 'bg-[#FF6B35] border-[#FF6B35] text-white'
                : 'bg-[var(--surface-sunken)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-strong)]'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Grid / List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : riders.length === 0 ? (
        <div className="text-center py-20 border border-[var(--border-subtle)] bg-[var(--surface-sunken)] rounded-2xl text-[var(--text-muted)]">
          <Clock size={40} className="mx-auto mb-3" strokeWidth={1} />
          <p className="text-sm">No hay repartidores con documentos en estado {STATUS_LABELS[tab].toLowerCase()}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {riders.map(rider => {
            const isOpen   = expanded === rider.id
            const isActing = actionLoading?.startsWith(rider.id)

            return (
              <div key={rider.id} className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
                {/* Header Row */}
                <button
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface-sunken)] transition-colors text-left"
                  onClick={() => setExpanded(isOpen ? null : rider.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#FF6B35]/20 border border-[#FF6B35]/30 flex items-center justify-center text-[#E55A2B] font-bold text-sm shrink-0">
                      {rider.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-[var(--text-strong)] text-sm truncate">{rider.full_name}</p>
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
                  <div className="px-5 pb-5 border-t border-[var(--border-subtle)] bg-black/20">
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
                      <DocumentCard label="Permiso de Circulación" url={rider.doc_permit_url} />
                      <DocumentCard label="Revisión Técnica" url={rider.doc_inspection_url} />
                      <DocumentCard label="Hoja de Vida del Conductor" url={rider.doc_driver_record_url} />
                    </div>

                    {/* Actions */}
                    {rider.document_status === 'documents_submitted' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(rider.id, 'approve')}
                          disabled={!!isActing}
                          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold
                                     bg-green-600 hover:bg-green-500 disabled:bg-[var(--surface-sunken)] disabled:text-[var(--text-muted)]
                                     text-[var(--text-strong)] transition-colors shadow-sm"
                        >
                          <CheckCircle size={14} />
                          {actionLoading === rider.id + 'approve' ? 'Aprobando…' : 'Aprobar Repartidor'}
                        </button>
                        <button
                          onClick={() => handleAction(rider.id, 'reject')}
                          disabled={!!isActing}
                          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold
                                     border border-red-500/30 text-red-700 hover:bg-red-500/10
                                     disabled:opacity-50 transition-colors bg-transparent shadow-sm"
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

      {/* Toast */}
      {toast && (
        <div className={[
          'fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium shadow-lg',
          'transition-all duration-200 z-50',
          toast.ok ? 'bg-[#FF6B35] text-white' : 'bg-red-500 text-white',
        ].join(' ')}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-medium mb-0.5">{label}</p>
      <p className="text-sm text-[var(--text-strong)] font-medium">{value}</p>
    </div>
  )
}

function DocumentCard({ label, url }: { label: string; url?: string }) {
  return (
    <div className="bg-[var(--surface-sunken)] rounded-xl p-3 border border-[var(--border-subtle)] shadow-sm flex flex-col h-64">
      <p className="text-xs text-[var(--text-muted)] font-semibold mb-2">{label}</p>
      {url ? (
        <div className="relative flex-1 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-black/10 flex items-center justify-center group">
          <img
            src={url}
            alt={label}
            className="max-h-full max-w-full object-contain"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[var(--text-strong)] text-xs font-semibold transition-opacity"
          >
            Abrir original <ExternalLink size={12} className="ml-1" />
          </a>
        </div>
      ) : (
        <div className="flex-1 rounded-lg border border-dashed border-[var(--border-subtle)] flex flex-col items-center justify-center bg-black/5">
          <ImageIcon className="text-[var(--text-muted)] mb-1" size={24} />
          <p className="text-[11px] text-[var(--text-muted)]">No cargado</p>
        </div>
      )}
    </div>
  )
}
