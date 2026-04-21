import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ══════════════════════════════════════════════════════════════════════════════
//  GET / PATCH /api/restaurants/profile
//  Reads + updates the public profile fields shown on /r/[slug].
//  Profile completion score is recomputed server-side on every PATCH so the
//  admin badge stays consistent with what the landing actually exposes.
// ══════════════════════════════════════════════════════════════════════════════

const HoursSchema = z.record(
  z.string(),
  z.object({
    open:   z.string().regex(/^\d{2}:\d{2}$/),
    close:  z.string().regex(/^\d{2}:\d{2}$/),
    closed: z.boolean(),
  }),
)

const ProfilePatchSchema = z.object({
  restaurant_id: z.string().uuid(),
  name:          z.string().min(2).max(80).optional(),
  description:   z.string().max(500).nullable().optional(),
  address:       z.string().max(200).nullable().optional(),
  neighborhood:  z.string().max(80).nullable().optional(),
  phone:         z.string().max(30).nullable().optional(),
  website:       z.string().max(200).nullable().optional(),
  instagram:     z.string().max(80).nullable().optional(),
  cuisine_type:  z.string().max(80).nullable().optional(),
  price_range:   z.enum(['$', '$$', '$$$', 'economico', 'medio', 'premium']).nullable().optional(),
  capacity:      z.number().int().min(0).max(2000).nullable().optional(),
  tags:          z.array(z.string().max(40)).max(20).optional(),
  hours:         HoursSchema.optional(),
  photo_url:     z.string().url().nullable().optional(),
  gallery_urls:  z.array(z.string().url()).max(12).optional(),
  // Reservation settings
  reservations_enabled:      z.boolean().optional(),
  reservation_timeout_min:   z.number().int().min(1).max(120).optional(),
  reservation_slot_duration: z.number().int().min(15).max(360).optional(),
  reservation_max_party:     z.number().int().min(1).max(50).optional(),
  reservation_advance_days:  z.number().int().min(1).max(90).optional(),
  // DTE / SII fields
  rut:          z.string().max(20).nullable().optional(),
  razon_social: z.string().max(200).nullable().optional(),
  giro:         z.string().max(200).nullable().optional(),
  direccion:    z.string().max(200).nullable().optional(),
  comuna:       z.string().max(80).nullable().optional(),
  acteco:       z.string().max(20).nullable().optional(),
})

// ── Profile completion score ─────────────────────────────────────────────────
//
// Returns 0–100 + a per-field breakdown so the admin UI can highlight the
// missing pieces. Keep this list in sync with the badges rendered on the
// admin profile page.

export interface ProfileScore {
  total:  number
  fields: { key: string; label: string; complete: boolean; weight: number }[]
}

export function computeProfileScore(r: Record<string, unknown>): ProfileScore {
  const has = (v: unknown) => v !== null && v !== undefined && String(v).trim().length > 0
  const arr = (v: unknown) => Array.isArray(v) && v.length > 0

  const fields = [
    { key: 'name',         label: 'Nombre',          complete: has(r.name),                          weight: 10 },
    { key: 'description',  label: 'Descripción',     complete: has(r.description),                   weight: 15 },
    { key: 'photo_url',    label: 'Foto principal',  complete: has(r.photo_url),                     weight: 15 },
    { key: 'address',      label: 'Dirección',       complete: has(r.address),                       weight: 10 },
    { key: 'phone',        label: 'Teléfono',        complete: has(r.phone),                         weight: 10 },
    { key: 'cuisine_type', label: 'Tipo de cocina',  complete: has(r.cuisine_type),                  weight: 10 },
    { key: 'price_range',  label: 'Rango de precios',complete: has(r.price_range),                   weight: 5  },
    { key: 'hours',        label: 'Horarios',        complete: r.hours != null && Object.keys(r.hours as object).length > 0, weight: 10 },
    { key: 'tags',         label: 'Tags / Ambiente', complete: arr(r.tags),                          weight: 10 },
    { key: 'instagram',    label: 'Instagram',       complete: has(r.instagram),                     weight: 5  },
  ]

  const total = fields
    .filter(f => f.complete)
    .reduce((sum, f) => sum + f.weight, 0)

  return { total, fields }
}

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select(`
      id, name, slug, description, address, neighborhood, phone, website, instagram,
      cuisine_type, price_range, capacity, tags, hours, photo_url, gallery_urls,
      profile_score, profile_updated_at, claimed,
      reservations_enabled, reservation_timeout_min, reservation_slot_duration,
      reservation_max_party, reservation_advance_days,
      rut, razon_social, giro, direccion, comuna, acteco
    `)
    .eq('id', restaurantId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }

  const score = computeProfileScore(data as Record<string, unknown>)
  return NextResponse.json({ restaurant: data, score })
}

// ── PATCH ───────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  let body: z.infer<typeof ProfilePatchSchema>
  try {
    body = ProfilePatchSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin'])
  if (authErr) return authErr

  // Build update payload (only fields the caller actually sent)
  const update: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (k === 'restaurant_id') continue
    if (v !== undefined) update[k] = v
  }

  // Recompute score from the merged record
  const supabase = createAdminClient()
  const { data: current } = await supabase
    .from('restaurants')
    .select('name, description, address, phone, cuisine_type, price_range, hours, tags, instagram, photo_url')
    .eq('id', body.restaurant_id)
    .single()

  const merged = { ...(current ?? {}), ...update }
  const score  = computeProfileScore(merged)
  update.profile_score      = score.total
  update.profile_updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('restaurants')
    .update(update)
    .eq('id', body.restaurant_id)
    .select(`
      id, name, slug, description, address, neighborhood, phone, website, instagram,
      cuisine_type, price_range, capacity, tags, hours, photo_url, gallery_urls,
      profile_score, profile_updated_at, claimed,
      reservations_enabled, reservation_timeout_min, reservation_slot_duration,
      reservation_max_party, reservation_advance_days,
      rut, razon_social, giro, direccion, comuna, acteco
    `)
    .single()

  if (error || !data) {
    console.error('Error updating restaurant profile:', error)
    return NextResponse.json({ 
      error: 'No se pudo guardar', 
      details: error?.message || 'Unknown error',
      code: error?.code || 'UNKNOWN'
    }, { status: 500 })
  }

  return NextResponse.json({ restaurant: data, score })
}
