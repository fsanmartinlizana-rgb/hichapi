'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { AlertCircle, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/i18n'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Emission {
  id:                   string
  document_type:        number
  folio:                number
  status:               string
  total_amount:         number
  rut_receptor:         string | null
  razon_receptor:       string | null
  giro_receptor:        string | null
  direccion_receptor:   string | null
  comuna_receptor:      string | null
  emitted_at:           string
  order_id:             string | null
}

interface NotaDebitoModalProps {
  open:             boolean
  onClose:          () => void
  originalEmission: Emission
  restaurantId:     string
  onSuccess:        () => void
}

// Códigos de referencia válidos para nota de débito según SII
// 2 = Corrige montos (único válido para ND)
const COD_REF_OPTIONS = [
  { value: 2, label: 'Corrección de monto' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function NotaDebitoModal({
  open,
  onClose,
  originalEmission,
  restaurantId,
  onSuccess,
}: NotaDebitoModalProps) {
  const [razonRef,    setRazonRef]    = useState('')
  const [montoExtra,  setMontoExtra]  = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const codRef = 2 // Única opción válida para Nota de Débito según SII

  const montoExtraNum = parseInt(montoExtra.replace(/\D/g, ''), 10) || 0

  async function handleSubmit() {
    if (!razonRef.trim()) {
      setError('Debes indicar el motivo de la nota de débito')
      return
    }
    if (montoExtraNum <= 0) {
      setError('El monto adicional debe ser mayor a $0')
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
          order_id:      originalEmission.order_id,
          document_type: 56,  // Nota de Débito

          // Receptor: heredar datos de la factura original
          rut_receptor:       originalEmission.rut_receptor,
          razon_receptor:     originalEmission.razon_receptor,
          giro_receptor:      originalEmission.giro_receptor,
          direccion_receptor: originalEmission.direccion_receptor,
          comuna_receptor:    originalEmission.comuna_receptor,

          // Referencia a la factura original
          tipo_doc_ref: originalEmission.document_type,  // 33
          folio_ref:    originalEmission.folio,
          fch_ref:      originalEmission.emitted_at.split('T')[0],  // YYYY-MM-DD
          cod_ref:      codRef,
          razon_ref:    razonRef.trim(),

          // El monto de la ND es solo el diferencial
          items: [
            {
              name:       razonRef.trim().slice(0, 80),
              quantity:   1,
              unit_price: montoExtraNum,
            },
          ],
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const errorMsg = data.error || 'Error al emitir nota de débito'
        if (errorMsg.includes('RECEPTOR_RUT_INVALIDO')) {
          setError('El RUT del receptor es inválido')
        } else if (errorMsg.includes('RECEPTOR_DATOS_INCOMPLETOS')) {
          setError('Faltan datos del receptor en la factura original')
        } else if (errorMsg.includes('REFERENCIA_INCOMPLETA')) {
          setError('Faltan datos de referencia al documento original')
        } else if (errorMsg.includes('NO_CAF_AVAILABLE')) {
          setError('No hay folios disponibles para notas de débito (tipo 56). Sube un CAF primero.')
        } else if (errorMsg.includes('Configuración DTE incompleta')) {
          setError(data.details ?? errorMsg)
        } else {
          setError(errorMsg)
        }
        return
      }

      onSuccess()
      onClose()
      setRazonRef('')
      setMontoExtra('')
    } catch {
      setError('Error de red al emitir nota de débito')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (!saving) {
      setRazonRef('')
      setMontoExtra('')
      setError(null)
      onClose()
    }
  }

  // Formatear input de monto como entero CLP
  function handleMontoChange(val: string) {
    const digits = val.replace(/\D/g, '')
    setMontoExtra(digits)
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Emitir Nota de Débito"
      description={`Cargo adicional sobre Factura #${originalEmission.folio}`}
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
            disabled={saving || !razonRef.trim() || montoExtraNum <= 0}
            className="py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Emitiendo...' : 'Emitir Nota de Débito'}
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

      {/* Datos de la factura original */}
      <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10 space-y-2 text-xs">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
          <TrendingUp size={14} className="text-amber-400" />
          <span className="text-white/70 font-semibold">Factura original</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/50">Folio:</span>
          <span className="text-white font-mono font-semibold">#{originalEmission.folio}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/50">Monto original:</span>
          <span className="text-white font-bold">{formatCurrency(originalEmission.total_amount)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/50">Fecha emisión:</span>
          <span className="text-white">
            {new Date(originalEmission.emitted_at).toLocaleDateString('es-CL', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            })}
          </span>
        </div>

        {originalEmission.razon_receptor && (
          <div className="flex justify-between">
            <span className="text-white/50">Receptor:</span>
            <span className="text-white truncate ml-2" title={originalEmission.razon_receptor}>
              {originalEmission.razon_receptor}
            </span>
          </div>
        )}

        {originalEmission.rut_receptor && (
          <div className="flex justify-between">
            <span className="text-white/50">RUT:</span>
            <span className="text-white font-mono">{originalEmission.rut_receptor}</span>
          </div>
        )}
      </div>

      {/* Tipo de corrección — solo corrección de monto es válida para ND */}

      {/* Monto adicional */}
      <label className="block text-gray-400 text-sm mb-2">
        Monto adicional (CLP) <span className="text-red-400">*</span>
      </label>
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={montoExtra ? parseInt(montoExtra).toLocaleString('es-CL') : ''}
          onChange={e => handleMontoChange(e.target.value)}
          placeholder="0"
          disabled={saving}
          className="w-full bg-black/30 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 placeholder:text-white/25 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Motivo */}
      <label className="block text-gray-400 text-sm mb-2">
        Motivo <span className="text-red-400">*</span>
      </label>
      <textarea
        value={razonRef}
        onChange={e => setRazonRef(e.target.value)}
        placeholder="Ej: Diferencia de precio por ajuste de tarifa, cargo por flete no incluido..."
        maxLength={90}
        rows={3}
        disabled={saving}
        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 resize-none placeholder:text-white/25 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <p className="text-white/30 text-xs mt-1">{razonRef.length}/90 caracteres</p>

      {/* Resumen */}
      {montoExtraNum > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20 space-y-1 text-xs">
          <div className="flex justify-between text-white/50">
            <span>Factura original:</span>
            <span>{formatCurrency(originalEmission.total_amount)}</span>
          </div>
          <div className="flex justify-between text-amber-300">
            <span>Cargo adicional (ND):</span>
            <span>+ {formatCurrency(montoExtraNum)}</span>
          </div>
          <div className="flex justify-between text-white font-bold border-t border-white/10 pt-1 mt-1">
            <span>Total efectivo:</span>
            <span>{formatCurrency(originalEmission.total_amount + montoExtraNum)}</span>
          </div>
        </div>
      )}

      {/* Advertencia */}
      <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
        <AlertCircle size={14} className="text-amber-300 shrink-0 mt-0.5" />
        <div className="text-amber-200 text-xs">
          <strong>⚠️ Importante:</strong> La nota de débito aumenta el monto de la
          factura original. Se emitirá al SII y no se puede deshacer.
        </div>
      </div>
    </Modal>
  )
}
