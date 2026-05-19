/**
 * POST /api/delivery/routes — calculate optimal route via Google Maps
 * Requirements: 5.1, 5.6, 5.7, 5.9
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRider } from '@/lib/supabase/auth-guard'
import { z } from 'zod'
import { calculateRoute, generateDeliveryBriefing } from '@/lib/delivery/route-engine.service'
import type { VehicleType } from '@/lib/delivery/types'

const RouteRequestSchema = z.object({
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  pickup:       z.string().min(5).max(300),
  delivery:     z.string().min(5).max(300),
  vehicle_type: z.enum(['bicycle', 'motorcycle', 'car', 'cargo_bike']),
  notes:        z.string().max(500).optional(),
  with_briefing: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  const { rider, error } = await requireRider()
  if (error) return error

  const body = await req.json()
  const parsed = RouteRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { origin, pickup, delivery, vehicle_type, notes, with_briefing } = parsed.data

  console.log('[API ROUTE] POST /api/delivery/routes received:', {
    vehicle_type,
    origin,
    pickup,
    delivery,
  })

  const result = await calculateRoute(origin, pickup, delivery, vehicle_type as VehicleType)

  console.log('[API ROUTE] calculateRoute result:', {
    hasRoute: !!result.route,
    polyline: result.route?.polyline ? result.route.polyline.substring(0, 30) + '...' : 'none',
    fallback: result.fallback,
  })

  let briefing: string | undefined
  if (with_briefing && result.route) {
    briefing = await generateDeliveryBriefing(result.route, pickup, delivery, notes ?? null)
  }

  return NextResponse.json({
    route:    result.route,
    fallback: result.fallback,
    ...(result.fallback && {
      fallback_pickup_address:   result.fallbackPickupAddress,
      fallback_delivery_address: result.fallbackDeliveryAddress,
      fallback_map_link:         `https://maps.google.com/?q=${encodeURIComponent(delivery)}`,
    }),
    ...(briefing && { briefing }),
  })
}
