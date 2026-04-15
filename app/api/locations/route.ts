import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ── /api/locations ───────────────────────────────────────────────────────────
// CRUD de locales (sucursales) de una marca.
// Todas las operaciones gated por owner/admin del restaurante.

const CreateSchema = z.object({
  restaurant_id:          z.string().uuid(),
  name:                   z.string().min(1).max(120),
  slug:                   z.string().max(120).optional(),
  address:                z.string().max(300).optional(),
  neighborhood:           z.string().max(120).optional(),
  lat:                    z.number().nullish(),
  lng:                    z.number().nullish(),
  phone:                  z.string().max(40).optional(),
  whatsapp_number:        z.string().max(40).optional(),
  share_menu_override:    z.boolean().nullish(),
  share_stock_override:   z.boolean().nullish(),
  share_reports_override: z.boolean().nullish(),
})

const UpdateSchema = z.object({
  id:                     z.string().uuid(),
  restaurant_id:          z.string().uuid(),
  name:                   z.string().min(1).max(120).optional(),
  address:                z.string().max(300).nullish(),
  neighborhood:           z.string().max(120).nullish(),
  phone:                  z.string().max(40).nullish(),
  whatsapp_number:        z.string().max(40).nullish(),
  active:                 z.boolean().optional(),
  sort_order:             z.number().int().optional(),
  share_menu_override:    z.boolean().nullish(),
  share_stock_override:   z.boolean().nullish(),
  share_reports_override: z.boolean().nullish(),
})

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  const brandId      = req.nextUrl.searchParams.get('brand_id')
  if (!restaurantId && !brandId) {
    return NextResponse.json({ error: 'restaurant_id o brand_id requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (restaurantId) {
    const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor'])
    if (authErr) return authErr

    const { data } = await supabase
      .from('locations')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true })
    return NextResponse.json({ locations: data ?? [] })
  }

  // by brand: retornamos todas las locations de la marca
  const { data } = await supabase
    .from('locations')
    .select('*')
    .eq('brand_id', brandId!)
    .order('sort_order', { ascending: true })
  return NextResponse.json({ locations: data ?? [] })
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof CreateSchema>
  try {
    body = CreateSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  // Resolver brand del restaurante (lo creó el backfill del migration 048)
  const { data: rest } = await supabase
    .from('restaurants')
    .select('brand_id')
    .eq('id', body.restaurant_id)
    .maybeSingle()

  if (!rest?.brand_id) {
    return NextResponse.json({ error: 'El restaurante no tiene brand asociada. Aplicá la migration 048 primero.' }, { status: 409 })
  }

  const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const { data, error } = await supabase
    .from('locations')
    .insert({
      brand_id:               rest.brand_id,
      restaurant_id:          body.restaurant_id,
      name:                   body.name,
      slug,
      address:                body.address ?? null,
      neighborhood:           body.neighborhood ?? null,
      lat:                    body.lat ?? null,
      lng:                    body.lng ?? null,
      phone:                  body.phone ?? null,
      whatsapp_number:        body.whatsapp_number ?? null,
      share_menu_override:    body.share_menu_override ?? null,
      share_stock_override:   body.share_stock_override ?? null,
      share_reports_override: body.share_reports_override ?? null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ location: data })
}

export async function PATCH(req: NextRequest) {
  let body: z.infer<typeof UpdateSchema>
  try {
    body = UpdateSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { id, restaurant_id, ...updates } = body

  const { data, error } = await supabase
    .from('locations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurant_id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ location: data })
}

export async function DELETE(req: NextRequest) {
  const id            = req.nextUrl.searchParams.get('id')
  const restaurantId  = req.nextUrl.searchParams.get('restaurant_id')

  if (!id || !restaurantId) {
    return NextResponse.json({ error: 'id y restaurant_id requeridos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  // No permitir borrar la primary_location
  const { data: rest } = await supabase
    .from('restaurants')
    .select('primary_location_id')
    .eq('id', restaurantId)
    .maybeSingle()

  if (rest?.primary_location_id === id) {
    return NextResponse.json({ error: 'No podés borrar el local principal. Cambialo primero.' }, { status: 409 })
  }

  const { error } = await supabase.from('locations').delete().eq('id', id).eq('restaurant_id', restaurantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
