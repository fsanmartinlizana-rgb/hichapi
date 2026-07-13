'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Truck, CheckCircle2, Clock, MapPin, Navigation, Package, User } from 'lucide-react'

type TrackData = {
  id: string
  status: 'pending_assignment' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled' | 'failed'
  created_at: string
  pickup_at?: string
  delivered_at?: string
  client_name: string
  restaurant: {
    id: string
    name: string
    slug: string
    address: string
  }
  rider?: {
    id: string
    full_name: string
    phone: string
    vehicle_type: string
    vehicle_plate: string
    last_lat: number | null
    last_lng: number | null
  }
}

const STATUS_LABELS: Record<TrackData['status'], string> = {
  pending_assignment: 'Buscando repartidor',
  assigned:           'Repartidor en camino al local',
  picked_up:          'Pedido recogido',
  in_transit:         'En camino a tu dirección',
  delivered:          'Entregado',
  cancelled:          'Cancelado',
  failed:             'Entrega fallida',
}

const STATUS_COLORS: Record<TrackData['status'], string> = {
  pending_assignment: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
  assigned:           'bg-blue-500/20 text-blue-500 border-blue-500/30',
  picked_up:          'bg-purple-500/20 text-purple-500 border-purple-500/30',
  in_transit:         'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
  delivered:          'bg-green-500/20 text-green-500 border-green-500/30',
  cancelled:          'bg-red-500/20 text-red-500 border-red-500/30',
  failed:             'bg-red-500/20 text-red-500 border-red-500/30',
}

const STATUS_RANK = {
  pending_assignment: 0,
  assigned:           1,
  picked_up:          2,
  in_transit:         3,
  delivered:          4,
  cancelled:          -1,
  failed:             -1,
}

const TIMELINE = [
  { status: 'pending_assignment', label: 'Buscando', icon: Clock },
  { status: 'assigned',           label: 'Asignado', icon: User },
  { status: 'picked_up',          label: 'Recogido', icon: Package },
  { status: 'in_transit',         label: 'En camino', icon: Navigation },
  { status: 'delivered',          label: 'Entregado', icon: CheckCircle2 },
]

