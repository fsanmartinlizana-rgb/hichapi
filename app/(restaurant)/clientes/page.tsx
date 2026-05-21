'use client'

/**
 * /clientes — comensales reconocidos en el restaurante
 * Requirements: 7.5, 10.5
 */
import { useCallback, useEffect, useState } from 'react'
import { Users, Star, Loader2 } from 'lucide-react'
import { useRestaurant } from '@/lib/restaurant-context'
import type { RestaurantCustomerSummary } from '@/lib/customer/restaurant-customers'

export default function ClientesPage() {
  const { restaurant } = useRestaurant()
  const [customers, setCustomers] = useState<RestaurantCustomerSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!restaurant?.id) return
    setLoading(true)
    try {
      const res = await fetch('/api/restaurant/customers', {
        headers: { 'x-restaurant-id': restaurant.id },
      })
      const data = await res.json()
      setCustomers(Array.isArray(data.customers) ? data.customers : [])
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [restaurant?.id])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users size={22} className="text-[#FF6B35]" />
          Comensales
        </h1>
        <p className="text-white/50 text-sm mt-1">
          Clientes con cuenta HiChapi que han pedido en tu local. Solo mostramos nombre, visitas y puntos.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="text-[#FF6B35] animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white/5 border border-white/8 rounded-2xl p-10 text-center">
          <Users size={32} className="text-white/20 mx-auto mb-3" />
          <p className="text-white/50 text-sm">Aún no hay comensales reconocidos en tu restaurante.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <div
              key={c.customer_id}
              className="flex items-center gap-4 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3"
            >
              <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-300 font-bold text-sm">
                {c.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{c.display_name}</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {c.visit_count} {c.visit_count === 1 ? 'visita' : 'visitas'}
                  {c.last_visit_at && (
                    <> · última {new Date(c.last_visit_at).toLocaleDateString('es-CL')}</>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[#FF6B35] font-semibold text-sm flex items-center gap-1 justify-end">
                  <Star size={12} className="fill-[#FF6B35]" />
                  {c.loyalty_points} pts
                </p>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${
                    c.visit_count > 5
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-white/8 text-white/45'
                  }`}
                >
                  {c.visit_count > 5 ? 'Cliente frecuente' : 'Cliente nuevo'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
