/**
 * GET  /api/customer/ratings — historial de calificaciones del comensal
 * POST /api/customer/ratings — enviar calificación
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/supabase/auth-guard'
import { submitRating, getRatingsByCustomer } from '@/lib/customer/rating-service'
import { CreateCustomerRatingSchema } from '@/lib/customer/schemas'

export async function GET() {
  const { customer, error } = await requireCustomer()
  if (error) return error

  try {
    const ratings = await getRatingsByCustomer(customer!.id)
    return NextResponse.json(ratings)
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
    const parsed = CreateCustomerRatingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    const rating = await submitRating(customer!.id, parsed.data)
    return NextResponse.json(rating, { status: 201 })
  } catch (err) {
    const e = err as Error & { code?: number }
    if (e.code === 409) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
