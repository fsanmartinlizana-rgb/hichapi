'use client'

import type { DeliveryStatus } from '@/lib/delivery/types'
import { Check } from 'lucide-react'

const STEPS: { key: DeliveryStatus; label: string }[] = [
  { key: 'pending_assignment', label: 'Pendiente' },
  { key: 'assigned', label: 'Asignado' },
  { key: 'picked_up', label: 'Recogido' },
  { key: 'in_transit', label: 'En camino' },
  { key: 'delivered', label: 'Entregado' },
]

const ORDER: DeliveryStatus[] = [
  'pending_assignment',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
]

function stepIndex(status: DeliveryStatus): number {
  if (status === 'cancelled' || status === 'failed') return -1
  const i = ORDER.indexOf(status)
  return i >= 0 ? i : 0
}

export function DeliveryProgress({ status }: { status: DeliveryStatus }) {
  const current = stepIndex(status)
  const terminal = status === 'cancelled' || status === 'failed'

  if (terminal) {
    return (
      <p className="text-sm text-red-400/90 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
        Pedido {status === 'cancelled' ? 'cancelado' : 'no entregado'}
      </p>
    )
  }

  return (
    <ol className="flex items-center justify-between gap-1">
      {STEPS.map((step, i) => {
        const done = i <= current
        const active = i === current
        return (
          <li key={step.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shrink-0 ${
                done
                  ? 'bg-[#FF6B35] border-[#FF6B35] text-white'
                  : 'border-white/15 bg-white/5 text-white/25'
              } ${active ? 'ring-2 ring-[#FF6B35]/40' : ''}`}
            >
              {done ? <Check size={12} strokeWidth={3} /> : <span className="text-[10px]">{i + 1}</span>}
            </div>
            <span
              className={`text-[9px] text-center leading-tight ${
                active ? 'text-[#FF6B35] font-semibold' : done ? 'text-white/50' : 'text-white/25'
              }`}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
