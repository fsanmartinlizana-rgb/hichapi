'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { AlertCircle, XCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/i18n'

// ── Types ─────────────────────────────────────────────────────────────────────

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
  giro_receptor:        string | null
  direccion_receptor:   string | null
  comuna_receptor:      string | null
  emitted_at:           string
  order_id:             string | null
}

interface NotaCreditoModalProps {
  open:             boolean
  onClose:          () => void
  originalEmission: Emission
  restaurantId:     string
  onSuccess:        () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotaCreditoModal({
  open,
  onClose,
  originalEmission,
  restaurantId,
  onSuccess,
}: NotaCreditoModalProps) {
  const [razonRef, setRazonRef]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleSubmit() {
    if (!razonRef.trim()) {
      setError('Debes indicar el motivo de la anulación')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/dte/emit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          order_id: originalEmission.order_id,
          document_type: 61,  // Nota de Crédito
          
          // Receptor: usar datos de la boleta original si existen, sino usar genéricos
          rut_receptor:       originalEmission.rut_receptor || '66666666-6',
          razon_receptor:     originalEmission.razon_receptor || 'Sin RUT',
          giro_receptor:      originalEmission.giro_receptor || 'Sin giro',
          direccion_receptor: originalEmission.direccion_receptor || 'Sin dirección',
          comuna_receptor:    originalEmission.comuna_receptor || 'Sin comuna',
          
          // Referencia a la boleta original
          tipo_doc_ref: originalEmission.document_type,  // 39 o 41
          folio_ref:    originalEmission.folio,
          fch_ref:      originalEmission.emitted_at.split('T')[0],  // YYYY-MM-DD
          cod_ref:      1,  // 1 = Anulación
          razon_ref:    razonRef.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Mapear errores comunes a mensajes amigables
        const errorMsg = data.error || 'Error al emitir nota de crédito'
        if (errorMsg.includes('RECEPTOR_RUT_INVALIDO')) {
          setError('El RUT del receptor es inválido')
        } else if (errorMsg.includes('RECEPTOR_DATOS_INCOMPLETOS')) {
          setError('Faltan datos del receptor')
        } else if (errorMsg.includes('REFERENCIA_INCOMPLETA')) {
          setError('Faltan datos de referencia al documento original')
        } else if (errorMsg.includes('NO_CAF_AVAILABLE')) {
          setError('No hay folios disponibles para notas de crédito (tipo 61). Sube un CAF primero.')
        } else if (errorMsg.includes('ORDER_NOT_PAID')) {
          setError('La orden no está en estado pagado')
        } else {
          setError(errorMsg)
        }
        return
      }

      // Éxito
      onSuccess()
      onClose()
      // Reset form
      setRazonRef('')
    } catch (err) {
      setError('Error de red al emitir nota de crédito')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (!saving) {
      setRazonRef('')
      setError(null)
      onClose()
    }
  }

  const docTypeLabel = originalEmission.document_type === 39 
    ? 'Boleta' 
    : originalEmission.document_type === 41 
    ? 'Boleta exenta'
    : 'Documento'

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Anular ${docTypeLabel}`}
      description={`Emitir nota de crédito para anular ${docTypeLabel.toLowerCase()} folio ${originalEmission.folio}`}
      size="sm"
      footer={
        <>
          <button
            onClick={handleClose}
            disabled={saving}
            className="py-2 px-4 rounded-lg border border-white/10 text-gray-400 text-sm hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !razonRef.trim()}
            className="py-2 px-4 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Emitiendo...' : `Anular ${docTypeLabel.toLowerCase()}`}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <AlertCircle size={14} className="text-red-300 shrink-0 mt-0.5" />
          <p className="text-red-200 text-xs">{error}</p>
        </div>
      )}

      {/* Datos de la boleta original */}
      <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10 space-y-2 text-xs">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
          <XCircle size={14} className="text-red-400" />
          <span className="text-white/70 font-semibold">Documento a anular</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/50">Tipo:</span>
          <span className="text-white">{docTypeLabel} (tipo {originalEmission.document_type})</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/50">Folio:</span>
          <span className="text-white font-mono font-semibold">{originalEmission.folio}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/50">Monto:</span>
          <span className="text-white font-bold">{formatCurrency(originalEmission.total_amount)}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/50">Fecha emisión:</span>
          <span className="text-white">
            {new Date(originalEmission.emitted_at).toLocaleDateString('es-CL', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
        </div>
        
        {originalEmission.razon_receptor && originalEmission.razon_receptor !== 'Sin RUT' && (
          <div className="flex justify-between">
            <span className="text-white/50">Receptor:</span>
            <span className="text-white truncate ml-2" title={originalEmission.razon_receptor}>
              {originalEmission.razon_receptor}
            </span>
          </div>
        )}
        
        {originalEmission.rut_receptor && originalEmission.rut_receptor !== '66666666-6' && (
          <div className="flex justify-between">
            <span className="text-white/50">RUT:</span>
            <span className="text-white font-mono">{originalEmission.rut_receptor}</span>
          </div>
        )}
      </div>

      {/* Motivo de anulación */}
      <label className="block text-gray-400 text-sm mb-2">
        Motivo de la anulación <span className="text-red-400">*</span>
      </label>
      <textarea
        value={razonRef}
        onChange={e => setRazonRef(e.target.value)}
        placeholder="Ej: Error en monto, cliente devolvió producto, duplicado, error de digitación..."
        maxLength={90}
        rows={3}
        disabled={saving}
        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 resize-none placeholder:text-white/25 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <p className="text-white/30 text-xs mt-1">
        {razonRef.length}/90 caracteres
      </p>

      {/* Advertencia */}
      <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
        <AlertCircle size={14} className="text-amber-300 shrink-0 mt-0.5" />
        <div className="text-amber-200 text-xs">
          <strong>⚠️ Importante:</strong> Esta acción emitirá una nota de crédito al SII
          y marcará el documento original como anulado. Esta operación no se puede deshacer.
        </div>
      </div>
    </Modal>
  )
}
