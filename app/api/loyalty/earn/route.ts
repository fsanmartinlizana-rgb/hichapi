import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { z } from 'zod'

/**
 * POST /api/loyalty/earn
 * Called after a paid order to credit points/stamps to a customer.
 * Multi-tenant: restaurant_id is validated against the user's session and
 * the program.active flag is enforced server-side.
 *
 * Body: { restaurant_id, order_id, amount_clp?, visits? }
 *   - If the program uses "stamps", adds 1 stamp per visit / per order / per threshold.
 *   - If the program uses "points", adds floor(amount_clp * points_per_clp) points.
 *   - Multiplier rules active for today/time are applied.
 *   - Welcome points are granted ONCE per (user, program) — enforced by welcome_granted.
 */

const Schema = z.object({
  restaurant_id: z.string().uuid(),
  order_id:      z.string().uuid().optional(),
  amount_clp:    z.number().int().min(0).optional(),
  visits:        z.number().int().min(1).default(1),
})

function pickActiveMultiplier(
  rules: Array<{ type: string; config: Record<string, unknown>; multiplier_value: number; active: boolean; active_from: string | null; active_to: string | null }>,
  now: Date,
): number {
  const today = now.getDay() // 0 Sun … 6 Sat
  const dowKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today]
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const iso = now.toISOString().slice(0, 10)

  let best = 1
  for (const r of rules) {
    if (!r.active) continue
    if (r.active_from && iso < r.active_from) continue
    if (r.active_to && iso > r.active_to) continue
    if (r.type === 'day_of_week') {
      const cfg = r.config as { days?: string[] }
      if (Array.isArray(cfg.days) && cfg.days.includes(dowKey)) {
        best = Math.max(best, r.multiplier_value)
      }
    } else if (r.type === 'time_range') {
      const cfg = r.config as { from?: string; to?: string }
      if (cfg.from && cfg.to && hhmm >= cfg.from && hhmm <= cfg.to) {
        best = Math.max(best, r.multiplier_value)
      }
    }
  }
  return best
}

export async function POST(req: NextRequest) {
  try {
    const { user, error: authErr } = await requireUser()
    if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const data = Schema.parse(body)

    const supabase = createAdminClient()

    // Load program
    const { data: program, error: pErr } = await supabase
      .from('loyalty_programs')
      .select('*')
      .eq('restaurant_id', data.restaurant_id)
      .eq('active', true)
      .maybeSingle()

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
    if (!program) return NextResponse.json({ error: 'Programa no activo' }, { status: 400 })

    // Idempotency: don't double-credit the same order
    if (data.order_id) {
      const { data: existing } = await supabase
        .from('points_ledger')
        .select('id')
        .eq('order_id', data.order_id)
        .eq('user_id', user.id)
        .limit(1)
      if (existing && existing.length > 0) {
        return NextResponse.json({ ok: true, duplicate: true })
      }
    }

    // Load multiplier rules
    const { data: rules } = await supabase
      .from('multiplier_rules')
      .select('type, config, multiplier_value, active, active_from, active_to')
      .eq('program_id', program.id)
      .eq('active', true)

    const multiplier = pickActiveMultiplier(rules ?? [], new Date())

    // Ensure customer_loyalty row exists (for both mechanics, plus welcome points)
    const { data: cl } = await supabase
      .from('customer_loyalty')
      .select('id, welcome_granted, points_balance, lifetime_points')
      .eq('user_id', user.id)
      .eq('program_id', program.id)
      .maybeSingle()

    let loyaltyId = cl?.id ?? null
    let welcomeGranted = cl?.welcome_granted ?? false
    if (!loyaltyId) {
      const { data: created, error: cErr } = await supabase
        .from('customer_loyalty')
        .insert({
          user_id: user.id,
          program_id: program.id,
          restaurant_id: data.restaurant_id,
          last_visit_at: new Date().toISOString(),
        })
        .select('id, welcome_granted')
        .single()
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
      loyaltyId = created.id
      welcomeGranted = created.welcome_granted
    }

    let totalPointsEarned = 0
    let totalStampsEarned = 0
    const ledgerInserts: Array<{
      user_id: string; program_id: string; restaurant_id: string;
      type: string; amount: number; order_id?: string; description: string;
    }> = []

    // Welcome points — once per (user, program)
    if (!welcomeGranted && program.welcome_points > 0) {
      totalPointsEarned += program.welcome_points
      ledgerInserts.push({
        user_id: user.id,
        program_id: program.id,
        restaurant_id: data.restaurant_id,
        type: 'bonus',
        amount: program.welcome_points,
        description: 'Puntos de bienvenida',
      })
      await supabase.from('customer_loyalty').update({ welcome_granted: true }).eq('id', loyaltyId)
    }

    // Points mechanic
    if ((program.mechanic === 'points' || program.mechanic === 'both') && data.amount_clp && data.amount_clp > 0) {
      const basePoints = Math.floor(data.amount_clp * Number(program.points_per_clp))
      const pts = Math.floor(basePoints * multiplier)
      if (pts > 0) {
        totalPointsEarned += pts
        ledgerInserts.push({
          user_id: user.id,
          program_id: program.id,
          restaurant_id: data.restaurant_id,
          type: 'earn',
          amount: pts,
          order_id: data.order_id,
          description: multiplier > 1
            ? `Orden $${data.amount_clp} · x${multiplier}`
            : `Orden $${data.amount_clp}`,
        })
      }
    }

    // Commit points ledger + update balance
    if (ledgerInserts.length > 0) {
      const { error: lErr } = await supabase.from('points_ledger').insert(ledgerInserts)
      if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })

      const { error: uErr } = await supabase
        .from('customer_loyalty')
        .update({
          points_balance: (cl?.points_balance ?? 0) + totalPointsEarned,
          lifetime_points: (cl?.lifetime_points ?? 0) + totalPointsEarned,
          last_visit_at: new Date().toISOString(),
        })
        .eq('id', loyaltyId)
      if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
    }

    // Stamps mechanic
    if (program.mechanic === 'stamps' || program.mechanic === 'both') {
      let stampsToAdd = 0
      if (program.stamp_trigger === 'per_visit' || program.stamp_trigger === 'per_order') {
        stampsToAdd = data.visits
      } else if (program.stamp_trigger === 'per_amount' && data.amount_clp && program.stamp_amount_threshold) {
        stampsToAdd = Math.floor(data.amount_clp / program.stamp_amount_threshold)
      }
      if (stampsToAdd > 0) {
        totalStampsEarned = stampsToAdd
        const { data: card } = await supabase
          .from('stamp_cards')
          .select('id, current_stamps, total_stamps_earned')
          .eq('user_id', user.id)
          .eq('program_id', program.id)
          .maybeSingle()

        if (card) {
          await supabase.from('stamp_cards').update({
            current_stamps: card.current_stamps + stampsToAdd,
            total_stamps_earned: card.total_stamps_earned + stampsToAdd,
            last_stamp_at: new Date().toISOString(),
          }).eq('id', card.id)
        } else {
          await supabase.from('stamp_cards').insert({
            user_id: user.id,
            program_id: program.id,
            restaurant_id: data.restaurant_id,
            current_stamps: stampsToAdd,
            total_stamps_earned: stampsToAdd,
            last_stamp_at: new Date().toISOString(),
          })
        }
      }
    }

    return NextResponse.json({
      ok: true,
      points_earned: totalPointsEarned,
      stamps_earned: totalStampsEarned,
      multiplier,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
