/**
 * PATCH  /api/customer/addresses/[id] — actualizar dirección
 * DELETE /api/customer/addresses/[id] — eliminar dirección
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/supabase/auth-guard'
import { updateAddress, deleteAddress } from '@/lib/customer/customer-service'
import { UpdateSavedAddressSchema } from '@/lib/customer/schemas'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { customer, error } = await requireCustomer()
  if (error) return error

  const { id } = await params

  try {
    const body = await req.json()
    const parsed = UpdateSavedAddressSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    const address = await updateAddress(customer!.id, id, parsed.data)
    return NextResponse.json(address)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    if (msg.includes('no encontrada')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { customer, error } = await requireCustomer()
  if (error) return error

  const { id } = await params

  try {
    await deleteAddress(customer!.id, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    if (msg.includes('no encontrada')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
