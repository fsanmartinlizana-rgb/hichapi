import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { flowRequest, flowGet } from '@/lib/flow'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const token = formData.get('token') as string

    if (!token) {
      return NextResponse.json({ error: 'Token no recibido' }, { status: 400 })
    }

    // Consultar estado a Flow (getStatus es GET)
    const statusRes = await flowGet<{
      status: number
      amount: number
      optional: string | Record<string, string>
      commerceOrder: string
    }>('/payment/getStatus', { token })

    console.log('[flow/webhook] status:', statusRes.status, 'order:', statusRes.commerceOrder)

    // status 2 = Pagado
    if (statusRes.status === 2) {
      let optionalData: Record<string, string> = {}
      if (typeof statusRes.optional === 'string') {
        optionalData = JSON.parse(statusRes.optional || '{}')
      } else if (typeof statusRes.optional === 'object' && statusRes.optional !== null) {
        optionalData = statusRes.optional
      }
      
      const restaurant_id: string = optionalData.restaurant_id
      const target_plan: string   = optionalData.target_plan

      console.log('[flow/webhook] Pago confirmado → restaurant:', restaurant_id, 'plan:', target_plan)

      if (restaurant_id && target_plan) {
        const supabase = createAdminClient()

        // Leer el plan actual ANTES de cambiarlo
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('plan')
          .eq('id', restaurant_id)
          .single()

        const from_plan = restaurant?.plan || 'free'

        const paidAt      = new Date()
        const nextBilling = new Date(paidAt)
        nextBilling.setDate(nextBilling.getDate() + 30)

        // 1. Actualizar plan + fechas de suscripción.
        // Si las columnas plan_paid_at / plan_next_billing aún no existen
        // (migración pendiente), el update fallará silenciosamente y se reintenta
        // con solo el plan para que al menos el upgrade quede registrado.
        const { error: updateErr } = await supabase
          .from('restaurants')
          .update({
            plan:              target_plan,
            plan_paid_at:      paidAt.toISOString(),
            plan_next_billing: nextBilling.toISOString(),
          })
          .eq('id', restaurant_id)

        if (updateErr) {
          console.warn('[flow/webhook] update con fechas falló, intentando solo plan:', updateErr.message)
          // Fallback: solo actualizar el plan
          await supabase
            .from('restaurants')
            .update({ plan: target_plan })
            .eq('id', restaurant_id)
        }

        console.log('[flow/webhook] Plan actualizado a:', target_plan, 'desde:', from_plan)

        // 2. Registrar el pago en el historial (no crítico — no interrumpe el flujo)
        await supabase.from('plan_payments').insert({
          restaurant_id,
          from_plan,
          to_plan:         target_plan,
          amount:          statusRes.amount,
          flow_token:      token,
          flow_order:      statusRes.commerceOrder,
          paid_at:         paidAt.toISOString(),
          next_billing_at: nextBilling.toISOString(),
        }).catch((e: unknown) => {
          // Si la tabla plan_payments no existe aún (migración pendiente), lo ignoramos.
          // El plan ya quedó actualizado arriba.
          console.warn('[flow/webhook] No se pudo insertar en plan_payments:', e)
        })
      }
    } else {
      console.log('[flow/webhook] Pago NO confirmado, status:', statusRes.status)
    }

    // Flow exige responder un 200 HTTP rápido
    return NextResponse.json({ received: true })

  } catch (err) {
    console.error('[flow/webhook] error:', err)
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 })
  }
}
