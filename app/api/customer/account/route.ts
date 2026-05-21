/**
 * DELETE /api/customer/account — eliminar cuenta (anonimización)
 *
 * Requiere contraseña para re-autenticación antes de borrar el perfil.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCustomer, requireUser } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/server'
import { deleteAccount } from '@/lib/customer/customer-service'
import { DeleteCustomerAccountSchema } from '@/lib/customer/schemas'

export async function DELETE(req: NextRequest) {
  const { customer, error: customerError } = await requireCustomer()
  if (customerError) return customerError

  const { user, error: userError } = await requireUser()
  if (userError || !user) return userError ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = DeleteCustomerAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: authUser, error: authLookupError } = await admin.auth.admin.getUserById(
      customer!.user_id,
    )
    if (authLookupError || !authUser?.user?.email) {
      return NextResponse.json({ error: 'No se pudo verificar la cuenta' }, { status: 500 })
    }

    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error: signInError } = await anon.auth.signInWithPassword({
      email: authUser.user.email,
      password: parsed.data.password,
    })
    if (signInError) {
      return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
    }

    await deleteAccount(customer!.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
