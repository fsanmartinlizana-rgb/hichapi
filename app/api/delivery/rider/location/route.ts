/**
 * POST /api/delivery/rider/location — record GPS coordinate (every 15s)
 * Requirements: 3.7, 10.7
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRider } from '@/lib/supabase/auth-guard'
import { z } from 'zod'
import { recordRiderLocation } from '@/lib/delivery/geolocation.service'

const LocationSchema = z.object({
  delivery_order_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export async function POST(req: NextRequest) {
  const { rider, error } = await requireRider()
  if (error) return error

  const body = await req.json()
  const parsed = LocationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    await recordRiderLocation(
      rider.id,
      parsed.data.delivery_order_id,
      parsed.data.lat,
      parsed.data.lng,
    )
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 })
  }
}
