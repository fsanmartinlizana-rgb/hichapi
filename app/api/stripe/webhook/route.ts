import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Lazy init — prevents build-time crash when env vars aren't set
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })
}
function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// POST /api/stripe/webhook
// Handles Stripe events → updates order status + logs payment
export async function POST(req: NextRequest) {
  const stripe   = getStripe()
  const supabase = getSupabase()
  const rawBody  = await req.text()
  const sig      = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Stripe webhook signature failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi       = event.data.object as Stripe.PaymentIntent
    const order_id = pi.metadata?.order_id

    if (order_id) {
      // Log payment transaction
      await supabase.from('payment_transactions').insert({
        order_id,
        stripe_payment_intent_id: pi.id,
        amount:    pi.amount,
        currency:  pi.currency,
        status:    'succeeded',
        split_index: pi.metadata?.split_index ? parseInt(pi.metadata.split_index) : null,
        split_total: pi.metadata?.split_total ? parseInt(pi.metadata.split_total) : null,
      })

      // Check if all splits are paid; if so, mark order as paid
      const splitTotal = pi.metadata?.split_total ? parseInt(pi.metadata.split_total) : 1

      const { count } = await supabase
        .from('payment_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('order_id', order_id)
        .eq('status', 'succeeded')

      if ((count ?? 0) >= splitTotal) {
        await supabase
          .from('orders')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('id', order_id)
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi       = event.data.object as Stripe.PaymentIntent
    const order_id = pi.metadata?.order_id
    if (order_id) {
      await supabase.from('payment_transactions').insert({
        order_id,
        stripe_payment_intent_id: pi.id,
        amount:   pi.amount,
        currency: pi.currency,
        status:   'failed',
      })
    }
  }

  return NextResponse.json({ received: true })
}
