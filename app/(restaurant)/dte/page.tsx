'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  FileText, ShieldCheck, AlertCircle, Loader2, Upload, Clock,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, Globe,
  RefreshCw, X, Download, Eye, Inbox, Plus,
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
  id:                   string
  document_type:        number
  folio:                number
  status:               string
  total_amount:         number
  net_amount:           number
  iva_amount:           number
  rut_receptor:         string | null
  razon_receptor:       string | null
  sii_track_id:         string | null
  emitted_at:           string
  order_id:             string | null
  error_detail:         string | null
  xml_signed:           string | null
  aec_status:           string | null
  aec_fecha:            string | null
  aec_glosa:            string | null
  giro_receptor:        string | null
  direccion_receptor:   string | null
  comuna_receptor:      string | null
  folio_ref?:           number | null
}

interface FolioCounters {
  33: number
  39: number
  41: number
  56: number
  61: number
}

// ── Facturas recibidas ────────────────────────────────────────────────────────

interface IncomingInvoice {
  id:               string
  rut_emisor:       string
  razon_emisor:     string
  giro_emisor:      string | null
  email_emisor:     string | null
  document_type:    number
  folio:            number
  fecha_emision:    string
  total_amount:     number
  net_amount:       number | null
  iva_amount:       number | null
  reception_status: string
  reception_glosa:  string | null
  reception_date:   string | null
  received_at:      string
  pdf_url:          string | null
  dias_restantes:   number
  vencido:          boolean
}

interface IncomingFormState {
  rut_emisor:    string
  razon_emisor:  string
  giro_emisor:   string
  email_emisor:  string
  folio:         string
  fecha_emision: string
  total_amount:  string
  net_amount:    string
  iva_amount:    string
}

function defaultIncomingForm(): IncomingFormState {
  return {
    rut_emisor:    '',
    razon_emisor:  '',
    giro_emisor:   '',
    email_emisor:  '',
    folio:         '',
    fecha_emision: new Date().toISOString().split('T')[0],
    total_amount:  '',
    net_amount:    '',
    iva_amount:    '',
  }
}

interface ProveedorSuggestion {
  rut:               string
  razon_social:      string
  giro:              string | null
  email:             string | null
  facturas_emitidas: number
}

