'use client'

import { useState } from 'react'
import { X, Banknote, CreditCard, Layers } from 'lucide-react'
import { formatCurrency } from '@/lib/i18n'

interface PaymentMethodModalProps {
  orderId:    string
  total:      number
  onConfirm:  (method: 'cash' | 'digital' | 'mixed', cashAmount?: number, digitalAmount?: number) => Promise<void>
  onClose:    () => void
}

const clp = (n: number) => formatCurrency(n)

export function PaymentMethodModal({ orderId: _orderId, total, onConfirm, onClose }: PaymentMethodModalProps) {
  const [method, setMethod]     = useState<'cash' | 'digital' | 'mixed' | null>(null)
  const [cashPart, setCashPart] = useState('')
  const [saving, setSaving]     = useState(false)

  const digitalPart = method === 'mixed' ? Math.max(0, total - (parseInt(cashPart) || 0)) : 0

  async function handleConfirm() {
    if (!method) return
    setSaving(true)
    try {
      if (method === 'cash') {
        await onConfirm('cash', total, 0)
      } else if (method === 'digital') {
        await onConfirm('digital', 0, total)
      } else {
        const cash    = parseInt(cashPart) || 0
        const digital = Math.max(0, total - cash)
        await onConfirm('mixed', cash, digital)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-sm border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold">Método de pago</h3>
            <p className="text-gray-400 text-sm">Total: {clp(total)}</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="space-y-3 mb-4">
          {[
            { id: 'cash'    as const, icon: Banknote,    label: 'Efectivo',          desc: 'Sin comisión HiChapi' },
            { id: 'digital' as const, icon: CreditCard,  label: 'Digital (Stripe)',  desc: '1% comisión HiChapi' },
            { id: 'mixed'   as const, icon: Layers,      label: 'Pago mixto',        desc: 'Parte efectivo + parte digital' },
          ].map(({ id, icon: Icon, label, desc }) => (
            <button
              key={id}
              onClick={() => setMethod(id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                method === id
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${method === id ? 'bg-orange-500/20' : 'bg-white/5'}`}>
                <Icon size={18} className={method === id ? 'text-orange-400' : 'text-gray-400'} />
              </div>
              <div>
                <p className="text-white text-sm font-medium">{label}</p>
                <p className="text-gray-500 text-xs">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {method === 'mixed' && (
          <div className="mb-4">
            <label className="text-gray-400 text-xs mb-1 block">Parte en efectivo (CLP)</label>
            <input
              type="number"
              value={cashPart}
              onChange={e => setCashPart(e.target.value)}
              placeholder="0"
              max={total}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
            />
            {cashPart && (
              <p className="text-gray-400 text-xs mt-1">Digital: {clp(digitalPart)}</p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-400 text-sm">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={!method || saving || (method === 'mixed' && !cashPart)}
            className="flex-1 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {saving ? 'Registrando...' : 'Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}
