'use client'

import { useState } from 'react'
import { X, AlertTriangle, Loader2 } from 'lucide-react'

type CancelReason = 'cliente_cancelo' | 'error_cocina' | 'merma' | 'perdida' | 'otro'

const REASONS: { value: CancelReason; label: string; hint: string }[] = [
  { value: 'cliente_cancelo', label: 'Cliente canceló',       hint: 'El cliente decidió no continuar' },
  { value: 'error_cocina',    label: 'Error en cocina',       hint: 'Se preparó mal o se dañó al servir' },
  { value: 'merma',           label: 'Merma',                 hint: 'Registrar como pérdida de inventario' },
  { value: 'perdida',         label: 'Pérdida',               hint: 'Producto inutilizable' },
  { value: 'otro',            label: 'Otro motivo',           hint: 'Especifica abajo' },
]

export function CancelOrderModal({
  orderId,
  tableLabel,
  onClose,
  onCancelled,
}: {
  orderId: string
  tableLabel?: string
  onClose: () => void
  onCancelled: () => void
}) {
  const [reason, setReason] = useState<CancelReason>('cliente_cancelo')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, reason, notes: notes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo cancelar el pedido')
        return
      }
      onCancelled()
      onClose()
    } catch {
      setError('Sin conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">

        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center text-red-700">
              <AlertTriangle size={16} />
            </div>
            <div>
              <h2 className="text-[var(--text-strong)] font-bold text-base">Cancelar pedido</h2>
              <p className="text-[var(--text-muted)] text-xs mt-0.5">
                {tableLabel ? `Mesa ${tableLabel} · ` : ''}Selecciona el motivo
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-[var(--surface-sunken)] hover:bg-[var(--surface-sunken)] flex items-center justify-center text-[var(--text-muted)]">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <div className="space-y-2">
            {REASONS.map(r => (
              <button
                key={r.value}
                onClick={() => setReason(r.value)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                  reason === r.value
                    ? 'bg-red-500/10 border-red-500/40 text-white'
                    : 'bg-[var(--surface-sunken)] border-[var(--border-subtle)] text-[var(--text-body)] hover:bg-[var(--surface-sunken)]'
                }`}
              >
                <p className="text-sm font-semibold">{r.label}</p>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">{r.hint}</p>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-[var(--text-muted)] text-xs font-medium">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Detalles del motivo…"
              className="w-full px-3 py-2 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] text-sm focus:outline-none focus:border-red-500/40 resize-none"
            />
          </div>

          {(reason === 'merma' || reason === 'perdida') && (
            <div className="px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/25 text-amber-200/80 text-xs">
              Los productos del pedido se registrarán automáticamente en el log de mermas.
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 text-xs">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm hover:border-[var(--border-subtle)] hover:text-[var(--text-body)] transition-colors"
          >
            Volver
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Cancelar pedido
          </button>
        </div>
      </div>
    </div>
  )
}
