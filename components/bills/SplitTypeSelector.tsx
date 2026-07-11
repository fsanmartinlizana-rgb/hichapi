'use client'

import { Banknote, Users, List, Calculator } from 'lucide-react'
import { formatCurrency } from '@/lib/i18n'

const clp = (n: number) => formatCurrency(n)

export type SplitType = 'full' | 'equal' | 'by_items' | 'custom'

interface SplitTypeSelectorProps {
  totalAmount: number
  pax: number
  onSelect: (type: SplitType) => void
}

export function SplitTypeSelector({ totalAmount, pax, onSelect }: SplitTypeSelectorProps) {
  const amountPerPerson = Math.floor(totalAmount / pax)

  const options: Array<{
    id: SplitType
    icon: typeof Banknote
    label: string
    description: string
    color: string
  }> = [
    {
      id: 'full',
      icon: Banknote,
      label: 'Pago completo',
      description: `Una persona paga todo: ${clp(totalAmount)}`,
      color: '#15803D'
    },
    {
      id: 'equal',
      icon: Users,
      label: 'Dividir en partes iguales',
      description: `Entre ${pax} personas: ${clp(amountPerPerson)} c/u`,
      color: '#1D4ED8'
    },
    {
      id: 'by_items',
      icon: List,
      label: 'Dividir por items',
      description: 'Cada persona paga lo que consumió',
      color: '#6D28D9'
    },
    {
      id: 'custom',
      icon: Calculator,
      label: 'División personalizada',
      description: 'Montos específicos',
      color: '#B45309'
    }
  ]

  return (
    <div className="space-y-3">
      <div className="mb-4">
        <h3 className="text-[var(--text-strong)] font-semibold text-base mb-1">
          ¿Cómo deseas dividir la cuenta?
        </h3>
        <p className="text-[var(--text-muted)] text-xs">
          Total a cobrar: <span className="text-[var(--text-strong)] font-semibold">{clp(totalAmount)}</span>
        </p>
      </div>

      {options.map(({ id, icon: Icon, label, description, color }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] bg-[var(--surface-sunken)] hover:bg-[var(--surface-sunken)] transition-all text-left group"
        >
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 transition-all group-hover:scale-105"
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon size={20} style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[var(--text-strong)] text-sm font-semibold">{label}</p>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">{description}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
