/**
 * GET /api/customer/orders/[id] — detalle de pedido (presencial o delivery)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/supabase/auth-guard'
import { getOrderById } from '@/lib/customer/order-history-service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { customer, error } = await requireCustomer()
  if (error) return error

  const { id } = await params

  try {
    const order = await getOrderById(customer!.id, id)
    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }
    return NextResponse.json(order)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
