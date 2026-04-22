'use client'

import { useState } from 'react'
import { Plus, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/i18n'
import { validateCustomSplits } from '@/lib/bills/split-calculator'

const clp = (n: number) => formatCurrency(n)

interface SplitConfiguratorCustomProps {
  totalAmount: number
  onConfirm: (amounts: number[]) => void
  onBack: () => void
}

export function SplitConfiguratorCustom({
  totalAmount,
  onConfirm,
  onBack
}: SplitConfiguratorCustomProps) {
  const [amounts, setAmounts] = useState<string[]>(['', ''])

  const parsedAmounts = amounts.map(a => parseInt(a) || 0)
  const sum = parsedAmounts.reduce((acc, a) => acc + a, 0)
  const difference = sum - totalAmount
  const validation = validateCustomSplits(parsedAmounts, totalAmount)

  function handleAddSplit() {
    if (amounts.length < 10) {
      setAmounts(prev => [...prev, ''])
    }
  }

  function handleRemoveSplit(index: number) {
    if (amounts.length > 1) {
      setAmounts(prev => prev.filter((_, i) => i !== index))
    }
  }

  function handleAmountChange(index: number, value: string) {
    // Solo permitir números
    const cleaned = value.replace(/[^\d]/g, '')
    setAmounts(prev => prev.map((a, i) => i === index ? cleaned : a))
  }

  function handleConfirm() {
    if (validation.valid) {
      onConfirm(parsedAmounts)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-white font-semibold text-base mb-1">
          División personalizada
        </h3>
        <p className="text-white/40 text-xs">
          Total: <span className="text-white font-semibold">{clp(totalAmount)}</span>
        </p>
      </div>

      {/* Lista de divisiones */}
      <div className="space-y-2">
        {amounts.map((amount, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={e => handleAmountChange(index, e.target.value)}
                placeholder="0"
                className="w-full bg-black/30 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
                style={{ fontFamily: 'var(--font-dm-mono)' }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 text-xs">
                División {index + 1}
              </span>
            </div>

            {amounts.length > 1 && (
              <button
                onClick={() => handleRemoveSplit(index)}
                className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}

        {amounts.length < 10 && (
          <button
            onClick={handleAddSplit}
            className="w-full py-2.5 rounded-xl border border-dashed border-white/20 text-white/40 text-sm hover:border-white/30 hover:text-white/60 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            Agregar división
          </button>
        )}
      </div>

      {/* Resumen */}
      <div className={`rounded-xl p-4 border ${
        validation.valid
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : sum === 0
            ? 'bg-white/5 border-white/10'
            : 'bg-red-500/10 border-red-500/30'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/60 text-xs">Suma de divisiones</span>
          <span className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-dm-mono)' }}>
            {clp(sum)}
          </span>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-white/60 text-xs">Total a cobrar</span>
          <span className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-dm-mono)' }}>
            {clp(totalAmount)}
          </span>
        </div>

        <div className={`pt-3 border-t flex items-center gap-2 text-xs ${
          validation.valid
            ? 'border-emerald-500/20 text-emerald-400'
            : sum === 0
              ? 'border-white/10 text-white/40'
              : 'border-red-500/20 text-red-400'
        }`}>
          {validation.valid ? (
            <>
              <CheckCircle2 size={12} />
              <span>La suma coincide con el total ✓</span>
            </>
          ) : sum === 0 ? (
            <>
              <AlertCircle size={12} />
              <span>Ingresa los montos de cada división</span>
            </>
          ) : (
            <>
              <AlertCircle size={12} />
              <span>
                {difference > 0 ? 'Sobran' : 'Faltan'} {clp(Math.abs(difference))}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:border-white/20 hover:text-white transition-colors"
        >
          ← Volver
        </button>
        <button
          onClick={handleConfirm}
          disabled={!validation.valid}
          className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continuar →
        </button>
      </div>
    </div>
  )
}
