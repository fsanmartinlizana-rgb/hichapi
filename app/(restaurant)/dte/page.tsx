'use client'

import { useEffect, useState } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  FileText, ShieldCheck, AlertCircle, Loader2, Upload, Clock,
  CheckCircle2, XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge, type Tone } from '@/components/ui/StatusBadge'
import { formatCurrency } from '@/lib/i18n'

// ── Types ────────────────────────────────────────────────────────────────────

interface CredentialMeta {
  cert_subject:    string | null
  cert_issuer:     string | null
  cert_valid_from: string | null
  cert_valid_to:   string | null
  uploaded_at:     string
  rotated_at:      string | null
}

interface Emission {
  id:             string
  document_type:  number
  folio:          number
  status:         string
  total_amount:   number
  net_amount:     number
  iva_amount:     number
  rut_receptor:   string | null
  razon_receptor: string | null
  sii_track_id:   string | null
  emitted_at:     string
  order_id:       string | null
}

const DOC_TYPE_LABEL: Record<number, string> = {
  39: 'Boleta',
  41: 'Boleta exenta',
  33: 'Factura',
}

const STATUS_STYLE: Record<string, { tone: Tone; label: string; icon: LucideIcon }> = {
  draft:     { tone: 'neutral', label: 'Borrador',  icon: Clock },
  signed:    { tone: 'info',    label: 'Firmada',   icon: ShieldCheck },
  sent:      { tone: 'info',    label: 'Enviada',   icon: Upload },
  accepted:  { tone: 'success', label: 'Aceptada',  icon: CheckCircle2 },
  rejected:  { tone: 'danger',  label: 'Rechazada', icon: XCircle },
  cancelled: { tone: 'neutral', label: 'Anulada',   icon: XCircle },
}

