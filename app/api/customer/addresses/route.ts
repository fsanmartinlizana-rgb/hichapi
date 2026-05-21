/**
 * GET  /api/customer/addresses — listar direcciones guardadas
 * POST /api/customer/addresses — crear dirección (máx 10)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/supabase/auth-guard'
import { listAddresses, createAddress } from '@/lib/customer/customer-service'
import { CreateSavedAddressSchema } from '@/lib/customer/schemas'

export async function GET() {
  const { customer, error } = await requireCustomer()
  if (error) return error

  try {
    const addresses = await listAddresses(customer!.id)
    return NextResponse.json(addresses)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { customer, error } = await requireCustomer()
  if (error) return error

  try {
    const body = await req.json()
    const parsed = CreateSavedAddressSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    const address = await createAddress(customer!.id, parsed.data)
    return NextResponse.json(address, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    if (msg.includes('Límite de direcciones')) {
      return NextResponse.json({ error: msg }, { status: 422 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
