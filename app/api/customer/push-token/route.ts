/**
 * POST /api/customer/push-token — registrar token de notificaciones push
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/supabase/auth-guard'
import { updatePushToken, clearPushToken } from '@/lib/customer/customer-service'
import { RegisterPushTokenSchema } from '@/lib/customer/schemas'

export async function POST(req: NextRequest) {
  const { customer, error } = await requireCustomer()
  if (error) return error

  try {
    const body = await req.json()
    const parsed = RegisterPushTokenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    const profile = await updatePushToken(customer!.id, parsed.data)
    return NextResponse.json({ ok: true, push_token: profile.push_token })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** DELETE — desactivar notificaciones push */
export async function DELETE() {
  const { customer, error } = await requireCustomer()
  if (error) return error

  try {
    await clearPushToken(customer!.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
