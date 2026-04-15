import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

/**
 * GET /api/loyalty/coupon-lookup?code=CH-XXXX&restaurant_id=…
 * Preview de un cupón antes de canjearlo. Sólo lo usan garzones/admin.
 * NO consume el cupón. Sólo retorna info para que el garzón confirme.
 */

interface CouponRow {
  id:         string
  code:       string
  status:     string
  issued_at:  string | null
  expires_at: string | null
  redeemed_at: string | null
  user_id:    string | null
  reward:     { id: string; name: string; type: string; description?: string | null; value?: unknown } | null
  customer_email?: string | null
  customer_name?:  string | null
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase()
    const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
    if (!code || !restaurantId) {
      return NextResponse.json({ error: 'code y restaurant_id requeridos' }, { status: 400 })
    }

    const { error: authErr } = await requireRestaurantRole(
      restaurantId,
      ['owner', 'admin', 'supervisor', 'garzon', 'super_admin'],
    )
    if (authErr) return authErr

    const supabase = createAdminClient()

    // Try to select the new email/name columns; fall back if migration 045 isn't applied
    let coupon: CouponRow | null = null
    const extended = await supabase
      .from('customer_coupons')
      .select('id, code, status, issued_at, expires_at, redeemed_at, user_id, customer_email, customer_name, reward:reward_catalog(id, name, type, description, value)')
      .eq('code', code)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    if (!extended.error) {
      coupon = (extended.data as unknown as CouponRow | null)
    } else {
      const legacy = await supabase
        .from('customer_coupons')
        .select('id, code, status, issued_at, expires_at, redeemed_at, user_id, reward:reward_catalog(id, name, type, description, value)')
        .eq('code', code)
        .eq('restaurant_id', restaurantId)
        .maybeSingle()
      if (legacy.error) return NextResponse.json({ error: legacy.error.message }, { status: 500 })
      coupon = (legacy.data as unknown as CouponRow | null)
    }

    if (!coupon) {
      return NextResponse.json({ error: 'Cupón no encontrado en este restaurante' }, { status: 404 })
    }

    const expired = coupon.expires_at ? new Date(coupon.expires_at) < new Date() : false
    const valid = coupon.status === 'active' && !expired

    const customerLabel: string | null =
      coupon.customer_name ?? coupon.customer_email ?? null

    return NextResponse.json({
      ok: true,
      valid,
      expired,
      coupon: {
        id:         coupon.id,
        code:       coupon.code,
        status:     coupon.status,
        issued_at:  coupon.issued_at,
        expires_at: coupon.expires_at,
        redeemed_at: coupon.redeemed_at,
      },
      reward: coupon.reward,
      customer: customerLabel,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
