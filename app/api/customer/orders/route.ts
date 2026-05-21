/**
 * GET /api/customer/orders — historial unificado de pedidos
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/supabase/auth-guard'
import { listOrders } from '@/lib/customer/order-history-service'
import { OrderHistoryQuerySchema } from '@/lib/customer/schemas'

export async function GET(req: NextRequest) {
  const { customer, error } = await requireCustomer()
  if (error) return error

  const parsed = OrderHistoryQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Parámetros inválidos', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  try {
    const result = await listOrders(customer!.id, parsed.data)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
