import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  // Asegurar que solo pueda ser llamado por Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date()

  // 1. Obtener restaurantes activos o en trial
  const { data: restaurants, error: restErr } = await supabase
    .from('restaurants')
    .select('id, plan, trial_ends_at, plan_next_billing, subscription_status')
    .in('subscription_status', ['active', 'trialing'])

  if (restErr || !restaurants) {
    return NextResponse.json({ error: 'Error fetching restaurants' })
  }

  const billedList = []

  for (const restaurant of restaurants) {
    let shouldBill = false
    let periodStart = new Date()

    if (restaurant.subscription_status === 'trialing' && restaurant.trial_ends_at) {
      const endsAt = new Date(restaurant.trial_ends_at)
      if (endsAt <= today) {
        shouldBill = true
        periodStart = new Date(endsAt)
        periodStart.setDate(periodStart.getDate() - 30)
      }
    } else if (restaurant.subscription_status === 'active' && restaurant.plan_next_billing) {
      const endsAt = new Date(restaurant.plan_next_billing)
      if (endsAt <= today) {
        shouldBill = true
        periodStart = new Date(endsAt)
        periodStart.setDate(periodStart.getDate() - 30)
      }
    }

    if (!shouldBill) continue

    // Si es plan gratis, no le facturamos
    if (restaurant.plan === 'free') {
      // Bloquear si el trial expiró y era plan gratis (aunque en teoria en free no hay trial)
      continue
    }

    // Calcular suma de ventas en tabla orders
    const { data: orders } = await supabase
      .from('orders')
      .select('total')
      .eq('restaurant_id', restaurant.id)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', today.toISOString())
      // Ignorar orders canceladas o pendientes de pago no cerrado
      .neq('status', 'cancelled')

    const salesTotal = (orders || []).reduce((acc: number, o: any) => acc + (o.total || 0), 0)
    
    // Config de precios base 
    const PLAN_PRICES: Record<string, number> = {
      starter: 0,
      pro: 59990,
      enterprise: 120000
    }
    const planBasePrice = PLAN_PRICES[restaurant.plan || 'pro'] || 59990

    // Comisión del 1%
    const salesCommission = Math.round(salesTotal * 0.01)
    const totalAmount = planBasePrice + salesCommission

    // 1. Bloquear restaurante (past_due)
    await supabase.from('restaurants').update({
      subscription_status: 'past_due'
    }).eq('id', restaurant.id)

    // 2. Crear factura pendiente
    const { data: invoice, error: invoiceErr } = await supabase.from('invoices').insert({
      restaurant_id: restaurant.id,
      period_start: periodStart.toISOString(),
      period_end: today.toISOString(),
      plan_base_price: planBasePrice,
      sales_total: salesTotal,
      sales_commission: salesCommission,
      total_amount: totalAmount,
      status: 'pending'
    }).select('id').single()

    if (invoice && !invoiceErr) {
      billedList.push({
        restaurant_id: restaurant.id,
        invoice_id: invoice.id,
        total: totalAmount
      })
      // Aquí idealmente se enviaría un correo notificando al cliente de su nueva boleta
    }
  }

  return NextResponse.json({ processed: true, billed: billedList })
}
