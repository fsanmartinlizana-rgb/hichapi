/**
 * /delivery/riders — Rider list + block action
 * Requirements: 7.10, 7.11
 */
'use client'

import { useState, useEffect } from 'react'
import { Star, Truck, Ban } from 'lucide-react'
import type { RiderPublicProfile } from '@/lib/delivery/types'
import { useRestaurant } from '@/lib/restaurant-context'

interface RiderWithStats extends RiderPublicProfile {
  completed_deliveries: number
}

const VEHICLE_LABELS: Record<string, string> = {
  bicycle:    'Bicicleta',
  motorcycle: 'Moto',
  car:        'Auto',
  cargo_bike: 'Cargo bike',
}

export default function DeliveryRidersPage() {
  const [riders, setRiders] = useState<RiderWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [blocking, setBlocking] = useState<string | null>(null)

  const { restaurant } = useRestaurant()

  useEffect(() => {
    if (!restaurant?.id) return
    
    fetch('/api/delivery/riders', {
      headers: { 'x-restaurant-id': restaurant.id }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRiders(data)
        } else {
          console.error('Expected array of riders, got:', data)
          setRiders([])
        }
      })
      .catch(err => {
        console.error('Failed to fetch riders', err)
        setRiders([])
      })
      .finally(() => setLoading(false))
  }, [restaurant?.id])

  async function blockRider(riderId: string) {
    if (!confirm('¿Bloquear este rider? No recibirá más pedidos de tu restaurante.')) return
    setBlocking(riderId)
    try {
      const res = await fetch('/api/delivery/riders/block', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-restaurant-id': restaurant?.id ?? ''
        },
        body: JSON.stringify({ rider_id: riderId }),
      })
      if (res.ok) {
        setRiders(prev => prev.filter(r => r.id !== riderId))
      }
    } finally {
      setBlocking(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-strong)]">Riders</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Repartidores que han trabajado con tu restaurante</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : riders.length === 0 ? (
        <div className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-12 text-center">
          <Truck size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-muted)]">Aún no tienes riders que hayan completado entregas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {riders.map(rider => (
            <div
              key={rider.id}
              className="bg-[var(--surface-sunken)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-center gap-4"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-[#FF6B35]/20 border border-[#FF6B35]/30 flex items-center justify-center text-[#E55A2B] font-bold text-sm shrink-0">
                {rider.full_name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[var(--text-strong)] font-medium text-sm">{rider.full_name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[var(--text-muted)] text-xs">{VEHICLE_LABELS[rider.vehicle_type] ?? rider.vehicle_type}</span>
                  {rider.vehicle_model && (
                    <span className="text-[var(--text-muted)] text-xs">{rider.vehicle_model}</span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="text-right shrink-0 space-y-0.5">
                <div className="flex items-center gap-1 justify-end">
                  <Star size={12} className="text-yellow-700" />
                  <span className="text-[var(--text-strong)] text-sm font-medium">
                    {rider.avg_rating !== null ? rider.avg_rating.toFixed(1) : '—'}
                  </span>
                  <span className="text-[var(--text-muted)] text-xs">({rider.total_ratings})</span>
                </div>
                <p className="text-[var(--text-muted)] text-xs">{rider.completed_deliveries} entregas</p>
              </div>

              {/* Block button */}
              <button
                onClick={() => blockRider(rider.id)}
                disabled={blocking === rider.id}
                title="Bloquear rider"
                className="p-2 rounded-lg hover:bg-red-500/15 text-[var(--text-muted)] hover:text-red-700 transition-colors shrink-0 disabled:opacity-50"
              >
                <Ban size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
