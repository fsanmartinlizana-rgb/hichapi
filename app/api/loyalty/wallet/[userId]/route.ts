import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'

/**
 * GET /api/loyalty/wallet/[userId]?restaurant_id=…
 * Returns the loyalty wallet for (user, restaurant): program, points, stamps,
 * recent ledger and active coupons. The calling user must match the userId
 * or be a team member of the restaurant.
 */

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await context.params
    const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
    if (!restaurantId) return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })

    const { user, error: authErr } = await requireUser()
    if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = createAdminClient()

    // Authorization: self OR team member of the restaurant
    if (user.id !== userId) {
      const { data: member } = await supabase
        .from('team_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurantId)
        .eq('active', true)
        .maybeSingle()
      if (!member) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { data: program } = await supabase
      .from('loyalty_programs')
      .select('id, name, active, mechanic, stamps_per_reward, points_per_clp, welcome_points')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    if (!program || !program.active) {
      return NextResponse.json({ program: null, points: null, stamps: null, ledger: [], coupons: [] })
    }

    const [{ data: loyalty }, { data: stamps }, { data: ledger }, { data: coupons }] = await Promise.all([
      supabase
        .from('customer_loyalty')
        .select('points_balance, lifetime_points, tier_id, last_visit_at')
        .eq('user_id', userId)
        .eq('program_id', program.id)
        .maybeSingle(),
      supabase
        .from('stamp_cards')
        .select('current_stamps, total_stamps_earned, last_stamp_at')
        .eq('user_id', userId)
        .eq('program_id', program.id)
        .maybeSingle(),
      supabase
        .from('points_ledger')
        .select('id, type, amount, description, created_at')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('customer_coupons')
        .select('id, code, status, issued_at, expires_at, reward:reward_catalog(id, name, type, value)')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active')
        .order('issued_at', { ascending: false }),
    ])

    return NextResponse.json({
      program,
      points: loyalty ?? { points_balance: 0, lifetime_points: 0, tier_id: null, last_visit_at: null },
      stamps: stamps ?? { current_stamps: 0, total_stamps_earned: 0, last_stamp_at: null },
      ledger: ledger ?? [],
      coupons: coupons ?? [],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
