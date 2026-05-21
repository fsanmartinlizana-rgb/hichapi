'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DeliveryStatus } from '@/lib/delivery/types'
import type { TrackingData } from '@/lib/customer/tracking-service'
import type { CustomerRating } from '@/lib/customer/types'
import { DeliveryProgress } from '@/components/cuenta/DeliveryProgress'
import { DeliveryTrackingMap } from '@/components/cuenta/DeliveryTrackingMap'
import { CustomerRatingForm } from '@/components/cuenta/CustomerRatingForm'

export default function CuentaTrackingPage() {
  const params = useParams()
  const deliveryOrderId = params.delivery_order_id as string

  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [ratings, setRatings] = useState<CustomerRating[]>([])
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState('')
  const [riderId, setRiderId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/customer/tracking/${deliveryOrderId}`)
    if (res.ok) {
      const json = await res.json() as TrackingData
      setData(json)
      if (json.last_location) {
        setLocation({ lat: json.last_location.lat, lng: json.last_location.lng })
      }
    }
    const [orderRes, ratingsRes] = await Promise.all([
      fetch(`/api/customer/orders/${deliveryOrderId}`),
      fetch('/api/customer/ratings'),
    ])
    if (orderRes.ok) {
      const order = await orderRes.json()
      setRestaurantId(order.restaurant_id)
      setRestaurantName(order.restaurant_name)
      setRiderId(order.rider_id ?? null)
    }
    if (ratingsRes.ok) setRatings(await ratingsRes.json())
    setLoading(false)
  }, [deliveryOrderId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!data || data.status !== 'in_transit') return

    const supabase = createClient()
    const channel = supabase
      .channel(`rider-location-${deliveryOrderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rider_locations',
          filter: `delivery_order_id=eq.${deliveryOrderId}`,
        },
        (payload) => {
          const row = payload.new as { lat: number | string; lng: number | string }
          const lat = Number(row.lat)
          const lng = Number(row.lng)
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            setLocation({ lat, lng })
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [data, deliveryOrderId])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-[#FF6B35]" size={28} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Link href="/cuenta/pedidos" className="text-white/50 text-sm flex items-center gap-1">
          <ArrowLeft size={14} /> Volver
        </Link>
        <p className="text-white/50">Pedido no encontrado.</p>
      </div>
    )
  }

  const status = data.status as DeliveryStatus
  const delivered = status === 'delivered'
  const alreadyRated = ratings.some((r) => r.order_id === deliveryOrderId)

  return (
    <div className="space-y-6">
      <Link href={`/cuenta/pedidos/${deliveryOrderId}`} className="text-white/50 text-sm flex items-center gap-1 hover:text-white">
        <ArrowLeft size={14} /> Detalle del pedido
      </Link>

      <div>
        <h1 className="text-xl font-bold text-white">Seguimiento de delivery</h1>
        <p className="text-white/45 text-sm mt-1 truncate">{data.delivery_address}</p>
      </div>

      <DeliveryProgress status={status} />

      {delivered && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-4 text-center">
          <p className="text-emerald-300 font-semibold">¡Pedido entregado!</p>
          {data.delivered_at && (
            <p className="text-emerald-400/70 text-xs mt-1">
              {new Date(data.delivered_at).toLocaleString('es-CL')}
            </p>
          )}
        </div>
      )}

      {data.rider && (
        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3">
          {data.rider.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.rider.profile_photo_url}
              alt=""
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#FF6B35]/20 flex items-center justify-center">
              <User size={20} className="text-[#FF6B35]" />
            </div>
          )}
          <div>
            <p className="text-white/40 text-xs">Tu repartidor</p>
            <p className="text-white font-semibold">{data.rider.first_name}</p>
          </div>
          {status === 'in_transit' && (
            <p className="ml-auto text-[#FF6B35] text-xs font-medium">~15–25 min</p>
          )}
        </div>
      )}

      {location && (status === 'in_transit' || status === 'picked_up') && (
        <DeliveryTrackingMap
          lat={location.lat}
          lng={location.lng}
          label="Ubicación del repartidor"
        />
      )}

      {delivered && !alreadyRated && restaurantId && (
        <CustomerRatingForm
          orderId={deliveryOrderId}
          orderType="delivery"
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          riderId={riderId}
          onSubmitted={load}
        />
      )}
    </div>
  )
}
