'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Navigation } from 'lucide-react'
import type { UnifiedOrder } from '@/lib/customer/types'
import type { CustomerRating } from '@/lib/customer/types'
import { formatCurrency } from '@/lib/i18n'
import { canRateOrder, isActiveDelivery, ORDER_STATUS_LABELS } from '@/lib/cuenta/constants'
import { CustomerRatingForm } from '@/components/cuenta/CustomerRatingForm'

export default function CuentaPedidoDetallePage() {
  const params = useParams()
  const id = params.id as string

  const [order, setOrder] = useState<UnifiedOrder | null>(null)
  const [ratings, setRatings] = useState<CustomerRating[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [oRes, rRes] = await Promise.all([
        fetch(`/api/customer/orders/${id}`),
        fetch('/api/customer/ratings'),
      ])
      if (oRes.ok) setOrder(await oRes.json())
      if (rRes.ok) setRatings(await rRes.json())
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-[#FF6B35]" size={28} />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Link href="/cuenta/pedidos" className="text-white/50 text-sm flex items-center gap-1 hover:text-white">
          <ArrowLeft size={14} /> Volver
        </Link>
        <p className="text-white/50">Pedido no encontrado.</p>
      </div>
    )
  }

  const alreadyRated = ratings.some((r) => r.order_id === order.id)
  const showRating =
    !alreadyRated && canRateOrder(order.status, order.order_type)

  return (
    <div className="space-y-6">
      <Link href="/cuenta/pedidos" className="text-white/50 text-sm flex items-center gap-1 hover:text-white">
        <ArrowLeft size={14} /> Mis pedidos
      </Link>

      <div>
        <h1 className="text-xl font-bold text-white">{order.restaurant_name}</h1>
        <p className="text-white/45 text-sm mt-1">
          {new Date(order.created_at).toLocaleString('es-CL')} ·{' '}
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </p>
      </div>

      {order.order_type === 'delivery' && isActiveDelivery(order.status) && (
        <Link
          href={`/cuenta/tracking/${order.id}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm"
        >
          <Navigation size={16} />
          Seguir en tiempo real
        </Link>
      )}

      <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 space-y-3">
        <p className="text-white font-semibold text-sm">Resumen</p>
        <p className="text-2xl font-bold text-white">{formatCurrency(order.total_clp)}</p>
        {order.delivery_address && (
          <p className="text-white/55 text-sm">
            <span className="text-white/35">Entrega: </span>
            {order.delivery_address}
          </p>
        )}
        {order.notes && (
          <p className="text-white/55 text-sm">
            <span className="text-white/35">Notas: </span>
            {order.notes}
          </p>
        )}
      </div>

      {order.items && order.items.length > 0 && (
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4">
          <p className="text-white font-semibold text-sm mb-3">Items</p>
          <ul className="space-y-2">
            {order.items.map((item, i) => (
              <li key={i} className="flex justify-between text-sm">
                <span className="text-white/80">
                  {item.quantity}× {item.name}
                </span>
                <span className="text-white/50">{formatCurrency(item.unit_price * item.quantity)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showRating && (
        <CustomerRatingForm
          orderId={order.id}
          orderType={order.order_type}
          restaurantId={order.restaurant_id}
          restaurantName={order.restaurant_name}
          riderId={order.rider_id}
          onSubmitted={load}
        />
      )}
    </div>
  )
}
