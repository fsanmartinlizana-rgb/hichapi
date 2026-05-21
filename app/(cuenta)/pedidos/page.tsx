'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Package, Bike, Utensils, ChevronRight, Navigation } from 'lucide-react'
import type { UnifiedOrder } from '@/lib/customer/types'
import { formatCurrency } from '@/lib/i18n'
import { isActiveDelivery, ORDER_STATUS_LABELS } from '@/lib/cuenta/constants'

type FilterType = 'all' | 'delivery' | 'presencial'

export default function CuentaPedidosPage() {
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<FilterType>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type, page: '1', page_size: '50' })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/customer/orders?${params}`)
      const data = await res.json()
      setOrders(data.orders ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setOrders([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [type, from, to])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Package size={22} className="text-[#FF6B35]" />
          Mis pedidos
        </h1>
        <p className="text-white/45 text-sm mt-1">{total} pedidos en total</p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex rounded-xl border border-white/10 overflow-hidden">
          {(['all', 'delivery', 'presencial'] as FilterType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-2 text-xs font-medium ${
                type === t ? 'bg-[#FF6B35] text-white' : 'bg-white/5 text-white/50'
              }`}
            >
              {t === 'all' ? 'Todos' : t === 'delivery' ? 'Delivery' : 'En local'}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-[#FF6B35]" size={28} />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.02] border border-white/8 rounded-2xl">
          <Package size={36} className="text-white/20 mx-auto mb-3" />
          <p className="text-white/50 text-sm">Aún no tienes pedidos registrados.</p>
          <Link href="/buscar" className="inline-block mt-4 text-[#FF6B35] text-sm font-medium hover:underline">
            Explorar restaurantes
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={`${o.order_type}-${o.id}`}>
              <div className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
                <Link
                  href={`/cuenta/pedidos/${o.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    {o.order_type === 'delivery' ? (
                      <Bike size={16} className="text-[#FF6B35]" />
                    ) : (
                      <Utensils size={16} className="text-white/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{o.restaurant_name}</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {new Date(o.created_at).toLocaleDateString('es-CL')} ·{' '}
                      {ORDER_STATUS_LABELS[o.status] ?? o.status}
                    </p>
                  </div>
                  <p className="text-white font-semibold text-sm shrink-0">{formatCurrency(o.total_clp)}</p>
                  <ChevronRight size={16} className="text-white/25 shrink-0" />
                </Link>
                {o.order_type === 'delivery' && isActiveDelivery(o.status) && (
                  <Link
                    href={`/cuenta/tracking/${o.id}`}
                    className="flex items-center gap-2 px-4 py-2 border-t border-white/5 text-[#FF6B35] text-xs font-semibold hover:bg-[#FF6B35]/5"
                  >
                    <Navigation size={12} />
                    Seguir pedido en vivo
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
