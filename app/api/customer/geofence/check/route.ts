/**
 * POST /api/customer/geofence/check — verificar proximidad a restaurantes (app móvil)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireCustomer } from '@/lib/supabase/auth-guard'
import { checkGeofences, recordEvent } from '@/lib/customer/geofence-service'

const Schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export async function POST(req: NextRequest) {
  const { customer, error } = await requireCustomer()
  if (error) return error

  try {
    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    const result = await checkGeofences(
      customer!.id,
      parsed.data.lat,
      parsed.data.lng,
    )

    for (const restaurant of result.eligible) {
      await recordEvent(customer!.id, restaurant.restaurant_id, true)
    }

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
