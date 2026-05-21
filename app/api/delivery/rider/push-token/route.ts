/**
 * PATCH /api/delivery/rider/push-token — register/update Expo push token
 * DELETE /api/delivery/rider/push-token — remove push token (on logout)
 *
 * Requires rider Bearer token auth.
 * Requirements: 3.1
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRider } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const PatchSchema = z.object({
  token: z.string().min(10).max(500),
})

export async function PATCH(req: NextRequest) {
  const { rider, error } = await requireRider()
  if (error || !rider) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'token inválido', details: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error: updateErr } = await supabase
    .from('rider_profiles')
    .update({ expo_push_token: parsed.data.token, updated_at: new Date().toISOString() })
    .eq('id', rider.id)

  if (updateErr) {
    console.error('[push-token] update error:', updateErr)
    return NextResponse.json({ error: 'No se pudo registrar el token' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { rider, error } = await requireRider()
  if (error || !rider) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  await supabase
    .from('rider_profiles')
    .update({ expo_push_token: null, updated_at: new Date().toISOString() })
    .eq('id', rider.id)

  return NextResponse.json({ ok: true })
}