const DOC_TYPE_LABEL: Record<number, string> = {
  39: 'Boleta',
  41: 'Boleta exenta',
  33: 'Factura',
  56: 'Nota de Débito',
  61: 'Nota de Crédito',
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

  const [credential,      setCredential]      = useState<CredentialMeta | null>(null)
  const [emissions,       setEmissions]        = useState<Emission[]>([])
  const [totals,          setTotals]           = useState({ count: 0, gross: 0, accepted: 0 })
  const [folios,          setFolios]           = useState<FolioCounters | null>(null)
  const [dteEnvironment,  setDteEnvironment]   = useState<string | null>(null)
  const [loading,         setLoading]          = useState(true)
  const [uploading,       setUploading]        = useState(false)
  const [updatingEnv,     setUpdatingEnv]      = useState(false)
  const [error,           setError]            = useState<string | null>(null)
  const [showUpload,      setShowUpload]       = useState(false)

  // CAF upload form
  const [cafFile,         setCafFile]          = useState<File | null>(null)
  const [cafError,        setCafError]         = useState<string | null>(null)
  const [cafUploading,    setCafUploading]     = useState(false)
  const cafFileRef = useRef<HTMLInputElement>(null)

  // Cert form
  const [certFile,        setCertFile]         = useState<File | null>(null)
  const [certPassword,    setCertPassword]     = useState('')

  // Expanded rejection rows
  const [expandedRows,    setExpandedRows]     = useState<Set<string>>(new Set())

  // Filter by document type
  const [filterDocType,   setFilterDocType]    = useState<number | null>(null)

  // Polling state per emission
  const [pollingRows,     setPollingRows]      = useState<Set<string>>(new Set())

  // Auto-polling
  const [autoPolling,     setAutoPolling]      = useState(false)
  const autoPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Detail modal
  const [detailEmission,  setDetailEmission]   = useState<Emission | null>(null)

  // Facturas recibidas de proveedores
  const [incomingInvoices,    setIncomingInvoices]    = useState<IncomingInvoice[]>([])
  const [incomingLoading,     setIncomingLoading]     = useState(false)
  const [incomingFilter,      setIncomingFilter]      = useState<string | null>(null)
  const [showAddIncoming,     setShowAddIncoming]     = useState(false)
  const [incomingForm,        setIncomingForm]        = useState<IncomingFormState>(defaultIncomingForm())
  const [incomingFormError,   setIncomingFormError]   = useState<string | null>(null)
  const [incomingFormSaving,  setIncomingFormSaving]  = useState(false)
  const [processingIncoming,  setProcessingIncoming]  = useState<string | null>(null)

  // Autocompletado de proveedor en formulario de facturas recibidas
  const [proveedorSuggestions,     setProveedorSuggestions]     = useState<ProveedorSuggestion[]>([])
  const [showProveedorSuggestions, setShowProveedorSuggestions] = useState(false)
  const [loadingProveedorSuggest,  setLoadingProveedorSuggest]  = useState(false)
  const proveedorSuggestRef  = useRef<HTMLDivElement>(null)
  const proveedorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  async function fetchFolios(restaurantId: string) {
    const res  = await fetch(`/api/dte/folios?restaurant_id=${restaurantId}`)
    const data = await res.json()
    if (data.folios) setFolios(data.folios as FolioCounters)
  }

  async function fetchIncomingInvoices(restaurantId: string, status?: string | null) {
    setIncomingLoading(true)
    try {
      const params = new URLSearchParams({ restaurant_id: restaurantId })
      if (status) params.set('status', status)
      const res  = await fetch(`/api/dte/incoming?${params}`)
      const data = await res.json()
      setIncomingInvoices(data.invoices ?? [])
    } catch {
      // non-critical
    } finally {
      setIncomingLoading(false)
    }
  }

  async function handleIncomingAction(
    invoiceId: string,
    action: 'aceptado' | 'rechazado' | 'reclamado',
    glosa?: string
  ) {
    if (!restaurant) return
    setProcessingIncoming(invoiceId)
    try {
      const res = await fetch('/api/dte/incoming', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id:    restaurant.id,
          id:               invoiceId,
          reception_status: action,
          reception_glosa:  glosa,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? data.error ?? 'Error al procesar la factura')
        return
      }
      await fetchIncomingInvoices(restaurant.id, incomingFilter)
    } catch {
      setError('Error de red al procesar la factura')
    } finally {
      setProcessingIncoming(null)
    }
  }

  async function handleAddIncoming() {
    if (!restaurant) return
    setIncomingFormError(null)
    const total = parseInt(incomingForm.total_amount, 10)
    if (!incomingForm.rut_emisor || !incomingForm.razon_emisor || !incomingForm.folio || isNaN(total)) {
      setIncomingFormError('RUT emisor, razón social, folio y monto total son obligatorios')
      return
    }
    setIncomingFormSaving(true)
    try {
      const res = await fetch('/api/dte/incoming', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id:  restaurant.id,
          rut_emisor:     incomingForm.rut_emisor,
          razon_emisor:   incomingForm.razon_emisor,
          giro_emisor:    incomingForm.giro_emisor || undefined,
          email_emisor:   incomingForm.email_emisor || undefined,
          document_type:  33,
          folio:          parseInt(incomingForm.folio, 10),
          fecha_emision:  incomingForm.fecha_emision,
          total_amount:   total,
          net_amount:     incomingForm.net_amount ? parseInt(incomingForm.net_amount, 10) : undefined,
          iva_amount:     incomingForm.iva_amount ? parseInt(incomingForm.iva_amount, 10) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'FACTURA_DUPLICADA') {
          setIncomingFormError('Ya existe una factura con ese folio y emisor.')
        } else {
          setIncomingFormError(data.message ?? data.error ?? 'Error al registrar la factura')
        }
        return
      }
      // Guardar proveedor en directorio para autocompletado futuro
      fetch('/api/dte/receptores', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          rut:           incomingForm.rut_emisor,
          razon_social:  incomingForm.razon_emisor,
          giro:          incomingForm.giro_emisor || undefined,
          email:         incomingForm.email_emisor || undefined,
        }),
      }).catch(() => { /* non-critical */ })

      setShowAddIncoming(false)
      setIncomingForm(defaultIncomingForm())
      await fetchIncomingInvoices(restaurant.id, incomingFilter)
    } catch {
      setIncomingFormError('Error de red al registrar la factura')
    } finally {
      setIncomingFormSaving(false)
    }
  }

  // ── Autocompletado de proveedor ────────────────────────────────────────────

  function handleProveedorRutChange(value: string) {
    setIncomingForm(f => ({ ...f, rut_emisor: value }))
    setShowProveedorSuggestions(true)

    if (proveedorDebounceRef.current) clearTimeout(proveedorDebounceRef.current)
    if (value.length < 3) {
      setProveedorSuggestions([])
      setShowProveedorSuggestions(false)
      return
    }

    proveedorDebounceRef.current = setTimeout(async () => {
      if (!restaurant) return
      setLoadingProveedorSuggest(true)
      try {
        const res  = await fetch(`/api/dte/receptores?restaurant_id=${restaurant.id}&rut=${encodeURIComponent(value)}`)
        const data = await res.json()
        setProveedorSuggestions(data.receptores ?? [])
        setShowProveedorSuggestions((data.receptores ?? []).length > 0)
      } catch {
        setProveedorSuggestions([])
      } finally {
        setLoadingProveedorSuggest(false)
      }
    }, 300)
  }

  function applyProveedorSuggestion(p: ProveedorSuggestion) {
    setIncomingForm(f => ({
      ...f,
      rut_emisor:   p.rut,
      razon_emisor: p.razon_social,
      giro_emisor:  p.giro ?? '',
      email_emisor: p.email ?? '',
    }))
    setShowProveedorSuggestions(false)
  }

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (proveedorSuggestRef.current && !proveedorSuggestRef.current.contains(e.target as Node)) {
        setShowProveedorSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!restaurant) return
    setLoading(true)
    Promise.all([
      fetch(`/api/dte/credentials?restaurant_id=${restaurant.id}`).then(r => r.json()),
      fetch(`/api/dte/emissions?restaurant_id=${restaurant.id}`).then(r => r.json()),
      fetch(`/api/dte/folios?restaurant_id=${restaurant.id}`).then(r => r.json()),
    ])
      .then(([credRes, emRes, folioRes]) => {
        setCredential(credRes.credential ?? null)
        setEmissions(emRes.emissions ?? [])
        setTotals(emRes.totals ?? { count: 0, gross: 0, accepted: 0 })
        if (folioRes.folios) setFolios(folioRes.folios as FolioCounters)
      })
      .catch(() => setError('No se pudo cargar la configuración DTE'))
      .finally(() => setLoading(false))

    // Fetch dte_environment separately (non-blocking)
    fetchDteEnvironment(restaurant.id)
    // Fetch facturas recibidas (non-blocking)
    fetchIncomingInvoices(restaurant.id)
  }, [restaurant])

  async function fetchDteEnvironment(restaurantId: string) {
    try {
      const res  = await fetch(`/api/dte/environment?restaurant_id=${restaurantId}`)
      const data = await res.json()
      if (data.dte_environment) {
        setDteEnvironment(data.dte_environment)
      }
    } catch {
      // Non-critical — badge just won't show
    }
  }

  // ── Change DTE environment ─────────────────────────────────────────────────

  async function handleEnvironmentChange(newEnv: 'certification' | 'production') {
    if (!restaurant || updatingEnv) return
    setUpdatingEnv(true)
    setError(null)
    try {
      const res = await fetch('/api/dte/environment', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id:   restaurant.id,
          dte_environment: newEnv,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo cambiar el ambiente')
        return
      }
      setDteEnvironment(newEnv)
    } catch {
      setError('Error al cambiar el ambiente')
    } finally {
      setUpdatingEnv(false)
    }
  }

  // ── Certificate upload ─────────────────────────────────────────────────────

  async function handleUpload() {
    if (!restaurant || !certFile || !certPassword) return
    setUploading(true)
    setError(null)
    try {
      const buf     = await certFile.arrayBuffer()
      const certB64 = Buffer.from(buf).toString('base64')
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

  // ── CAF upload ─────────────────────────────────────────────────────────────

  async function handleCafUpload() {
    if (!restaurant || !cafFile) return
    setCafUploading(true)
    setCafError(null)
    try {
      const formData = new FormData()
      formData.append('restaurant_id', restaurant.id)
      formData.append('file', cafFile)

      const res  = await fetch('/api/dte/caf', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        const code = data.error ?? ''
        if (code.startsWith('CAF_RUT_MISMATCH')) {
          setCafError('El RUT del CAF no coincide con el RUT del restaurante.')
        } else if (code.startsWith('CAF_OVERLAP')) {
          setCafError('Ya existe un CAF activo con folios solapados para este tipo de documento.')
        } else if (code.startsWith('CAF_INVALID_XML')) {
          setCafError('El archivo XML no es un CAF válido. Verifica que sea el archivo correcto del SII.')
        } else {
          setCafError(code || 'No se pudo subir el CAF.')
        }
        return
      }

      // Success — reset form and refresh folio counters
      setCafFile(null)
      if (cafFileRef.current) cafFileRef.current.value = ''
      await fetchFolios(restaurant.id)
    } catch {
      setCafError('Error al subir el archivo CAF.')
    } finally {
      setCafUploading(false)
    }
  }

  // ── Toggle rejection detail row ────────────────────────────────────────────

  function toggleRow(id: string) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Poll SII status for a sent emission ────────────────────────────────────

  async function pollStatus(emissionId: string) {
    if (!restaurant) return
    setPollingRows(prev => new Set(prev).add(emissionId))
    try {
      const res  = await fetch('/api/dte/status', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurant.id, emission_id: emissionId }),
      })
      const data = await res.json()
      if (res.ok) {
        // Refresh emissions list to show updated status
        const emRes  = await fetch(`/api/dte/emissions?restaurant_id=${restaurant.id}`).then(r => r.json())
        setEmissions(emRes.emissions ?? [])
        setTotals(emRes.totals ?? { count: 0, gross: 0, accepted: 0 })
      } else {
        // SII_PENDING is not an error — just still processing
        if (!data.error?.startsWith('SII_PENDING')) {
          setError(data.error ?? 'Error consultando el SII')
        }
      }
    } catch {
      setError('Error de red consultando el SII')
    } finally {
      setPollingRows(prev => { const next = new Set(prev); next.delete(emissionId); return next })
    }
  }

  // ── Batch poll all sent emissions ──────────────────────────────────────────

  const batchPoll = useCallback(async (silent = false) => {
    if (!restaurant) return
    if (!silent) setAutoPolling(true)
    try {
      const res  = await fetch('/api/dte/status/batch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurant.id }),
      })
      const data = await res.json()
      if (res.ok && data.emissions) {
        setEmissions(data.emissions)
        const accepted = data.emissions.filter((e: Emission) => e.status === 'accepted').length
        const gross    = data.emissions.reduce((s: number, e: Emission) => s + (e.total_amount ?? 0), 0)
        setTotals({ count: data.emissions.length, gross, accepted })
      }
    } catch { /* silent */ }
    finally { if (!silent) setAutoPolling(false) }
  }, [restaurant])

  // Auto-poll every 30s while there are 'sent' emissions
  useEffect(() => {
    const hasSent = emissions.some(e => e.status === 'sent')
    if (!hasSent) {
      if (autoPollingRef.current) { clearInterval(autoPollingRef.current); autoPollingRef.current = null }
      return
    }
    if (autoPollingRef.current) return
    autoPollingRef.current = setInterval(() => batchPoll(true), 30_000)
    return () => {
      if (autoPollingRef.current) { clearInterval(autoPollingRef.current); autoPollingRef.current = null }
    }
  }, [emissions, batchPoll])

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }
  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-white text-xl font-bold flex items-center gap-2">
              <FileText size={20} className="text-[#FF6B35]" />
              DTE Chile
            </h1>
            {/* Environment badge — 10.1 */}
            <EnvironmentBadge environment={dteEnvironment} />
          </div>
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

      {/* Environment selector — 10.1 */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-[#FF6B35]" />
          <p className="text-white font-semibold text-sm">Ambiente SII</p>
        </div>
        <p className="text-white/40 text-xs">
          Selecciona el ambiente donde se enviarán los documentos tributarios electrónicos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => handleEnvironmentChange('certification')}
            disabled={updatingEnv || dteEnvironment === 'certification'}
            className={`p-4 rounded-xl border transition-all ${
              dteEnvironment === 'certification'
                ? 'bg-[#FBBF24]/10 border-[#FBBF24]/40 ring-2 ring-[#FBBF24]/30'
                : 'bg-white/3 border-white/8 hover:border-white/20'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${
                dteEnvironment === 'certification' ? 'bg-[#FBBF24]' : 'bg-white/20'
              }`} />
              <span className="text-white font-semibold text-sm">Certificación</span>
            </div>
            <p className="text-white/40 text-xs text-left">
              Ambiente de pruebas del SII (maullin.sii.cl, apicert.sii.cl, pangal.sii.cl)
            </p>
          </button>

          <button
            onClick={() => handleEnvironmentChange('production')}
            disabled={updatingEnv || dteEnvironment === 'production'}
            className={`p-4 rounded-xl border transition-all ${
              dteEnvironment === 'production'
                ? 'bg-[#34D399]/10 border-[#34D399]/40 ring-2 ring-[#34D399]/30'
                : 'bg-white/3 border-white/8 hover:border-white/20'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${
                dteEnvironment === 'production' ? 'bg-[#34D399]' : 'bg-white/20'
              }`} />
              <span className="text-white font-semibold text-sm">Producción</span>
            </div>
            <p className="text-white/40 text-xs text-left">
              Ambiente real del SII (palena.sii.cl, api.sii.cl, rahue.sii.cl)
            </p>
          </button>
        </div>

        {dteEnvironment === 'production' && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertCircle size={14} className="text-amber-300 shrink-0 mt-0.5" />
            <p className="text-amber-200 text-xs">
              <strong>Producción:</strong> Los documentos emitidos tienen validez legal y se reportan al SII.
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Emitidas"    value={totals.count.toString()}    icon={<FileText size={14} />} />
        <StatCard label="Aceptadas SII" value={totals.accepted.toString()} icon={<CheckCircle2 size={14} className="text-emerald-400" />} />
        <StatCard label="Facturado"   value={fmtCLP(totals.gross)}       icon={<ShieldCheck size={14} />} />
      </div>

      {/* Folio counters — 10.2 */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-[#FF6B35]" />
          <p className="text-white font-semibold text-sm">Folios disponibles</p>
        </div>

        {folios === null ? (
          <p className="text-white/30 text-xs">No se pudieron cargar los folios.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {([33, 39, 41, 56, 61] as const).map(docType => (
              <FolioCounter
                key={docType}
                label={DOC_TYPE_LABEL[docType]}
                count={folios[docType]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Credential card */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-[#FF6B35]" />
            <p className="text-white font-semibold text-sm">Certificado SII</p>
          </div>
          <button
            onClick={() => {
              setShowUpload(v => !v)
              setError(null) // Clear error when toggling
            }}
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
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
                <AlertCircle size={13} className="text-red-300 shrink-0 mt-0.5" />
                <p className="text-red-200 text-xs">{error}</p>
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium">Archivo .pfx / .p12</label>
              <input
                type="file"
                accept=".pfx,.p12"
                onChange={e => {
                  setCertFile(e.target.files?.[0] ?? null)
                  setError(null) // Clear error when selecting file
                }}
                className="block w-full text-xs text-white/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#FF6B35]/20 file:text-[#FF6B35] file:text-xs file:font-semibold hover:file:bg-[#FF6B35]/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium">Contraseña del certificado</label>
              <input
                type="password"
                value={certPassword}
                onChange={e => {
                  setCertPassword(e.target.value)
                  setError(null) // Clear error when typing password
                }}
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

      {/* CAF upload form — 10.3 */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Upload size={15} className="text-[#FF6B35]" />
          <p className="text-white font-semibold text-sm">CAFs</p>
        </div>
        <p className="text-white/40 text-xs">
          Sube los archivos CAF (XML) emitidos por el SII para autorizar folios por tipo de documento.
        </p>

        {!credential ? (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertCircle size={13} className="text-amber-300 shrink-0 mt-0.5" />
            <p className="text-amber-200 text-xs">
              Debes subir un certificado SII antes de cargar archivos CAF
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-white/40 text-xs font-medium">Archivo CAF (.xml)</label>
              <input
                ref={cafFileRef}
                type="file"
                accept=".xml"
                onChange={e => { setCafFile(e.target.files?.[0] ?? null); setCafError(null) }}
                className="block w-full text-xs text-white/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#FF6B35]/20 file:text-[#FF6B35] file:text-xs file:font-semibold hover:file:bg-[#FF6B35]/30"
              />
            </div>

            {cafError && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
                <AlertCircle size={13} className="text-red-300 shrink-0 mt-0.5" />
                <p className="text-red-200 text-xs">{cafError}</p>
              </div>
            )}

            <button
              onClick={handleCafUpload}
              disabled={!cafFile || cafUploading}
              className="w-full py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {cafUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {cafUploading ? 'Subiendo CAF…' : 'Subir CAF'}
            </button>
          </div>
        )}
      </div>

      {/* Emissions list — 10.4 */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-white font-semibold text-sm">Últimas emisiones</p>
            {emissions.some(e => e.status === 'sent') && (
              <span className="flex items-center gap-1 text-[10px] text-[#FF6B35]/70 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] inline-block" />
                Auto-actualizando
              </span>
            )}
          </div>
          <button
            onClick={() => batchPoll(false)}
            disabled={autoPolling}
            title="Actualizar estados ahora"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} className={autoPolling ? 'animate-spin' : ''} />
            {autoPolling ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {emissions.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Aún no has emitido documentos"
            description="Cuando emitas boletas o facturas, aparecerán acá con su estado en el SII"
          />
        ) : (
          <div className="divide-y divide-white/5">
            {/* Filter buttons */}
            <div className="px-5 py-2 flex flex-wrap gap-2 border-b border-white/5">
              {[null, 33, 56, 61, 39, 41].map(type => (
                <button
                  key={type ?? 'all'}
                  onClick={() => setFilterDocType(type)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    filterDocType === type
                      ? 'bg-[#FF6B35] text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {type === null ? 'Todos' : DOC_TYPE_LABEL[type] ?? `Tipo ${type}`}
                </button>
              ))}
            </div>

            {/* Table header */}
            <div className="px-5 py-2 hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center">
              <span className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">Tipo / Folio</span>
              <span className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">RUT receptor</span>
              <span className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">Monto</span>
              <span className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">Fecha</span>
              <span className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">Estado</span>
            </div>

            {(() => {
              const filteredEmissions = filterDocType === null
                ? emissions
                : emissions.filter(e => e.document_type === filterDocType)
              return filteredEmissions
            })().map(em => {
              const style    = STATUS_STYLE[em.status] ?? STATUS_STYLE.draft
              const hasDetail = em.status === 'rejected' || (em.error_detail !== null && em.error_detail !== '')
              const isSent   = em.status === 'sent'
              const expanded = expandedRows.has(em.id)
              const polling  = pollingRows.has(em.id)

              const relatedDocs = em.document_type === 33
                ? emissions.filter(e =>
                    (e.document_type === 56 || e.document_type === 61) &&
                    (e as any).folio_ref === em.folio
                  )
                : []

              return (
                <div key={em.id}>
                  <div
                    className={`px-5 py-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 sm:gap-4 items-center ${hasDetail ? 'cursor-pointer hover:bg-white/2' : ''}`}
                    onClick={hasDetail ? () => toggleRow(em.id) : undefined}
                    role={hasDetail ? 'button' : undefined}
                    aria-expanded={hasDetail ? expanded : undefined}
                  >
                    {/* Tipo / Folio */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-semibold">
                          {DOC_TYPE_LABEL[em.document_type] ?? `Tipo ${em.document_type}`} #{em.folio}
                        </span>
                        {em.razon_receptor && (
                          <span className="text-white/40 text-xs truncate">· {em.razon_receptor}</span>
                        )}
                      </div>
                    </div>

                    {/* RUT receptor */}
                    <span className="text-white/50 text-xs font-mono shrink-0">
                      {em.rut_receptor ?? '—'}
                    </span>

                    {/* Monto */}
                    <p className="text-white font-mono text-sm shrink-0">{fmtCLP(em.total_amount)}</p>

                    {/* Fecha */}
                    <p className="text-white/30 text-[11px] shrink-0">
                      {new Date(em.emitted_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>

                    {/* Estado + acción */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge tone={style.tone} icon={style.icon} label={style.label} />
                      {/* AEC badge for types 33, 56, 61 */}
                      {(em.document_type === 33 || em.document_type === 56 || em.document_type === 61) && (
                        <AecBadge status={em.aec_status} emittedAt={em.emitted_at} />
                      )}
                      {/* Detail button — always visible */}
                      <button
                        onClick={e => { e.stopPropagation(); setDetailEmission(em) }}
                        title="Ver detalle"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                      >
                        <Eye size={11} />
                      </button>
                      {isSent && (
                        <button
                          onClick={e => { e.stopPropagation(); pollStatus(em.id) }}
                          disabled={polling}
                          title="Consultar estado en el SII"
                          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[10px] font-semibold transition-colors disabled:opacity-40 flex items-center gap-1"
                        >
                          {polling
                            ? <Loader2 size={10} className="animate-spin" />
                            : <Clock size={10} />}
                          {polling ? 'Consultando…' : 'Consultar SII'}
                        </button>
                      )}
                      {hasDetail && (
                        expanded
                          ? <ChevronUp size={12} className="text-white/30" />
                          : <ChevronDown size={12} className="text-white/30" />
                      )}
                    </div>
                  </div>

                  {/* Expandable detail row */}
                  {hasDetail && expanded && (
                    <div className="px-5 pb-3">
                      <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                        <p className="text-red-300 text-[11px] font-semibold mb-1">Motivo del rechazo</p>
                        <p className="text-red-200/80 text-xs break-words">
                          {em.error_detail ?? 'Sin detalle disponible.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Related documents (notas de crédito/débito) */}
                  {em.document_type === 33 && relatedDocs.length > 0 && (
                    <div className="px-5 pb-3">
                      <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl px-4 py-3">
                        <p className="text-blue-300 text-[11px] font-semibold mb-2">
                          Documentos relacionados ({relatedDocs.length})
                        </p>
                        <div className="space-y-1">
                          {relatedDocs.map(rd => (
                            <div key={rd.id} className="flex items-center justify-between text-xs">
                              <span className="text-blue-200/70">
                                {DOC_TYPE_LABEL[rd.document_type]} #{rd.folio}
                              </span>
                              <span className="text-blue-200/50">{fmtCLP(rd.total_amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailEmission && (
        <EmissionDetailModal
          emission={detailEmission}
          onClose={() => setDetailEmission(null)}
        />
      )}

      {/* ── Facturas recibidas de proveedores ─────────────────────────── */}
      <div className="bg-[#161622] border border-white/5 rounded-2xl">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox size={15} className="text-[#FF6B35]" />
            <p className="text-white font-semibold text-sm">Facturas recibidas</p>
            {incomingInvoices.filter(i => i.reception_status === 'pendiente').length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                {incomingInvoices.filter(i => i.reception_status === 'pendiente').length} pendientes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowAddIncoming(v => !v); setIncomingFormError(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF6B35]/20 hover:bg-[#FF6B35]/30 text-[#FF6B35] text-xs font-semibold transition-colors"
            >
              <Plus size={11} />
              Registrar
            </button>
            <button
              onClick={() => restaurant && fetchIncomingInvoices(restaurant.id, incomingFilter)}
              disabled={incomingLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs transition-colors disabled:opacity-40"
            >
              <RefreshCw size={11} className={incomingLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Formulario de registro manual */}
        {showAddIncoming && (
          <div className="p-5 border-b border-white/5 space-y-3">
            <p className="text-white/60 text-xs font-semibold">Registrar factura recibida</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* RUT emisor con autocompletado */}
              <div className="space-y-1 sm:col-span-2" ref={proveedorSuggestRef}>
                <label className="text-white/40 text-[11px]">RUT emisor *</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="77042148-9"
                    value={incomingForm.rut_emisor}
                    onChange={e => handleProveedorRutChange(e.target.value)}
                    onFocus={() => proveedorSuggestions.length > 0 && setShowProveedorSuggestions(true)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50 pr-8"
                  />
                  {loadingProveedorSuggest && (
                    <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 animate-spin" />
                  )}

                  {/* Dropdown sugerencias */}
                  {showProveedorSuggestions && proveedorSuggestions.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-[#1a1a2e] border border-white/15 rounded-xl shadow-xl overflow-hidden">
                      {proveedorSuggestions.map(p => (
                        <button
                          key={p.rut}
                          type="button"
                          onMouseDown={() => applyProveedorSuggestion(p)}
                          className="w-full px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-white text-xs font-semibold truncate">{p.razon_social}</p>
                              <p className="text-white/40 text-[10px] font-mono">{p.rut}</p>
                              {p.giro && <p className="text-white/30 text-[10px] truncate">{p.giro}</p>}
                            </div>
                            <span className="text-white/20 text-[10px] shrink-0">
                              {p.facturas_emitidas} reg.
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-white/40 text-[11px]">Razón social *</label>
                <input
                  type="text"
                  placeholder="Proveedor S.A."
                  value={incomingForm.razon_emisor}
                  onChange={e => setIncomingForm(f => ({ ...f, razon_emisor: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-white/40 text-[11px]">Giro</label>
                <input
                  type="text"
                  placeholder="Venta al por mayor"
                  value={incomingForm.giro_emisor}
                  onChange={e => setIncomingForm(f => ({ ...f, giro_emisor: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-white/40 text-[11px]">Email emisor</label>
                <input
                  type="email"
                  placeholder="proveedor@empresa.cl"
                  value={incomingForm.email_emisor}
                  onChange={e => setIncomingForm(f => ({ ...f, email_emisor: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-white/40 text-[11px]">Folio *</label>
                <input
                  type="number"
                  placeholder="123"
                  value={incomingForm.folio}
                  onChange={e => setIncomingForm(f => ({ ...f, folio: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-white/40 text-[11px]">Fecha emisión *</label>
                <input
                  type="date"
                  value={incomingForm.fecha_emision}
                  onChange={e => setIncomingForm(f => ({ ...f, fecha_emision: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-white/40 text-[11px]">Monto total (CLP) *</label>
                <input
                  type="number"
                  placeholder="119000"
                  value={incomingForm.total_amount}
                  onChange={e => setIncomingForm(f => ({ ...f, total_amount: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-white/40 text-[11px]">Neto (CLP)</label>
                <input
                  type="number"
                  placeholder="100000"
                  value={incomingForm.net_amount}
                  onChange={e => setIncomingForm(f => ({ ...f, net_amount: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#FF6B35]/50"
                />
              </div>
            </div>

            {incomingFormError && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
                <AlertCircle size={13} className="text-red-300 shrink-0 mt-0.5" />
                <p className="text-red-200 text-xs">{incomingFormError}</p>
              </div>
            )}

            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => { setShowAddIncoming(false); setIncomingForm(defaultIncomingForm()); setIncomingFormError(null) }}
                className="px-4 py-2 rounded-xl bg-white/5 text-white/60 text-xs font-semibold hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddIncoming}
                disabled={incomingFormSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-xs font-semibold hover:bg-[#e85d2a] disabled:opacity-40 transition-colors"
              >
                {incomingFormSaving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {incomingFormSaving ? 'Guardando…' : 'Registrar factura'}
              </button>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="px-5 py-2 flex flex-wrap gap-2 border-b border-white/5">
          {[null, 'pendiente', 'aceptado', 'rechazado', 'reclamado'].map(s => (
            <button
              key={s ?? 'all'}
              onClick={() => {
                setIncomingFilter(s)
                if (restaurant) fetchIncomingInvoices(restaurant.id, s)
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                incomingFilter === s
                  ? 'bg-[#FF6B35] text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {s === null ? 'Todas' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Lista */}
        {incomingLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="text-[#FF6B35] animate-spin" />
          </div>
        ) : incomingInvoices.length === 0 ? (
          <div className="py-10 text-center">
            <Inbox size={28} className="text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No hay facturas recibidas</p>
            <p className="text-white/20 text-xs mt-1">
              Registra manualmente las facturas de tus proveedores para gestionarlas aquí
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {incomingInvoices.map(inv => (
              <IncomingInvoiceRow
                key={inv.id}
                invoice={inv}
                processing={processingIncoming === inv.id}
                onAction={handleIncomingAction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * AEC status badge — shows the acuse de recibo state for facturas (types 33, 56, 61).
 * Requirements 8.4, 8.5, 10.4
 */
function AecBadge({ status, emittedAt }: { status: string | null; emittedAt: string }) {
  const isOverdue = status === 'pendiente' &&
    (Date.now() - new Date(emittedAt).getTime()) > 8 * 24 * 60 * 60 * 1000

  const config: Record<string, { color: string; label: string }> = {
    pendiente:  { color: '#9CA3AF', label: 'AEC Pendiente' },
    aceptado:   { color: '#34D399', label: 'AEC Aceptado' },
    rechazado:  { color: '#F87171', label: 'AEC Rechazado' },
    reclamado:  { color: '#FB923C', label: 'AEC Reclamado' },
  }

  const cfg = config[status ?? 'pendiente'] ?? config.pendiente

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isOverdue ? 'animate-pulse' : ''}`}
      style={{ color: cfg.color, backgroundColor: `${cfg.color}1a`, borderColor: `${cfg.color}40` }}
      title={isOverdue ? 'Plazo de acuse de recibo próximo a vencer' : undefined}
    >
      {isOverdue && '⚠ '}
      {cfg.label}
    </span>
  )
}

/**
 * Environment badge — shows Certificación (amber) or Producción (green).
 * Requirement 6.8
 */
function EnvironmentBadge({ environment }: { environment: string | null }) {
  if (!environment) return null

  const isProd = environment === 'production' || environment === 'produccion'

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border"
      style={
        isProd
          ? { color: '#34D399', backgroundColor: '#34D3991a', borderColor: '#34D39940' }
          : { color: '#FBBF24', backgroundColor: '#FBBF241a', borderColor: '#FBBF2440' }
      }
    >
      <Globe size={9} strokeWidth={2.5} />
      {isProd ? 'Producción' : 'Certificación'}
    </span>
  )
}

/**
 * Folio counter card — applies color coding based on count thresholds.
 * Requirements 6.1, 6.2, 6.3
 */
function FolioCounter({ label, count }: { label: string; count: number }) {
  const isCritical = count < 10
  const isWarning  = count < 50 && !isCritical

  const color = isCritical ? '#F87171' : isWarning ? '#FBBF24' : '#34D399'

  return (
    <div
      className="rounded-xl p-4 border space-y-1"
      style={{ backgroundColor: `${color}0d`, borderColor: `${color}30` }}
    >
      <p className="text-white/50 text-[11px] font-medium">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{count}</p>
      <p className="text-[10px]" style={{ color: `${color}cc` }}>
        {isCritical
          ? '⚠ Acción requerida — folios casi agotados'
          : isWarning
          ? 'Stock bajo — solicita nuevos CAFs pronto'
          : 'Folios disponibles'}
      </p>
    </div>
  )
}

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

// ── EmissionDetailModal ───────────────────────────────────────────────────────

function EmissionDetailModal({ emission, onClose }: { emission: Emission; onClose: () => void }) {
  const style = STATUS_STYLE[emission.status] ?? STATUS_STYLE.draft

  function downloadXml() {
    if (!emission.xml_signed) return
    const blob = new Blob([emission.xml_signed], { type: 'application/xml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `boleta_${emission.folio ?? 'sin_folio'}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#161622] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-[#FF6B35]" />
            <p className="text-white font-semibold text-sm">
              {DOC_TYPE_LABEL[emission.document_type] ?? `Tipo ${emission.document_type}`}
              {emission.folio ? ` #${emission.folio}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-white/40 text-xs">Estado</span>
            <StatusBadge tone={style.tone} icon={style.icon} label={style.label} />
          </div>

          {/* Fields */}
          <div className="space-y-2 text-xs">
            <DetailRow label="Folio"        value={emission.folio?.toString() ?? '—'} />
            <DetailRow label="Monto total"  value={fmtCLP(emission.total_amount)} />
            <DetailRow label="Neto"         value={fmtCLP(emission.net_amount)} />
            <DetailRow label="IVA"          value={fmtCLP(emission.iva_amount)} />
            {emission.rut_receptor && (
              <DetailRow label="RUT receptor" value={emission.rut_receptor} />
            )}
            {emission.razon_receptor && (
              <DetailRow label="Receptor"   value={emission.razon_receptor} />
            )}
            {emission.sii_track_id && (
              <DetailRow label="Track ID"   value={emission.sii_track_id} mono />
            )}
            <DetailRow
              label="Fecha"
              value={new Date(emission.emitted_at).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}
            />
          </div>

          {/* Error detail */}
          {emission.error_detail && (
            <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-red-300 text-[11px] font-semibold mb-1">Error</p>
              <p className="text-red-200/80 text-xs break-words">{emission.error_detail}</p>
            </div>
          )}

          {/* XML preview */}
          {emission.xml_signed && (
            <div className="space-y-2">
              <p className="text-white/40 text-[11px] font-semibold uppercase tracking-wide">XML firmado</p>
              <pre className="bg-black/30 border border-white/5 rounded-xl p-3 text-[10px] text-white/50 overflow-auto max-h-40 font-mono leading-relaxed">
                {emission.xml_signed.slice(0, 800)}{emission.xml_signed.length > 800 ? '\n…' : ''}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5 flex items-center justify-end gap-2">
          {emission.xml_signed && (
            <button
              onClick={downloadXml}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-semibold transition-colors"
            >
              <Download size={12} />
              Descargar XML
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#FF6B35] text-white text-xs font-semibold hover:bg-[#e85d2a] transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-white/30 shrink-0">{label}</span>
      <span className={`text-white/70 text-right break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

// ── IncomingInvoiceRow ────────────────────────────────────────────────────────

const INCOMING_STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  pendiente: { color: '#9CA3AF', label: 'Pendiente',  icon: <Clock size={10} /> },
  aceptado:  { color: '#34D399', label: 'Aceptada',   icon: <CheckCircle2 size={10} /> },
  rechazado: { color: '#F87171', label: 'Rechazada',  icon: <XCircle size={10} /> },
  reclamado: { color: '#FB923C', label: 'Reclamada',  icon: <AlertCircle size={10} /> },
}

function IncomingInvoiceRow({
  invoice,
  processing,
  onAction,
}: {
  invoice:    IncomingInvoice
  processing: boolean
  onAction:   (id: string, action: 'aceptado' | 'rechazado' | 'reclamado', glosa?: string) => void
}) {
  const [expanded,    setExpanded]    = useState(false)
  const [rejectGlosa, setRejectGlosa] = useState('')
  const [showReject,  setShowReject]  = useState(false)

  const cfg = INCOMING_STATUS_CONFIG[invoice.reception_status] ?? INCOMING_STATUS_CONFIG.pendiente
  const isPending = invoice.reception_status === 'pendiente'

  return (
    <div>
      <div
        className="px-5 py-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 sm:gap-4 items-center cursor-pointer hover:bg-white/2"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Emisor / Folio */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white text-sm font-semibold">
              Factura #{invoice.folio}
            </span>
            <span className="text-white/40 text-xs truncate">· {invoice.razon_emisor}</span>
            {invoice.vencido && (
              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[9px] font-bold">
                PLAZO VENCIDO
              </span>
            )}
            {isPending && !invoice.vencido && invoice.dias_restantes <= 3 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                {invoice.dias_restantes}d restantes
              </span>
            )}
          </div>
          <p className="text-white/30 text-[11px] mt-0.5 font-mono">{invoice.rut_emisor}</p>
        </div>

        {/* Monto */}
        <p className="text-white font-mono text-sm shrink-0">{fmtCLP(invoice.total_amount)}</p>

        {/* Fecha */}
        <p className="text-white/30 text-[11px] shrink-0">
          {new Date(invoice.fecha_emision).toLocaleDateString('es-CL')}
        </p>

        {/* Estado */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
            style={{ color: cfg.color, backgroundColor: `${cfg.color}1a`, borderColor: `${cfg.color}40` }}
          >
            {cfg.icon}
            {cfg.label}
          </span>
          {expanded ? <ChevronUp size={12} className="text-white/30" /> : <ChevronDown size={12} className="text-white/30" />}
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div className="px-5 pb-4 space-y-3">
          <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2 text-xs">
            <DetailRow label="RUT emisor"    value={invoice.rut_emisor} mono />
            <DetailRow label="Razón social"  value={invoice.razon_emisor} />
            {invoice.giro_emisor && <DetailRow label="Giro"         value={invoice.giro_emisor} />}
            {invoice.email_emisor && <DetailRow label="Email"        value={invoice.email_emisor} />}
            <DetailRow label="Folio"         value={invoice.folio.toString()} />
            <DetailRow label="Fecha emisión" value={new Date(invoice.fecha_emision).toLocaleDateString('es-CL')} />
            <DetailRow label="Total"         value={fmtCLP(invoice.total_amount)} />
            {invoice.net_amount != null && <DetailRow label="Neto"  value={fmtCLP(invoice.net_amount)} />}
            {invoice.iva_amount != null && <DetailRow label="IVA"   value={fmtCLP(invoice.iva_amount)} />}
            <DetailRow label="Recibida"      value={new Date(invoice.received_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })} />
            {invoice.reception_date && (
              <DetailRow
                label={`Fecha ${invoice.reception_status}`}
                value={new Date(invoice.reception_date).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
              />
            )}
            {invoice.reception_glosa && (
              <DetailRow label="Motivo" value={invoice.reception_glosa} />
            )}
            {isPending && !invoice.vencido && (
              <p className="text-amber-300/70 text-[10px] pt-1">
                ⏱ Plazo legal: {invoice.dias_restantes} día{invoice.dias_restantes !== 1 ? 's' : ''} restante{invoice.dias_restantes !== 1 ? 's' : ''} para aceptar o rechazar
              </p>
            )}
          </div>

          {/* Acciones — solo si está pendiente */}
          {isPending && (
            <div className="space-y-2">
              {showReject ? (
                <div className="space-y-2">
                  <textarea
                    placeholder="Motivo del rechazo (obligatorio para rechazar)"
                    value={rejectGlosa}
                    onChange={e => setRejectGlosa(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-red-500/50 resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowReject(false)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs hover:bg-white/10 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => onAction(invoice.id, 'rechazado', rejectGlosa)}
                      disabled={processing || !rejectGlosa.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/30 disabled:opacity-40 transition-colors"
                    >
                      {processing ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
                      Confirmar rechazo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => onAction(invoice.id, 'aceptado')}
                    disabled={processing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 disabled:opacity-40 transition-colors"
                  >
                    {processing ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                    Aceptar
                  </button>
                  {!invoice.vencido && (
                    <button
                      onClick={() => setShowReject(true)}
                      disabled={processing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/30 disabled:opacity-40 transition-colors"
                    >
                      <XCircle size={10} />
                      Rechazar
                    </button>
                  )}
                  <button
                    onClick={() => onAction(invoice.id, 'reclamado', 'Reclamo comercial')}
                    disabled={processing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 disabled:opacity-40 transition-colors"
                  >
                    <AlertCircle size={10} />
                    Reclamar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
