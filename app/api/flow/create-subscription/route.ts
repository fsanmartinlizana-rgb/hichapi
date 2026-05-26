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
    const { restaurant_id, target_plan, invoice_id } = await req.json()
    if (!restaurant_id || !target_plan) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, plan, owner_id')
      .eq('id', restaurant_id)
      .single()

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
    }

    let amount = 0
    let subject = ''

    if (invoice_id) {
      // Es un pago de factura diferida (membresía + comisión)
      const { data: invoice } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoice_id)
        .single()
        
      if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
      amount = invoice.total_amount
      subject = `Factura HiChapi - ${restaurant.name}`
    } else {
      // Pago normal / upfront
      const PLAN_PRICES: Record<string, number> = {
        starter: 0,
        pro: 59990,
        enterprise: 120000
      }
      amount = PLAN_PRICES[target_plan]
      if (amount === undefined) {
        return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })
      }
      subject = `Plan ${target_plan.toUpperCase()} - HiChapi`
    }

    if (amount === 0) {
      return NextResponse.json({ error: 'Monto inválido para Flow' }, { status: 400 })
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
        target_plan: target_plan,
        invoice_id: invoice_id || undefined,
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
