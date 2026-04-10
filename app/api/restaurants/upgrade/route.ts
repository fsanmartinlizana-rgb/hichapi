import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PLAN_HIERARCHY, PLANS, getPlanLevel } from '@/lib/plans'

const UpgradeSchema = z.object({
  restaurant_id: z.string().uuid(),
  target_plan:   z.enum(['free', 'starter', 'pro', 'enterprise']),
})

// ── POST /api/restaurants/upgrade ────────────────────────────────────────────
// Upgrade a restaurant's plan (MVP: instant activation, no payment)
// In production, this would integrate with Stripe Subscriptions

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { restaurant_id, target_plan } = UpgradeSchema.parse(body)

    const supabase = createAdminClient()

    // 1. Get current restaurant plan
    const { data: restaurant, error: findErr } = await supabase
      .from('restaurants')
      .select('id, name, plan')
      .eq('id', restaurant_id)
      .single()

    if (findErr || !restaurant) {
      return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
    }

    const currentLevel = getPlanLevel(restaurant.plan || 'free')
    const targetLevel = getPlanLevel(target_plan)

    // 2. Validate upgrade direction
    if (targetLevel <= currentLevel) {
      return NextResponse.json(
        { error: 'Solo se permite upgrade a un plan superior' },
        { status: 400 }
      )
    }

    // 3. Validate plan exists
    if (!PLAN_HIERARCHY.includes(target_plan)) {
      return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })
    }

    // 4. Update plan (MVP: instant, no payment integration yet)
    const { error: updateErr } = await supabase
      .from('restaurants')
      .update({ plan: target_plan })
      .eq('id', restaurant_id)

    if (updateErr) {
      console.error('Plan upgrade error:', updateErr)
      return NextResponse.json({ error: 'No se pudo actualizar el plan' }, { status: 500 })
    }

    // 5. Log the upgrade for tracking
    await supabase.from('plan_changes').insert({
      restaurant_id,
      from_plan: restaurant.plan || 'free',
      to_plan: target_plan,
      price: PLANS[target_plan]?.price || 0,
    }).then(() => {}).catch(() => {})  // Best-effort logging

    return NextResponse.json({
      success: true,
      restaurant_id,
      previous_plan: restaurant.plan || 'free',
      new_plan: target_plan,
      price: PLANS[target_plan]?.price || 0,
      message: `Plan actualizado a ${PLANS[target_plan]?.name}`,
    })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('Upgrade route error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