export default function TrackingPage() {
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<TrackData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    async function load() {
      if (!id) return
      try {
        const res = await fetch(`/api/delivery/track/${id}`)
        if (!res.ok) {
          setError('Pedido no encontrado')
          return
        }
        const json = await res.json()
        setData(json)
      } catch {
        setError('Error de conexión')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Realtime subscription for order status and rider location
  useEffect(() => {
    if (!data?.id) return

    const channel = supabase.channel(`track-${data.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'delivery_orders', filter: `id=eq.${data.id}` },
        (payload) => {
          setData(prev => prev ? { ...prev, status: payload.new.status, rider_id: payload.new.rider_id } : prev)
          // If rider changed (assigned), we should reload to get rider details
          if (payload.new.rider_id && payload.new.rider_id !== payload.old?.rider_id) {
            fetch(`/api/delivery/track/${data.id}`)
              .then(res => res.json())
              .then(json => setData(json))
              .catch(console.error)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rider_profiles', filter: `id=eq.${data.rider?.id}` },
        (payload) => {
          if (payload.new.last_lat && payload.new.last_lng) {
            setData(prev => {
              if (!prev || !prev.rider) return prev
              return {
                ...prev,
                rider: {
                  ...prev.rider,
                  last_lat: payload.new.last_lat,
                  last_lng: payload.new.last_lng,
                }
              }
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, data?.id, data?.rider?.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex flex-col items-center justify-center text-[var(--text-muted)] space-y-4">
        <Truck className="animate-bounce" size={48} />
        <p>Cargando información del pedido...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-red-700 mb-2">{error}</p>
        <p className="text-[var(--text-muted)] text-sm">Comprueba que el enlace sea correcto.</p>
      </div>
    )
  }

  const currentRank = STATUS_RANK[data.status]
  const isFinished = currentRank === 4 || currentRank === -1

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-strong)] flex flex-col items-center">
      <div className="w-full max-w-md p-6 space-y-8 mt-4">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{data.restaurant.name}</h1>
          <p className="text-[var(--text-muted)] text-sm">Sigue el estado de tu pedido</p>
        </div>

        {/* Status Card */}
        <div className="bg-[var(--surface-card)] rounded-3xl p-6 shadow-2xl border border-[var(--border-subtle)] relative overflow-hidden">
          {/* Animated gradient bg */}
          {!isFinished && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#FF6B35] to-transparent animate-pulse" />
          )}

          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`p-4 rounded-full border-2 ${STATUS_COLORS[data.status]} bg-opacity-10 animate-in zoom-in duration-500`}>
              {data.status === 'delivered' ? <CheckCircle2 size={32} /> : <Truck size={32} />}
            </div>
            <div>
              <h2 className="text-xl font-bold">{STATUS_LABELS[data.status]}</h2>
              {data.status === 'in_transit' && (
                <p className="text-[#E55A2B] text-sm font-medium mt-1 animate-pulse">¡Prepárate! Tu pedido está cerca.</p>
              )}
            </div>
          </div>

          {/* Timeline */}
          {currentRank >= 0 && (
            <div className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
              <div className="flex justify-between items-center relative">
                {/* Connecting line */}
                <div className="absolute top-4 left-[10%] right-[10%] h-0.5 bg-[var(--surface-sunken)] -z-10" />
                
                {TIMELINE.map((step) => {
                  const stepRank = STATUS_RANK[step.status as TrackData['status']]
                  const isActive = stepRank === currentRank
                  const isDone = stepRank <= currentRank
                  const Icon = step.icon

                  return (
                    <div key={step.status} className="flex flex-col items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        isActive ? 'bg-[#FF6B35] border-[#FF6B35] text-white scale-110 shadow-[0_0_15px_rgba(255,107,53,0.5)]' :
                        isDone ? 'bg-green-500/20 border-green-500 text-green-500' :
                        'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                      }`}>
                        <Icon size={14} />
                      </div>
                      <span className={`text-[10px] font-medium ${isDone ? 'text-[var(--text-strong)]' : 'text-[var(--text-muted)]'}`}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rider Info (if assigned) */}
        {data.rider && currentRank >= 1 && currentRank < 4 && (
          <div className="bg-[var(--surface-card)] rounded-3xl p-5 border border-[var(--border-subtle)] space-y-4 animate-in slide-in-from-bottom-4">
            <h3 className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">Tu Repartidor</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[var(--surface-sunken)] flex items-center justify-center flex-shrink-0">
                <User className="text-[var(--text-muted)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--text-strong)] truncate">{data.rider.full_name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-[var(--surface-sunken)] px-2 py-0.5 rounded text-[var(--text-body)]">
                    {data.rider.vehicle_type === 'moto' ? '🏍 Moto' : data.rider.vehicle_type === 'auto' ? '🚗 Auto' : '🚲 Bici'}
                  </span>
                  {data.rider.vehicle_plate && (
                    <span className="text-xs text-[var(--text-muted)] uppercase">{data.rider.vehicle_plate}</span>
                  )}
                </div>
              </div>
              <a 
                href={`tel:${data.rider.phone}`}
                className="w-10 h-10 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center hover:bg-green-500/30 transition-colors flex-shrink-0"
              >
                📞
              </a>
            </div>
          </div>
        )}

        {/* Map / Location Indicator (Mock visualization since we don't have a map component yet) */}
        {data.rider?.last_lat && data.status === 'in_transit' && (
          <div className="bg-[var(--surface-card)] rounded-3xl p-5 border border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center animate-pulse">
                <MapPin size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold">Ubicación en vivo</p>
                <p className="text-xs text-[var(--text-muted)]">El repartidor está compartiendo su ubicación</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
