import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'

/**
 * POST /api/loyalty/claim-coupons
 * Asocia al user_id autenticado los cupones pendientes que fueron emitidos
 * a su correo antes de que se registrara (virtual wallet).
 * Idempotente: sólo toca cupones con user_id IS NULL.
 */
export async function POST(_req: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error || !user) return error ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = createAdminClient()
    const { data, error: rpcErr } = await supabase.rpc('claim_email_coupons', { p_user_id: user.id })

    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })

    const count = typeof data === 'number' ? data : 0
    return NextResponse.json({ ok: true, claimed: count })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
