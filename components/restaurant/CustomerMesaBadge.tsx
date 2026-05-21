'use client'

import { UserCheck } from 'lucide-react'
import type { TableCustomerBadge } from '@/lib/customer/restaurant-customers'

interface Props {
  customer: TableCustomerBadge
}

/** Badge de comensal reconocido en mesa (solo nombre, visitas y puntos). */
export function CustomerMesaBadge({ customer }: Props) {
  const frequent = customer.visit_count > 5
  return (
    <div
      className="flex flex-col gap-0.5 rounded-lg border border-violet-400/25 bg-violet-500/10 px-2 py-1.5"
      title={`${customer.display_name} · ${customer.visit_count} visitas · ${customer.loyalty_points} pts`}
    >
      <div className="flex items-center gap-1">
        <UserCheck size={10} className="text-violet-300 shrink-0" />
        <span className="text-[10px] font-semibold text-violet-200 truncate max-w-[120px]">
          {customer.display_name}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[8px] text-violet-300/80">
        <span>{customer.visit_count} visitas</span>
        <span>·</span>
        <span>{customer.loyalty_points} pts</span>
        <span
          className={`ml-auto px-1 py-0.5 rounded-full font-bold ${
            frequent
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-white/10 text-white/50'
          }`}
        >
          {frequent ? 'Frecuente' : 'Nuevo'}
        </span>
      </div>
    </div>
  )
}
