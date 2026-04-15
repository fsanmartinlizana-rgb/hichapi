import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser, requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { z } from 'zod'

/**
 * POST /api/loyalty/redeem
 * Verifies and burns either:
 *   (a) a reward from the catalog by reward_id (deducts points or stamps)
 *   (b) a coupon by code   (owned by this user, active, not expired)
 *
 * Server-side verification is mandatory — the client never confirms redemption.
 * Idempotent: coupon.status flips to 'redeemed' before any other side-effect,
 * guarded by a WHERE clause on status='active' so a double-click is a no-op.
 *
 * Body (one of):
 *   { restaurant_id, reward_id, order_id? }       // by catalog reward
 *   { restaurant_id, code, order_id? }            // by coupon code
 */

const Schema = z.object({
  restaurant_id: z.string().uuid(),
  reward_id:     z.string().uuid().optional(),
  code:          z.string().min(4).max(32).optional(),
  order_id:      z.string().uuid().optional(),
  /** When validated by garzón/admin on behalf of a guest, pass the user_id. */
  on_behalf_of:  z.string().uuid().optional(),
}).refine(d => !!d.reward_id || !!d.code, {
  message: 'Se requiere reward_id o code',
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = Schema.parse(body)

    // Auth: the acting user is either the customer redeeming for themselves,
    // or an admin/garzón redeeming on behalf of a specific user_id.
    let actingUserId: string
    if (data.on_behalf_of) {
      const { user, error } = await requireRestaurantRole(
        data.restaurant_id,
        ['owner', 'admin', 'supervisor', 'garzon', 'super_admin'],
      )
      if (error || !user) return error ?? NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      actingUserId = data.on_behalf_of
    } else {
      const { user, error } = await requireUser()
      if (error || !user) return error ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      actingUserId = user.id
    }

    const supabase = createAdminClient()

    // ── Path A: coupon code ─────────────────────────────────────────────────
    if (data.code) {
      // Lock via WHERE status='active' — the UPDATE flips only once.
      const { data: coupons, error: cErr } = await supabase
        .from('customer_coupons')
        .update({
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
          redeemed_order_id: data.order_id ?? null,
        })
        .eq('code', data.code)
        .eq('restaurant_id', data.restaurant_id)
        .eq('user_id', actingUserId)
        .eq('status', 'active')
        .select('id, reward_id, expires_at')

      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
      if (!coupons || coupons.length === 0) {
        return NextResponse.json({ error: 'Cupón inválido, expirado o ya canjeado' }, { status: 400 })
      }
      const coupon = coupons[0]
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        // Revert & mark expired
        await supabase.from('customer_coupons').update({ status: 'expired' }).eq('id', coupon.id)
        return NextResponse.json({ error: 'Cupón expirado' }, { status: 400 })
      }

      const { data: reward } = await supabase
        .from('reward_catalog')
        .select('id, type, name, value')
        .eq('id', coupon.reward_id)
        .single()

      return NextResponse.json({ ok: true, via: 'coupon', coupon_id: coupon.id, reward })
    }

    // ── Path B: reward from catalog (deducts points/stamps) ─────────────────
    const { data: program } = await supabase
      .from('loyalty_programs')
      .select('id, mechanic, stamps_per_reward')
      .eq('restaurant_id', data.restaurant_id)
      .eq('active', true)
      .maybeSingle()
    if (!program) return NextResponse.json({ error: 'Programa no activo' }, { status: 400 })

    const { data: reward } = await supabase
      .from('reward_catalog')
      .select('id, program_id, type, name, value, points_cost, stamps_cost, active')
      .eq('id', data.reward_id!)
      .eq('program_id', program.id)
      .eq('active', true)
      .maybeSingle()
    if (!reward) return NextResponse.json({ error: 'Recompensa no disponible' }, { status: 400 })

    // Prefer stamps if the reward defines a stamp cost AND program uses stamps
    if (reward.stamps_cost && (program.mechanic === 'stamps' || program.mechanic === 'both')) {
      const { data: card } = await supabase
        .from('stamp_cards')
        .select('id, current_stamps')
        .eq('user_id', actingUserId)
        .eq('program_id', program.id)
        .maybeSingle()
      if (!card || card.current_stamps < reward.stamps_cost) {
        return NextResponse.json({ error: 'Sellos insuficientes' }, { status: 400 })
      }
      const { error: uErr } = await supabase
        .from('stamp_cards')
        .update({ current_stamps: card.current_stamps - reward.stamps_cost })
        .eq('id', card.id)
        .eq('current_stamps', card.current_stamps) // optimistic lock
      if (uErr) return NextResponse.json({ error: 'Conflicto al canjear sellos' }, { status: 409 })
    } else if (reward.points_cost && (program.mechanic === 'points' || program.mechanic === 'both')) {
      const { data: cl } = await supabase
        .from('customer_loyalty')
        .select('id, points_balance')
        .eq('user_id', actingUserId)
        .eq('program_id', program.id)
        .maybeSingle()
      if (!cl || cl.points_balance < reward.points_cost) {
        return NextResponse.json({ error: 'Puntos insuficientes' }, { status: 400 })
      }
      const { error: uErr } = await supabase
        .from('customer_loyalty')
        .update({ points_balance: cl.points_balance - reward.points_cost })
        .eq('id', cl.id)
        .eq('points_balance', cl.points_balance) // optimistic lock
      if (uErr) return NextResponse.json({ error: 'Conflicto al canjear puntos' }, { status: 409 })

      await supabase.from('points_ledger').insert({
        user_id: actingUserId,
        program_id: program.id,
        restaurant_id: data.restaurant_id,
        type: 'redeem',
        amount: -reward.points_cost,
        order_id: data.order_id ?? null,
        description: `Canje: ${reward.name}`,
      })
    } else {
      return NextResponse.json({ error: 'La recompensa no tiene costo configurado' }, { status: 400 })
    }

    // Issue a one-time coupon so the garzón can validate on the receipt side
    const code = generateCouponCode()
    const { data: coupon, error: cpErr } = await supabase
      .from('customer_coupons')
      .insert({
        user_id: actingUserId,
        restaurant_id: data.restaurant_id,
        reward_id: reward.id,
        code,
        status: 'active',
        issued_by: data.on_behalf_of ? 'garzon' : 'system',
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      })
      .select('id, code, expires_at')
      .single()
    if (cpErr) return NextResponse.json({ error: cpErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, via: 'reward', reward, coupon })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** 10-char mixed alphanumeric coupon code (e.g. CH-K7N3P2Q8M). */
function generateCouponCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no O/0/I/1
  let out = 'CH-'
  const buf = new Uint8Array(10)
  crypto.getRandomValues(buf)
  for (let i = 0; i < 10; i++) out += alphabet[buf[i] % alphabet.length]
  return out
}
