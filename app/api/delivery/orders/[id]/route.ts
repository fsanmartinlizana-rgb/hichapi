/**
 * PATCH /api/delivery/orders/[id] — transition delivery order status
 * Accepts both rider (Bearer token) and restaurant admin auth.
 * Requirements: 3.3, 3.6
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRider, requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { UpdateDeliveryOrderSchema } from '@/lib/delivery/types'
import { transitionDeliveryOrder, getDeliveryOrderById } from '@/lib/delivery/delivery-order.service'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params

  const body = await req.json()
  const parsed = UpdateDeliveryOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!parsed.data.status) {
    return NextResponse.json({ error: 'status es requerido' }, { status: 400 })
  }

  // Try rider auth first
  const { rider, error: riderError } = await requireRider()

  // If not a rider, try restaurant admin auth
  if (riderError) {
    const restaurantId = req.headers.get('x-restaurant-id')
    if (!restaurantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { error: authError } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'super_admin'])
    if (authError) return authError
  }

  try {
    const updated = await transitionDeliveryOrder(
      orderId,
      parsed.data.status,
      {
        riderId:       rider?.id,
        failureReason: parsed.data.failure_reason,
      },
    )
    return NextResponse.json(updated)
  } catch (err: any) {
    const isConflict = err.message?.includes('ya fue aceptado')
    return NextResponse.json({ error: err.message }, { status: isConflict ? 409 : 422 })
  }
}
