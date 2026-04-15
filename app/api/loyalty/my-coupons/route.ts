import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'

/**
 * GET /api/loyalty/my-coupons
 * Returns all active coupons of the authenticated user across all restaurants.
 * Also auto-claims email-only coupons that match the user's email (via RPC).
 */
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error || !user) return error ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = createAdminClient()

    // Best-effort claim of pending email-only coupons (silent if RPC missing)
    try {
      await supabase.rpc('claim_email_coupons', { p_user_id: user.id })
    } catch { /* RPC not applied yet — continue */ }

    const { data: coupons, error: cErr } = await supabase
      .from('customer_coupons')
      .select(
        'id, code, status, issued_at, expires_at, restaurant_id, ' +
        'reward:reward_catalog(id, name, type, description, value), ' +
        'restaurant:restaurants(id, name, slug)',
      )
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('issued_at', { ascending: false })

    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, coupons: coupons ?? [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
