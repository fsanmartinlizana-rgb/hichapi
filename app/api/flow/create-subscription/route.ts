import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PLANS, getPlanLevel } from '@/lib/plans'
import { flowRequest } from '@/lib/flow'

const CheckoutSchema = z.object({
  restaurant_id: z.string().uuid(),
  target_plan:   z.enum(['starter', 'pro', 'enterprise']),
})

export async function POST(req: NextRequest) {
  try {
    const { restaurant_id, target_plan } = CheckoutSchema.parse(await req.json())
    const planConfig = PLANS[target_plan]

    const supabase = createAdminClient()
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, plan, owner_id')
      .eq('id', restaurant_id)
      .single()

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
    }

    const currentLevel = getPlanLevel(restaurant.plan || 'free')
    const targetLevel = getPlanLevel(target_plan)

    if (targetLevel <= currentLevel) {
      return NextResponse.json({ error: 'Solo se permite upgrade a un plan superior por este medio' }, { status: 400 })
    }

    // Obtener email del dueño
    const { data: owner } = await supabase.auth.admin.getUserById(restaurant.owner_id)
    const email = owner?.user?.email || 'pago@hichapi.cl'

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://hichapi.com'
    const orderId = `HICHAPI-${restaurant_id.slice(0,8)}-${Date.now()}`

    console.log('[flow/create-subscription] baseUrl:', baseUrl)
    console.log('[flow/create-subscription] urlConfirmation:', `${baseUrl}/api/flow/webhook`)

    // API Flow: /api/payment/create
    const response = await flowRequest<{ url: string; token: string }>('/payment/create', {
      commerceOrder: orderId,
      subject: `Plan ${planConfig.name} - HiChapi`,
      currency: 'CLP',
      amount: planConfig.price,
      email: email,
      paymentMethod: 9, // Todos los medios de pago
      urlConfirmation: `${baseUrl}/api/flow/webhook`,
      urlReturn: `${baseUrl}/modulos?success=true`,
      optional: JSON.stringify({
        restaurant_id: restaurant.id,
        target_plan: target_plan
      })
    })

    console.log('[flow/create-subscription] Flow response token:', response.token)

    return NextResponse.json({ url: `${response.url}?token=${response.token}` })

  } catch (err) {
    console.error('flow create-payment error:', err)
    if (err instanceof Error && err.message.includes('Faltan variables')) {
      return NextResponse.json({ error: 'Falta configurar Flow' }, { status: 500 })
    }
    return NextResponse.json({ error: 'Error al generar link de pago en Flow' }, { status: 500 })
  }
}
