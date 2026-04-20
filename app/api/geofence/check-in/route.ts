import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { haversineMeters } from '@/lib/geofence'

// ── POST /api/geofence/check-in ─────────────────────────────────────────────
// Endpoint público (sin auth) que valida si una coordenada está dentro del
// geofence de un restaurant. Se llama desde la página pública del restaurant
// cuando el visitante da permiso de ubicación.
//
// Sprint 6 (2026-04-19).

const BodySchema = z.object({
  restaurant_id: z.string().uuid(),
  lat:           z.number().min(-90).max(90),
  lng:           z.number().min(-180).max(180),
  accuracy_m:    z.number().min(0).max(100000).optional(),
  source:        z.enum(['menu_open','qr_scan','check_in','other']).default('menu_open'),
  session_id:    z.string().max(80).optional(),
})

export async function POST(req: NextRequest) {
  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: rest } = await supabase
    .from('restaurants')
    .select('geofence_enabled, geofence_lat, geofence_lng, geofence_radius_m')
    .eq('id', body.restaurant_id)
    .maybeSingle()

  const r = rest as {
    geofence_enabled: boolean
    geofence_lat: number | null
    geofence_lng: number | null
    geofence_radius_m: number | null
  } | null

  if (!r || !r.geofence_enabled || r.geofence_lat == null || r.geofence_lng == null) {
    return NextResponse.json({ enabled: false })
  }

  const distance = haversineMeters(body.lat, body.lng, r.geofence_lat, r.geofence_lng)
  const within = distance <= (r.geofence_radius_m ?? 150)

  // Audit log (fire and forget)
  void supabase.from('geofence_events').insert({
    restaurant_id:  body.restaurant_id,
    lat:            body.lat,
    lng:            body.lng,
    accuracy_m:     body.accuracy_m ?? null,
    within_radius:  within,
    distance_m:     Math.round(distance),
    trigger_source: body.source,
    user_agent:     req.headers.get('user-agent')?.slice(0, 400) ?? null,
    session_id:     body.session_id ?? null,
  })

  return NextResponse.json({
    enabled:       true,
    within_radius: within,
    distance_m:    Math.round(distance),
    radius_m:      r.geofence_radius_m ?? 150,
  })
}
