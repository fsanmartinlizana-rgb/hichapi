/**
 * /delivery/pedidos — Real-time orders table + live map + create order modal
 * Requirements: 7.7, 7.8, 7.9
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Plus, MapPin, Clock, User, Truck } from 'lucide-react'
import type { DeliveryOrder, DeliveryStatus } from '@/lib/delivery/types'
import { useRestaurant } from '@/lib/restaurant-context'

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending_assignment: 'Sin asignar',
  assigned:           'Asignado',
  picked_up:          'Recogido',
  in_transit:         'En camino',
  delivered:          'Entregado',
  cancelled:          'Cancelado',
  failed:             'Fallido',
}

const STATUS_COLORS: Record<DeliveryStatus, string> = {
  pending_assignment: 'bg-amber-500/20 text-amber-400',
  assigned:           'bg-blue-500/20 text-blue-400',
  picked_up:          'bg-purple-500/20 text-purple-400',
  in_transit:         'bg-indigo-500/20 text-indigo-400',
  delivered:          'bg-green-500/20 text-green-400',
  cancelled:          'bg-white/10 text-white/40',
  failed:             'bg-red-500/20 text-red-400',
}

const ACTIVE_STATUSES: DeliveryStatus[] = ['pending_assignment', 'assigned', 'picked_up', 'in_transit']

export default function DeliveryPedidosPage() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'active' | 'all'>('active')

  const { restaurant } = useRestaurant()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const loadOrders = useCallback(async () => {
    if (!restaurant?.id) return
    const res = await fetch(
      filter === 'active'
        ? '/api/delivery/orders?status=pending_assignment,assigned,picked_up,in_transit'
        : '/api/delivery/orders',
      { headers: { 'x-restaurant-id': restaurant.id } }
    )
    if (res.ok) {
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } else {
      setOrders([])
    }
  }, [filter, restaurant?.id])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('delivery-orders-panel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_orders' },
        payload => {
          if (payload.eventType === 'INSERT') {
            setOrders(prev => [payload.new as DeliveryOrder, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setOrders(prev =>
              prev.map(o => o.id === payload.new.id ? payload.new as DeliveryOrder : o),
            )
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== payload.old.id))
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const displayed = filter === 'active'
    ? orders.filter(o => ACTIVE_STATUSES.includes(o.status))
    : orders

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pedidos de Delivery</h1>
          <p className="text-white/50 text-sm mt-1">Monitoreo en tiempo real</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] text-white rounded-lg text-sm font-medium hover:bg-[#e55a25] transition-colors"
        >
          <Plus size={14} /> Nuevo pedido
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['active', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              filter === f ? 'bg-[#FF6B35] text-white' : 'bg-white/8 text-white/50 hover:bg-white/12'
            }`}
          >
            {f === 'active' ? 'Activos' : 'Todos'}
          </button>
        ))}
      </div>

      {/* Orders table */}
      {displayed.length === 0 ? (
        <div className="bg-white/5 border border-white/8 rounded-xl p-12 text-center">
          <Truck size={32} className="text-white/20 mx-auto mb-3" />
          <p className="text-white/40">No hay pedidos {filter === 'active' ? 'activos' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(order => (
            <div
              key={order.id}
              className="bg-white/5 border border-white/8 rounded-xl p-4 hover:bg-white/8 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                    <span className="text-white/30 text-xs">
                      {new Date(order.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/70 text-sm">
                    <User size={12} className="shrink-0" />
                    <span className="truncate">{order.client_name}</span>
                    <span className="text-white/30">·</span>
                    <span className="text-white/50 text-xs">{order.client_phone}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-white/50 text-xs">
                    <MapPin size={11} className="shrink-0 mt-0.5" />
                    <span className="truncate">{order.delivery_address}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white font-semibold">
                    ${order.total_clp.toLocaleString('es-CL')}
                  </p>
                  {order.delivery_fee_clp && (
                    <p className="text-white/40 text-xs">
                      +${order.delivery_fee_clp.toLocaleString('es-CL')} delivery
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create order modal */}
      {showModal && <CreateOrderModal onClose={() => setShowModal(false)} onCreated={loadOrders} restaurantId={restaurant?.id ?? ''} />}
    </div>
  )
}

function CreateOrderModal({ onClose, onCreated, restaurantId }: { onClose: () => void; onCreated: () => void; restaurantId: string }) {
  const [form, setForm] = useState({
    pickup_address:   '',
    delivery_address: '',
    client_name:      '',
    client_phone:     '',
    total_clp:        0,
    notes:            '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/delivery/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-restaurant-id': restaurantId
        },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        let errMsg = 'Error al crear el pedido'
        if (typeof data.error === 'string') {
          errMsg = data.error
        } else if (data.error && typeof data.error === 'object') {
          if (data.error.fieldErrors) {
            errMsg = Object.entries(data.error.fieldErrors)
              .map(([field, msgs]) => `${field}: ${(msgs as any).join(', ')}`)
              .join(' | ')
          } else {
            errMsg = JSON.stringify(data.error)
          }
        }
        setError(errMsg)
        return
      }
      onCreated()
      onClose()
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A2E] border border-white/12 rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-white font-bold text-lg">Nuevo pedido de delivery</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { key: 'pickup_address',   label: 'Dirección de recogida', type: 'text' },
            { key: 'delivery_address', label: 'Dirección de entrega',  type: 'text' },
            { key: 'client_name',      label: 'Nombre del cliente',    type: 'text' },
            { key: 'client_phone',     label: 'Teléfono del cliente',  type: 'tel' },
            { key: 'total_clp',        label: 'Total del pedido (CLP)', type: 'number' },
            { key: 'notes',            label: 'Notas (opcional)',       type: 'text' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="text-white/60 text-xs mb-1 block">{label}</label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? parseInt(e.target.value, 10) || 0 : e.target.value }))}
                className="w-full bg-white/8 border border-white/12 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#FF6B35]"
                required={key !== 'notes'}
              />
            </div>
          ))}
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-white/8 text-white/60 text-sm hover:bg-white/12 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[#FF6B35] text-white text-sm font-medium hover:bg-[#e55a25] transition-colors disabled:opacity-50"
            >
              {saving ? 'Creando…' : 'Crear pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