const fmtCLP = (n: number) => formatCurrency(n)

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DtePage() {
  const { restaurant } = useRestaurant()

  const [credential, setCredential] = useState<CredentialMeta | null>(null)
  const [emissions,  setEmissions]  = useState<Emission[]>([])
  const [totals,     setTotals]     = useState({ count: 0, gross: 0, accepted: 0 })
  const [loading,    setLoading]    = useState(true)
  const [uploading,  setUploading]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  // Form
  const [certFile,     setCertFile]     = useState<File | null>(null)
  const [certPassword, setCertPassword] = useState('')

  useEffect(() => {
    if (!restaurant) return
    setLoading(true)
    Promise.all([
      fetch(`/api/dte/credentials?restaurant_id=${restaurant.id}`).then(r => r.json()),
      fetch(`/api/dte/emissions?restaurant_id=${restaurant.id}`).then(r => r.json()),
    ])
      .then(([credRes, emRes]) => {
        setCredential(credRes.credential ?? null)
        setEmissions(emRes.emissions ?? [])
        setTotals(emRes.totals ?? { count: 0, gross: 0, accepted: 0 })
      })
      .catch(() => setError('No se pudo cargar la configuración DTE'))
      .finally(() => setLoading(false))
  }, [restaurant])

  async function handleUpload() {
    if (!restaurant || !certFile || !certPassword) return
    setUploading(true)
    setError(null)
    try {
      const buf       = await certFile.arrayBuffer()
      const certB64   = Buffer.from(buf).toString('base64')
      const res = await fetch('/api/dte/credentials', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          cert_base64:   certB64,
          cert_password: certPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo subir el certificado')
        return
      }
      // Refresh metadata
      const meta = await fetch(`/api/dte/credentials?restaurant_id=${restaurant.id}`).then(r => r.json())
      setCredential(meta.credential ?? null)
      setShowUpload(false)
      setCertFile(null)
      setCertPassword('')
    } catch {
      setError('Error procesando el certificado')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <FileText size={20} className="text-[#FF6B35]" />
            DTE Chile
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            Boletas y facturas electrónicas integradas con el SII
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle size={14} className="text-red-300 shrink-0 mt-0.5" />
          <p className="text-red-200 text-xs">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Emitidas" value={totals.count.toString()} icon={<FileText size={14} />} />
        <StatCard label="Aceptadas SII" value={totals.accepted.toString()} icon={<CheckCircle2 size={14} className="text-emerald-400" />} />
        <StatCard label="Facturado" value={fmtCLP(totals.gross)} icon={<ShieldCheck size={14} />} />
      </div>

      {/* Credential card */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-[#FF6B35]" />
            <p className="text-white font-semibold text-sm">Certificado SII</p>
          </div>
          <button
            onClick={() => setShowUpload(v => !v)}
            className="text-xs text-[#FF6B35] hover:text-[#FF8A5B] transition-colors"
          >
            {credential ? 'Rotar certificado' : 'Subir certificado'}
          </button>
        </div>

        {credential ? (
          <div className="space-y-2 text-xs">
            <Row label="Sujeto"  value={credential.cert_subject ?? '—'} />
            <Row label="Emisor"  value={credential.cert_issuer ?? '—'} />
            <Row
              label="Vigencia"
              value={
                credential.cert_valid_from && credential.cert_valid_to
                  ? `${new Date(credential.cert_valid_from).toLocaleDateString('es-CL')} – ${new Date(credential.cert_valid_to).toLocaleDateString('es-CL')}`
                  : '—'
              }
            />
            <Row
              label="Subido"
              value={new Date(credential.rotated_at ?? credential.uploaded_at).toLocaleString('es-CL')}
            />
          </div>
        ) : (
          <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
            <p className="text-white/50 text-xs">
              Aún no has subido tu certificado. Sin él, no puedes emitir DTE.
            </p>
          </div>
        )}

        {showUpload && (
          <div className="border-t border-white/5 pt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium">Archivo .pfx / .p12</label>
              <input
                type="file"
                accept=".pfx,.p12"
                onChange={e => setCertFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-white/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#FF6B35]/20 file:text-[#FF6B35] file:text-xs file:font-semibold hover:file:bg-[#FF6B35]/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium">Contraseña del certificado</label>
              <input
                type="password"
                value={certPassword}
                onChange={e => setCertPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
              />
              <p className="text-white/20 text-[10px]">
                Se cifra con AES-256-GCM antes de guardarse. Nunca queda en logs.
              </p>
            </div>
            <button
              onClick={handleUpload}
              disabled={!certFile || !certPassword || uploading}
              className="w-full py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Cifrando y subiendo…' : 'Subir certificado'}
            </button>
          </div>
        )}
      </div>

      {/* Emissions list */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl">
        <div className="p-5 border-b border-white/5">
          <p className="text-white font-semibold text-sm">Últimas emisiones</p>
        </div>

        {emissions.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Aún no has emitido documentos"
            description="Cuando emitas boletas o facturas, aparecerán acá con su estado en el SII"
          />
        ) : (
          <div className="divide-y divide-white/5">
            {emissions.map(em => {
              const style = STATUS_STYLE[em.status] ?? STATUS_STYLE.draft
              return (
                <div key={em.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-semibold">
                        {DOC_TYPE_LABEL[em.document_type]} #{em.folio}
                      </span>
                      {em.razon_receptor && (
                        <span className="text-white/40 text-xs truncate">· {em.razon_receptor}</span>
                      )}
                    </div>
                    <p className="text-white/30 text-[11px]">
                      {new Date(em.emitted_at).toLocaleString('es-CL')}
                    </p>
                  </div>
                  <p className="text-white font-mono text-sm shrink-0">{fmtCLP(em.total_amount)}</p>
                  <StatusBadge tone={style.tone} icon={style.icon} label={style.label} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-white/25 text-[10px] text-center">
        Sprint 13 — scaffold listo. Firma XML + envío al SII se activa una vez subido el certificado real.
      </p>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[#161622] border border-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-white/40 text-[11px] font-medium">{label}</span>
        <span className="text-white/40">{icon}</span>
      </div>
      <p className="text-white text-xl font-bold">{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-white/30 w-20 shrink-0">{label}</span>
      <span className="text-white/70 break-all">{value}</span>
    </div>
  )
}
