import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BodySchema = z.object({
  order_id:    z.string().uuid(),
  split_count: z.number().int().min(1).max(20).default(1),
})

// POST /api/stripe/create-payment-intent
// Creates 1 or N PaymentIntents for an order (split payments)
export async function POST(req: NextRequest) {
  try {
    const { order_id, split_count } = BodySchema.parse(await req.json())

    // Fetch order total
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, total, restaurant_id, restaurants(name)')
      .eq('id', order_id)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    if (order.total <= 0) {
      return NextResponse.json({ error: 'Total inválido' }, { status: 400 })
    }

    const perPerson = Math.ceil(order.total / split_count)

    // Create N PaymentIntents (one per split part)
    const intents = await Promise.all(
      Array.from({ length: split_count }, (_, i) =>
        stripe.paymentIntents.create({
          amount: perPerson, // amount in lowest denomination (CLP = no decimals, amount = CLP value)
          currency: 'clp',
          metadata: {
            order_id,
            split_index:  String(i + 1),
            split_total:  String(split_count),
            restaurant:   (order.restaurants as unknown as { name: string })?.name ?? '',
          },
          description: `HiChapi · Orden ${order_id.slice(-6)} · ${split_count > 1 ? `Parte ${i + 1}/${split_count}` : 'Pago completo'}`,
        })
      )
    )

    return NextResponse.json({
      payment_intents: intents.map(pi => ({
        id:            pi.id,
        client_secret: pi.client_secret,
        amount:        pi.amount,
      })),
      per_person: perPerson,
      total:      order.total,
      split_count,
    })

  } catch (err) {
    console.error('create-payment-intent error:', err)
    return NextResponse.json({ error: 'Error al crear pago' }, { status: 500 })
  }
}
