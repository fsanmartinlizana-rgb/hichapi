/**
 * /delivery — Overview page with KPI cards
 * Requirements: 7.7
 */
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Truck, Clock, Star, TrendingUp } from 'lucide-react'

export default async function DeliveryPage() {
  const headerStore = await headers()
  const restaurantId = headerStore.get('x-restaurant-id')

  let activeOrders = 0
  let pendingOrders = 0
  let todayCompleted = 0
  let avgRating: number | null = null

  if (restaurantId) {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]

    const [activeRes, pendingRes, completedRes, ratingRes] = await Promise.all([
      supabase
        .from('delivery_orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('status', ['assigned', 'picked_up', 'in_transit']),
      supabase
        .from('delivery_orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending_assignment'),
      supabase
        .from('delivery_orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'delivered')
        .gte('created_at', today),
      supabase
        .from('rider_ratings')
        .select('stars')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', today),
    ])

    activeOrders    = activeRes.count ?? 0
    pendingOrders   = pendingRes.count ?? 0
    todayCompleted  = completedRes.count ?? 0
    const ratings   = ratingRes.data ?? []
    avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((s: number, r: { stars: number }) => s + r.stars, 0) / ratings.length) * 10) / 10
      : null
  }

  const kpis = [
    { label: 'Pedidos activos',    value: activeOrders,                    icon: Truck,      color: 'text-blue-400',   href: '/delivery/pedidos' },
    { label: 'Sin asignar',        value: pendingOrders,                   icon: Clock,      color: 'text-amber-400',  href: '/delivery/pedidos' },
    { label: 'Entregados hoy',     value: todayCompleted,                  icon: TrendingUp, color: 'text-green-400',  href: '/delivery/analiticas' },
    { label: 'Rating promedio hoy', value: avgRating !== null ? `${avgRating}★` : '—', icon: Star, color: 'text-yellow-400', href: '/delivery/calificaciones' },
  ]

  const quickLinks = [
    { label: 'Configurar zona y tarifas', href: '/delivery/configuracion', desc: 'Define tu zona de cobertura y precios' },
    { label: 'Ver pedidos en tiempo real', href: '/delivery/pedidos',       desc: 'Monitorea entregas activas con mapa' },
    { label: 'Gestionar riders',           href: '/delivery/riders',        desc: 'Riders que han trabajado contigo' },
    { label: 'Calificar riders',           href: '/delivery/calificaciones', desc: 'Evalúa el servicio de tus repartidores' },
    { label: 'Ver analíticas',             href: '/delivery/analiticas',    desc: 'Métricas y mapa de calor de demanda' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Delivery</h1>
        <p className="text-white/50 text-sm mt-1">Gestiona tu operación de última milla</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-white/5 border border-white/8 rounded-xl p-4 hover:bg-white/8 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} className={color} />
              <span className="text-white/50 text-xs">{label}</span>
            </div>
            <p className="text-white text-2xl font-bold">{value}</p>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-white/70 text-sm font-semibold uppercase tracking-wider mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quickLinks.map(({ label, href, desc }) => (
            <Link
              key={href}
              href={href}
              className="bg-white/5 border border-white/8 rounded-xl p-4 hover:bg-white/8 transition-colors group"
            >
              <p className="text-white font-medium text-sm group-hover:text-[#FF6B35] transition-colors">{label}</p>
              <p className="text-white/40 text-xs mt-1">{desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
