/**
 * GET  /api/customer/profile — perfil del comensal
 * PATCH /api/customer/profile — actualizar display_name, phone, photo_url
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCustomer } from '@/lib/supabase/auth-guard'
import { getProfile, updateProfile } from '@/lib/customer/customer-service'
import { UpdateCustomerProfileSchema } from '@/lib/customer/schemas'

export async function GET() {
  const { customer, error } = await requireCustomer()
  if (error) return error

  const profile = await getProfile(customer!.id)
  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }
  return NextResponse.json(profile)
}

export async function PATCH(req: NextRequest) {
  const { customer, error } = await requireCustomer()
  if (error) return error

  try {
    const body = await req.json()
    const parsed = UpdateCustomerProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    const updated = await updateProfile(customer!.id, parsed.data)
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
