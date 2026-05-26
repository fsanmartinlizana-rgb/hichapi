import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const CancelSchema = z.object({
  restaurant_id: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  try {
    const { restaurant_id } = CancelSchema.parse(await req.json())

    const supabase = createAdminClient()
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, plan')
      .eq('id', restaurant_id)
      .single()

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
    }

    if (restaurant.plan === 'free') {
      return NextResponse.json({ error: 'El restaurante ya está en plan free' }, { status: 400 })
    }

    // Downgrade inmediato a free y limpiar fechas de suscripción
    await supabase.from('restaurants').update({
      plan:               'free',
      plan_paid_at:       null,
      plan_next_billing:  null,
    }).eq('id', restaurant_id)

    // Registrar cancelación en el historial de pagos
    await supabase.from('plan_payments').insert({
      restaurant_id,
      from_plan:       restaurant.plan,
      to_plan:         'free',
      amount:          0,
      paid_at:         new Date().toISOString(),
      next_billing_at: new Date().toISOString(),
    }).catch(() => {})

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('cancel-subscription error:', err)
    return NextResponse.json({ error: 'Error al cancelar la suscripción' }, { status: 500 })
  }
}
