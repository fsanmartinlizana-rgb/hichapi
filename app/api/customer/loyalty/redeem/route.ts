/**
 * POST /api/customer/loyalty/redeem — canjear puntos de fidelidad
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/supabase/auth-guard'
import { redeemPoints } from '@/lib/customer/loyalty-service'
import { RedeemLoyaltyPointsSchema } from '@/lib/customer/schemas'

export async function POST(req: NextRequest) {
  const { customer, error } = await requireCustomer()
  if (error) return error

  try {
    const body = await req.json()
    const parsed = RedeemLoyaltyPointsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    const redemption = await redeemPoints(
      customer!.id,
      parsed.data.points_to_redeem,
      parsed.data.order_id,
    )
    return NextResponse.json(redemption, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    if (
      msg.includes('mínimo') ||
      msg.includes('insuficientes') ||
      msg.includes('negativo')
    ) {
      return NextResponse.json({ error: msg }, { status: 422 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
