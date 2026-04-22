'use client'

import { useState } from 'react'
import { Users, Minus, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/i18n'

const clp = (n: number) => formatCurrency(n)

interface SplitConfiguratorEqualProps {
  totalAmount: number
  defaultPax: number
  onConfirm: (numPeople: number) => void
  onBack: () => void
}

export function SplitConfiguratorEqual({
  totalAmount,
  defaultPax,
  onConfirm,
  onBack
}: SplitConfiguratorEqualProps) {
  const [numPeople, setNumPeople] = useState(defaultPax)

  const amountPerPerson = Math.floor(totalAmount / numPeople)
  const remainder = totalAmount - (amountPerPerson * numPeople)

  function handleIncrement() {
    if (numPeople < 20) setNumPeople(prev => prev + 1)
  }

  function handleDecrement() {
    if (numPeople > 1) setNumPeople(prev => prev - 1)
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-white font-semibold text-base mb-1">
          Dividir en partes iguales
        </h3>
        <p className="text-white/40 text-xs">
          Total: <span className="text-white font-semibold">{clp(totalAmount)}</span>
        </p>
      </div>

      {/* Selector de número de personas */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <label className="text-white/60 text-xs font-medium mb-3 block">
          ¿Cuántas personas?
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDecrement}
            disabled={numPeople <= 1}
            className="w-10 h-10 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-white hover:bg-white/12 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Minus size={16} />
          </button>

          <div className="flex-1 flex items-center justify-center gap-2 bg-[#0A0A14] rounded-lg py-3 px-4 border border-white/8">
            <Users size={18} className="text-[#60A5FA]" />
            <span className="text-white text-2xl font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>
              {numPeople}
            </span>
          </div>

          <button
            onClick={handleIncrement}
            disabled={numPeople >= 20}
            className="w-10 h-10 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-white hover:bg-white/12 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Preview de división */}
      <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4">
        <p className="text-[#60A5FA]/70 text-xs font-medium mb-2">Vista previa</p>
        <div className="space-y-2">
          {Array.from({ length: numPeople }, (_, i) => {
            const amount = amountPerPerson + (i === 0 ? remainder : 0)
            return (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-white/60">Persona {i + 1}</span>
                <span className="text-white font-semibold" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                  {clp(amount)}
                </span>
              </div>
            )
          })}
        </div>
        {remainder > 0 && (
          <p className="text-[#60A5FA]/50 text-[10px] mt-3 italic">
            * Persona 1 paga {clp(remainder)} extra por redondeo
          </p>
        )}
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
          onClick={() => onConfirm(numPeople)}
          className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] text-white text-sm font-semibold transition-colors"
        >
          Continuar →
        </button>
      </div>
    </div>
  )
}
