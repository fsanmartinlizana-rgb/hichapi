/**
 * GET /api/customer/tracking/[delivery_order_id] — tracking público de delivery
 *
 * Ruta pública (sin requireCustomer). No expone datos personales del comensal.
 * Requirements: 6.1, 6.4, 6.7, 6.9
 */
import { NextRequest, NextResponse } from 'next/server'
import { getTrackingData } from '@/lib/customer/tracking-service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ delivery_order_id: string }> },
) {
  const { delivery_order_id } = await params

  try {
    const data = await getTrackingData(delivery_order_id)
    if (!data) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
