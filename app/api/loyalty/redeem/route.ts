import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser, requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { z } from 'zod'
import { loyaltyCouponEmail } from '@/lib/email/templates'
import { sendBrandedEmail } from '@/lib/email/sender'

/**
 * POST /api/loyalty/redeem
 * Verifies and burns either:
 *   (a) a reward from the catalog by reward_id (deducts points or stamps)
 *   (b) a coupon by code   (owned by this user, active, not expired)
 *   (c) admin "gift" — emite un cupón a un correo (sin deducir puntos/sellos)
 *
 * Server-side verification is mandatory — the client never confirms redemption.
 * Idempotent: coupon.status flips to 'redeemed' before any other side-effect,
 * guarded by a WHERE clause on status='active' so a double-click is a no-op.
 *
 * Body (one of):
 *   { restaurant_id, reward_id, order_id? }                          // catalog reward (deducts)
 *   { restaurant_id, code, order_id? }                               // coupon code
 *   { restaurant_id, reward_id, on_behalf_of: uuid }                 // garzón canjea por cliente
 *   { restaurant_id, reward_id, on_behalf_of_email, on_behalf_of_name? }  // admin GIFT por email
 */

const Schema = z.object({
  restaurant_id:       z.string().uuid(),
  reward_id:           z.string().uuid().optional(),
  code:                z.string().min(4).max(32).optional(),
  order_id:            z.string().uuid().optional(),
  /** When validated by garzón/admin on behalf of a guest, pass the user_id. */
  on_behalf_of:        z.string().uuid().optional(),
  /** Admin gift flow: issue a coupon by email (sin deducir saldo). */
  on_behalf_of_email:  z.string().email().optional(),
  on_behalf_of_name:   z.string().min(1).max(120).optional(),
}).refine(d => !!d.reward_id || !!d.code, {
  message: 'Se requiere reward_id o code',
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = Schema.parse(body)
    const supabase = createAdminClient()

    // ── Path C: admin GIFT by email (no deduction) ──────────────────────────
    if (data.on_behalf_of_email && data.reward_id) {
      const { user: adminUser, error: authErr } = await requireRestaurantRole(
        data.restaurant_id,
        ['owner', 'admin', 'supervisor', 'super_admin'],
      )
      if (authErr || !adminUser) {
        return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }

      const normalizedEmail = data.on_behalf_of_email.trim().toLowerCase()

      // Verify the reward exists & belongs to this restaurant's program
      const { data: program } = await supabase
        .from('loyalty_programs')
        .select('id')
        .eq('restaurant_id', data.restaurant_id)
        .eq('active', true)
        .maybeSingle()
      if (!program) return NextResponse.json({ error: 'Programa no activo' }, { status: 400 })

      const { data: reward } = await supabase
        .from('reward_catalog')
        .select('id, program_id, type, name, description, value, points_cost, stamps_cost, active')
        .eq('id', data.reward_id)
        .eq('program_id', program.id)
        .eq('active', true)
        .maybeSingle()
      if (!reward) return NextResponse.json({ error: 'Recompensa no disponible' }, { status: 400 })

      // Look up existing user_id for that email (via helper RPC on auth.users).
      // If the RPC doesn't exist (migration 045 not applied yet), we fall through
      // with existingUserId = null and still try to issue the coupon.
      let existingUserId: string | null = null
      try {
        const { data: lookup, error: rpcErr } = await supabase
          .rpc('get_user_id_by_email', { p_email: normalizedEmail })
        if (!rpcErr && lookup && typeof lookup === 'string') existingUserId = lookup
      } catch {
        /* RPC missing: non-fatal, proceed */
      }

      // Create the coupon (no deduction — this is a gift).
      // Two-step insert with fallback: new schema (with customer_email/name) first,
      // then legacy schema (user_id-only) if the new columns don't exist yet.
      const code = generateCouponCode()
      const expiresIso = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString()

      let couponId: string | null = null
      let couponCode = code
      let couponExpires: string | null = expiresIso
      let cpErr: { message?: string; code?: string } | null = null

      {
        const { data: couponRow, error } = await supabase
          .from('customer_coupons')
          .insert({
            user_id:        existingUserId,
            restaurant_id:  data.restaurant_id,
            reward_id:      reward.id,
            code,
            status:         'active',
            issued_by:      'admin',
            customer_email: normalizedEmail,
            customer_name:  data.on_behalf_of_name ?? null,
            expires_at:     expiresIso,
          })
          .select('id, code, expires_at')
          .single()
        if (couponRow) {
          couponId = couponRow.id
          couponCode = couponRow.code
          couponExpires = couponRow.expires_at
        } else {
          cpErr = error
        }
      }

      // Fallback: legacy schema without customer_email/name (migration 045 no corrida)
      if (!couponId && cpErr && existingUserId) {
        const { data: legacyRow, error: legacyErr } = await supabase
          .from('customer_coupons')
          .insert({
            user_id:       existingUserId,
            restaurant_id: data.restaurant_id,
            reward_id:     reward.id,
            code,
            status:        'active',
            issued_by:     'admin',
            expires_at:    expiresIso,
          })
          .select('id, code, expires_at')
          .single()
        if (legacyRow) {
          couponId = legacyRow.id
          couponCode = legacyRow.code
          couponExpires = legacyRow.expires_at
          cpErr = null
        } else {
          cpErr = legacyErr
        }
      }

      if (!couponId) {
        const hint = !existingUserId
          ? 'Falta correr la migración 045 (customer_coupons + email). Si el cliente ya tiene cuenta HiChapi, puedes emitirle el cupón normalmente.'
          : 'No se pudo crear el cupón.'
        return NextResponse.json(
          { error: cpErr?.message ?? hint, hint, detail: cpErr?.message ?? null },
          { status: 500 },
        )
      }

      const coupon = { id: couponId, code: couponCode, expires_at: couponExpires }

      // Restaurant name for the email
      const { data: rest } = await supabase
        .from('restaurants')
        .select('name')
        .eq('id', data.restaurant_id)
        .maybeSingle()

      const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
        ?? req.nextUrl.origin
      // Both paths land on /login with the coupon pre-filled. The login page
      // can redirect to a wallet view post-auth; pre-registration users are
      // prompted to create their account (customer flow TBD).
      const claimUrl = `${origin}/login?coupon=${encodeURIComponent(coupon.code)}&email=${encodeURIComponent(normalizedEmail)}`

      const expiresAtFmt = coupon.expires_at
        ? new Date(coupon.expires_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
        : null

      const rewardDetail = reward.description
        ?? (reward.type === 'discount_percent' && typeof reward.value === 'object' && reward.value && 'percent' in reward.value
              ? `Descuento ${(reward.value as { percent: number }).percent}%`
              : undefined)

      const { subject, html, text } = loyaltyCouponEmail({
        restaurantName: rest?.name ?? 'Tu restaurante favorito',
        customerName:   data.on_behalf_of_name,
        rewardName:     reward.name,
        rewardDetail,
        code:           coupon.code,
        expiresAt:      expiresAtFmt,
        claimUrl,
        alreadyUser:    !!existingUserId,
      })

      const mailRes = await sendBrandedEmail({ to: normalizedEmail, subject, html, text })

      return NextResponse.json({
        ok: true,
        via: 'gift_email',
        coupon,
        reward: { id: reward.id, name: reward.name, type: reward.type },
        email_sent: mailRes.ok,
        email_skipped: mailRes.skipped ?? false,
        recipient: { email: normalizedEmail, name: data.on_behalf_of_name ?? null, existing_user: !!existingUserId },
      })
    }

    // Auth: the acting user is:
    //   - an admin/garzón validating someone else's coupon or reward
    //   - an admin/garzón redeeming by user_id (on_behalf_of)
    //   - a regular customer redeeming for themselves
    let actingUserId: string | null = null
    let isTeamMember = false
    if (data.on_behalf_of) {
      const { user, error } = await requireRestaurantRole(
        data.restaurant_id,
        ['owner', 'admin', 'supervisor', 'garzon', 'super_admin'],
      )
      if (error || !user) return error ?? NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      actingUserId = data.on_behalf_of
      isTeamMember = true
    } else if (data.code) {
      // Para cupones por código: intentamos primero validar como team member.
      // Si no es team member, tratamos al acting user como el dueño del cupón.
      const teamCheck = await requireRestaurantRole(
        data.restaurant_id,
        ['owner', 'admin', 'supervisor', 'garzon', 'super_admin'],
      )
      if (!teamCheck.error && teamCheck.user) {
        isTeamMember = true
        actingUserId = teamCheck.user.id
      } else {
        const { user, error } = await requireUser()
        if (error || !user) return error ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        actingUserId = user.id
      }
    } else {
      const { user, error } = await requireUser()
      if (error || !user) return error ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      actingUserId = user.id
    }

    // ── Path A: coupon code ─────────────────────────────────────────────────
    if (data.code) {
      // Team member puede canjear cualquier cupón activo del restaurant;
      // el cliente sólo los suyos (user_id = auth.uid).
      let query = supabase
        .from('customer_coupons')
        .update({
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
          redeemed_order_id: data.order_id ?? null,
        })
        .eq('code', data.code.toUpperCase())
        .eq('restaurant_id', data.restaurant_id)
        .eq('status', 'active')

      if (!isTeamMember && actingUserId) {
        query = query.eq('user_id', actingUserId)
      }

      const { data: coupons, error: cErr } = await query.select('id, reward_id, expires_at')

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
    if (!actingUserId) {
      return NextResponse.json({ error: 'No se pudo determinar el usuario a canjear' }, { status: 400 })
    }
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
