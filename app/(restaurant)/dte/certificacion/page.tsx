'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import {
  FileText, Upload, Loader2, AlertCircle, CheckCircle2,
  XCircle, Clock, ShieldCheck, RefreshCw, Trash2
} from 'lucide-react'
import { StatusBadge, type Tone } from '@/components/ui/StatusBadge'

// ── Types ────────────────────────────────────────────────────────────────────

interface TestSet {
  id: string
  attention_number: string
  set_type: string
  file_name: string
  case_count: number
  generated_count: number
  submitted_count: number
  approved_count: number
  status: string
  track_id: string | null
  created_at: string
  document_types: Record<number, number>
  status_breakdown: Record<string, number>
}

interface ValidationError {
  field: string
  message: string
}

const DOC_TYPE_LABEL: Record<number, string> = {
  33: 'Factura',
  34: 'Factura Exenta',
  39: 'Boleta',
  41: 'Boleta Exenta',
  43: 'Liquidación',
  46: 'Factura de Compra',
  52: 'Guía de Despacho',
  56: 'Nota de Débito',
  61: 'Nota de Crédito',
  110: 'Factura de Exportación',
  111: 'Nota de Débito de Exportación',
  112: 'Nota de Crédito de Exportación',
}

const STATUS_STYLE: Record<string, { tone: Tone; label: string }> = {
  uploaded:   { tone: 'neutral', label: 'Subido' },
  generated:  { tone: 'info',    label: 'Generado' },
  submitted:  { tone: 'info',    label: 'Enviado' },
  approved:   { tone: 'success', label: 'Aprobado' },
  rejected:   { tone: 'danger',  label: 'Rechazado' },
  deleted:    { tone: 'neutral', label: 'Eliminado' },
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CertificationPage() {
  const { restaurant } = useRestaurant()

  const [testSets,        setTestSets]        = useState<TestSet[]>([])
  const [loading,         setLoading]         = useState(true)
  const [uploading,       setUploading]       = useState(false)
  const [generating,      setGenerating]      = useState<string | null>(null)
  const [submitting,      setSubmitting]      = useState<string | null>(null)
  const [checking,        setChecking]        = useState<string | null>(null)
  const [deleting,        setDeleting]        = useState<string | null>(null)
  const [error,           setError]           = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  
  // File upload
  const [selectedFile,    setSelectedFile]    = useState<File | null>(null)
  const [expandedSet,     setExpandedSet]     = useState<string | null>(null)

  // ── Fetch test sets ────────────────────────────────────────────────────────

  const fetchTestSets = useCallback(async () => {
    if (!restaurant) return
    setLoading(true)
    try {
      const res = await fetch(`/api/dte/certification/sets?restaurant_id=${restaurant.id}`)
      const data = await res.json()
      if (res.ok) {
        setTestSets(data.test_sets ?? [])
      } else {
        setError(data.error ?? 'Error al cargar los sets de prueba')
      }
    } catch {
      setError('Error de red al cargar los sets de prueba')
    } finally {
      setLoading(false)
    }
  }, [restaurant])

  useEffect(() => {
    fetchTestSets()
  }, [fetchTestSets])

  // ── Upload file ────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!restaurant || !selectedFile) return
    setUploading(true)
    setError(null)
    setValidationErrors([])
    
    try {
      const fileContent = await selectedFile.text()
      
      const res = await fetch('/api/dte/certification/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          file_content: fileContent,
          file_name: selectedFile.name,
        }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error ?? 'Error al subir el archivo')
        return
      }
      
      // Success - refresh list and reset form
      setSelectedFile(null)
      await fetchTestSets()
      
    } catch (err) {
      setError('Error al procesar el archivo')
    } finally {
      setUploading(false)
    }
  }

  // ── Generate DTEs ──────────────────────────────────────────────────────────

  async function handleGenerate(testSetId: string) {
    if (!restaurant) return
    setGenerating(testSetId)
    setError(null)
    setValidationErrors([])
    
    try {
      const res = await fetch('/api/dte/certification/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          test_set_id: testSetId,
        }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        if (data.validation_errors) {
          setValidationErrors(data.validation_errors.map((msg: string) => ({ field: 'general', message: msg })))
        } else {
          setError(data.error ?? 'Error al generar los DTEs')
        }
        return
      }
      
      // Success - refresh list
      await fetchTestSets()
      
    } catch {
      setError('Error de red al generar los DTEs')
    } finally {
      setGenerating(null)
    }
  }

  // ── Submit to SII ──────────────────────────────────────────────────────────

  async function handleSubmit(testSetId: string) {
    if (!restaurant) return
    setSubmitting(testSetId)
    setError(null)
    
    try {
      const res = await fetch('/api/dte/certification/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          test_set_id: testSetId,
        }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error ?? 'Error al enviar al SII')
        return
      }
      
      // Success - refresh list
      await fetchTestSets()
      
    } catch {
      setError('Error de red al enviar al SII')
    } finally {
      setSubmitting(null)
    }
  }

  // ── Check status ───────────────────────────────────────────────────────────

  async function handleCheckStatus(testSetId: string, trackId: string) {
    if (!restaurant) return
    setChecking(testSetId)
    setError(null)
    
    try {
      const res = await fetch(
        `/api/dte/certification/status?restaurant_id=${restaurant.id}&track_id=${trackId}`
      )
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error ?? 'Error al consultar el estado')
        return
      }
      
      // Success - refresh list to show updated status
      await fetchTestSets()
      
    } catch {
      setError('Error de red al consultar el estado')
    } finally {
      setChecking(null)
    }
  }

  // ── Delete test set ────────────────────────────────────────────────────────

  async function handleDelete(testSetId: string) {
    if (!restaurant) return
    if (!confirm('¿Estás seguro de eliminar este set de pruebas?')) return
    
    setDeleting(testSetId)
    setError(null)
    
    try {
      const res = await fetch(
        `/api/dte/certification/sets/${testSetId}?restaurant_id=${restaurant.id}`,
        { method: 'DELETE' }
      )
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error ?? 'Error al eliminar el set')
        return
      }
      
      // Success - refresh list
      await fetchTestSets()
      
    } catch {
      setError('Error de red al eliminar el set')
    } finally {
      setDeleting(null)
    }
  }

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
    <div className="p-6 space-y-4 max-w-5xl">
      
      {/* Header */}
      <div>
        <h1 className="text-white text-xl font-bold flex items-center gap-2">
          <ShieldCheck size={20} className="text-[#FF6B35]" />
          Certificación DTE con el SII
        </h1>
        <p className="text-white/40 text-sm mt-0.5">
          Sube archivos de prueba del SII, genera y envía DTEs para certificación
        </p>
      </div>

      {/* Error messages */}
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle size={14} className="text-red-300 shrink-0 mt-0.5" />
          <p className="text-red-200 text-xs">{error}</p>
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="space-y-2">
          {validationErrors.map((err, idx) => (
            <div key={idx} className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <AlertCircle size={14} className="text-amber-300 shrink-0 mt-0.5" />
              <p className="text-amber-200 text-xs">{err.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Upload section */}
      <div className="bg-[#0f0f1a] border border-white/5 rounded-xl p-4 space-y-3">
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
          Subir archivo de prueba del SII
        </p>
        
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".txt"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="flex-1 text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#FF6B35] file:text-white hover:file:bg-[#FF8A5B] file:cursor-pointer"
          />
          
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="px-4 py-2 rounded-lg bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#FF8A5B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload size={14} />
                Subir
              </>
            )}
          </button>
        </div>
        
        <p className="text-white/30 text-xs">
          Sube el archivo SET_DE_PRUEBAS.txt proporcionado por el SII
        </p>
      </div>

      {/* Test sets list */}
      <div className="space-y-3">
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
          Sets de prueba ({testSets.length})
        </p>
        
        {testSets.length === 0 ? (
          <div className="bg-white/3 border border-white/8 rounded-xl p-8 text-center">
            <FileText size={32} className="text-white/20 mx-auto mb-3" />
            <p className="text-white/50 text-sm">No hay sets de prueba subidos</p>
            <p className="text-white/30 text-xs mt-1">
              Sube un archivo del SII para comenzar
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {testSets.map((set) => (
              <div
                key={set.id}
                className="bg-[#0f0f1a] border border-white/5 rounded-xl p-4 space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold text-sm">
                        Atención #{set.attention_number}
                      </h3>
                      <StatusBadge
                        tone={STATUS_STYLE[set.status]?.tone ?? 'neutral'}
                        label={STATUS_STYLE[set.status]?.label ?? set.status}
                      />
                    </div>
                    <p className="text-white/40 text-xs">
                      {set.file_name} • {set.case_count} casos • {set.set_type}
                    </p>
                    <p className="text-white/30 text-xs mt-1">
                      Subido: {new Date(set.created_at).toLocaleString('es-CL')}
                    </p>
                  </div>
                </div>

                {/* Document types breakdown */}
                {Object.keys(set.document_types).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(set.document_types).map(([docType, count]) => (
                      <span
                        key={docType}
                        className="px-2 py-1 rounded-lg bg-white/5 text-white/60 text-xs"
                      >
                        {DOC_TYPE_LABEL[Number(docType)] ?? `Tipo ${docType}`}: {count}
                      </span>
                    ))}
                  </div>
                )}

                {/* Progress */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-white/40">Generados</p>
                    <p className="text-white font-semibold">
                      {set.generated_count} / {set.case_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/40">Enviados</p>
                    <p className="text-white font-semibold">
                      {set.submitted_count} / {set.case_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/40">Aprobados</p>
                    <p className="text-white font-semibold">
                      {set.approved_count} / {set.case_count}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  {set.status === 'uploaded' && (
                    <button
                      onClick={() => handleGenerate(set.id)}
                      disabled={generating === set.id}
                      className="px-3 py-1.5 rounded-lg bg-[#FF6B35] text-white text-xs font-semibold hover:bg-[#FF8A5B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {generating === set.id ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>
                          <FileText size={12} />
                          Generar DTEs
                        </>
                      )}
                    </button>
                  )}

                  {set.status === 'generated' && (
                    <button
                      onClick={() => handleSubmit(set.id)}
                      disabled={submitting === set.id}
                      className="px-3 py-1.5 rounded-lg bg-[#FF6B35] text-white text-xs font-semibold hover:bg-[#FF8A5B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {submitting === set.id ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload size={12} />
                          Enviar al SII
                        </>
                      )}
                    </button>
                  )}

                  {set.status === 'submitted' && set.track_id && (
                    <button
                      onClick={() => handleCheckStatus(set.id, set.track_id!)}
                      disabled={checking === set.id}
                      className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {checking === set.id ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Consultando...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={12} />
                          Consultar Estado
                        </>
                      )}
                    </button>
                  )}

                  {set.status !== 'deleted' && (
                    <button
                      onClick={() => handleDelete(set.id)}
                      disabled={deleting === set.id}
                      className="ml-auto px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {deleting === set.id ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Eliminando...
                        </>
                      ) : (
                        <>
                          <Trash2 size={12} />
                          Eliminar
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Track ID */}
                {set.track_id && (
                  <div className="text-xs">
                    <span className="text-white/40">Track ID: </span>
                    <span className="text-white/60 font-mono">{set.track_id}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
