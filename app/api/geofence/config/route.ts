import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole, requirePlan } from '@/lib/supabase/auth-guard'

// ── /api/geofence/config ────────────────────────────────────────────────────
// Gestión del geofence del restaurant (feature enterprise).
// GET    ?restaurant_id=X → devuelve lat/lng/radius/enabled + últimos 20 eventos
// PATCH  body: { restaurant_id, lat?, lng?, radius_m?, enabled? }

const PatchSchema = z.object({
  restaurant_id: z.string().uuid(),
  lat:           z.number().min(-90).max(90).nullable().optional(),
  lng:           z.number().min(-180).max(180).nullable().optional(),
  radius_m:      z.number().int().min(20).max(2000).optional(),
  enabled:       z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data: rest } = await supabase
    .from('restaurants')
    .select('geofence_lat, geofence_lng, geofence_radius_m, geofence_enabled')
    .eq('id', restaurantId)
    .maybeSingle()

  const { data: events } = await supabase
    .from('geofence_events')
    .select('id, lat, lng, within_radius, distance_m, trigger_source, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ config: rest ?? {}, events: events ?? [] })
}

export async function PATCH(req: NextRequest) {
  let body: z.infer<typeof PatchSchema>
  try {
    body = PatchSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin'])
  if (authErr) return authErr
  const { error: planErr } = await requirePlan(body.restaurant_id, 'enterprise')
  if (planErr) return planErr

  const supabase = createAdminClient()
  const updates: Record<string, unknown> = {}
  if (body.lat !== undefined)      updates.geofence_lat = body.lat
  if (body.lng !== undefined)      updates.geofence_lng = body.lng
  if (body.radius_m !== undefined) updates.geofence_radius_m = body.radius_m
  if (body.enabled !== undefined)  updates.geofence_enabled = body.enabled

  const { error } = await supabase.from('restaurants').update(updates).eq('id', body.restaurant_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
