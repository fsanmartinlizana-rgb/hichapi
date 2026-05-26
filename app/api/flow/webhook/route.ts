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
        optionalData = statusRes.optional as unknown as Record<string, string>
      }
      
      const restaurant_id: string = optionalData.restaurant_id
      const target_plan: string   = optionalData.target_plan
      const invoice_id: string    = optionalData.invoice_id

      if (!restaurant_id) {
        throw new Error('No se encontró restaurant_id en optional data')
      }

      const supabase = createAdminClient()

      // Si viene invoice_id, es un pago de factura pendiente (membresía + comisión)
      if (invoice_id) {
        // 1. Marcar invoice como pagado
        await supabase.from('invoices').update({
          status: 'paid',
          flow_token: token,
          flow_url: null, // ya no se necesita
          paid_at: new Date().toISOString()
        }).eq('id', invoice_id)

        // 2. Reactivar restaurante y setear proximo vencimiento en 30 dias
        const nextBilling = new Date()
        nextBilling.setDate(nextBilling.getDate() + 30)

        await supabase.from('restaurants').update({
          subscription_status: 'active',
          plan_next_billing: nextBilling.toISOString()
        }).eq('id', restaurant_id)
        
        console.log(`[flow/webhook] Factura ${invoice_id} pagada para restaurante ${restaurant_id}`)
      } else {
        // Flujo antiguo / Upfront pago de plan normal (o si quisieran volver al modelo viejo)
        const from_plan = 'free' // Podriamos buscar el viejo, pero dejémoslo simple
        
        const paidAt = new Date()
        const nextBilling = new Date()
        nextBilling.setDate(nextBilling.getDate() + 30)

        // 1. Actualizar plan del restaurante
        const { error: updateErr } = await supabase
          .from('restaurants')
          .update({
            plan: target_plan,
            plan_paid_at: paidAt.toISOString(),
            plan_next_billing: nextBilling.toISOString(),
            subscription_status: 'active'
          })
          .eq('id', restaurant_id)

        if (updateErr) {
          throw updateErr
        }

        console.log('[flow/webhook] Plan actualizado a:', target_plan, 'desde:', from_plan)

        // 2. Registrar el pago en el historial
        const { error: insertErr } = await supabase.from('plan_payments').insert({
          restaurant_id,
          from_plan,
          to_plan:         target_plan,
          amount:          statusRes.amount,
          flow_token:      token,
          flow_order:      statusRes.commerceOrder,
          paid_at:         paidAt.toISOString(),
          next_billing_at: nextBilling.toISOString(),
        })

        if (insertErr) {
          console.warn('[flow/webhook] No se pudo insertar en plan_payments:', insertErr.message)
        }
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
