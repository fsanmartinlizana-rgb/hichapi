import { NextRequest, NextResponse } from 'next/server'
import { requireRider } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/server'
import { transitionDeliveryOrder } from '@/lib/delivery/delivery-order.service'

export async function POST(req: NextRequest) {
  const { rider, error } = await requireRider()
  if (error) return error

  if (rider?.status !== 'available') {
    return NextResponse.json({ error: 'Debes estar conectado (Disponible) para aceptar pedidos' }, { status: 400 })
  }

  const body = await req.json()
  const { restaurant_id } = body
  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id es requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Find oldest pending order for this restaurant
  const { data: oldestOrder } = await supabase
    .from('delivery_orders')
    .select('id')
    .eq('restaurant_id', restaurant_id)
    .eq('status', 'pending_assignment')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!oldestOrder) {
    return NextResponse.json({ error: 'No hay pedidos pendientes en este restaurante' }, { status: 404 })
  }

  try {
    const updated = await transitionDeliveryOrder(
      oldestOrder.id,
      'assigned',
      { riderId: rider.id }
    )
    return NextResponse.json(updated)
  } catch (err: any) {
    const isConflict = err.message?.includes('ya fue aceptado')
    return NextResponse.json({ error: err.message }, { status: isConflict ? 409 : 422 })
  }
}
