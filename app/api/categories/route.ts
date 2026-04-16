import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole, requireUser } from '@/lib/supabase/auth-guard'

// ── /api/categories ──────────────────────────────────────────────────────────
// CRUD de menu_categories. Las categorías pueden ser por brand (compartidas
// entre todos los locales de la marca) o por restaurant específico.
// Siempre escribimos con brand_id cuando tenemos brand disponible para que
// sean compartidas por default.

const CreateSchema = z.object({
  restaurant_id:   z.string().uuid(),
  name:            z.string().min(1).max(80),
  slug:            z.string().max(80).optional(),
  icon:            z.string().max(40).nullish(),
  sort_order:      z.number().int().optional(),
  // Si true, escribe con brand_id (compartida). Si false, solo restaurant_id.
  shared_in_brand: z.boolean().default(true),
})

const UpdateSchema = z.object({
  id:              z.string().uuid(),
  restaurant_id:   z.string().uuid(),
  name:            z.string().min(1).max(80).optional(),
  icon:            z.string().max(40).nullish(),
  sort_order:      z.number().int().optional(),
  active:          z.boolean().optional(),
})

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  const brandId      = req.nextUrl.searchParams.get('brand_id')

  if (!restaurantId && !brandId) {
    return NextResponse.json({ error: 'restaurant_id o brand_id requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Query por brand_id: trae categorías compartidas (brand_id=X) + propias
  // de cualquier restaurant de la brand.
  if (brandId && !restaurantId) {
    const { user, error: userErr } = await requireUser()
    if (userErr || !user) return userErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: isSuper } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .eq('active', true)
      .limit(1)

    if (!isSuper || isSuper.length === 0) {
      const { data: memberships } = await supabase
        .from('team_members')
        .select('restaurants(brand_id)')
        .eq('user_id', user.id)
        .eq('active', true)
      const hasBrandAccess = ((memberships ?? []) as { restaurants: { brand_id: string | null } | null }[])
        .some(m => m.restaurants?.brand_id === brandId)
      if (!hasBrandAccess) {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
      }
    }

    const { data } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('brand_id', brandId)
      .order('sort_order', { ascending: true })
    return NextResponse.json({ categories: data ?? [] })
  }

  // Query por restaurant_id: trae las del restaurant Y las compartidas de su brand
  const { error: authErr } = await requireRestaurantRole(restaurantId!, ['owner', 'admin', 'supervisor'])
  if (authErr) return authErr

  const { data: rest } = await supabase
    .from('restaurants')
    .select('brand_id')
    .eq('id', restaurantId!)
    .maybeSingle()

  const query = supabase
    .from('menu_categories')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data } = rest?.brand_id
    ? await query.or(`restaurant_id.eq.${restaurantId},brand_id.eq.${rest.brand_id}`)
    : await query.eq('restaurant_id', restaurantId!)

  return NextResponse.json({ categories: data ?? [] })
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

  const { data: rest } = await supabase
    .from('restaurants')
    .select('brand_id')
    .eq('id', body.restaurant_id)
    .maybeSingle()

  const slug = body.slug ?? slugify(body.name)

  const { data, error } = await supabase
    .from('menu_categories')
    .insert({
      brand_id:      body.shared_in_brand ? (rest?.brand_id ?? null) : null,
      restaurant_id: body.shared_in_brand && rest?.brand_id ? null : body.restaurant_id,
      name:          body.name,
      slug,
      icon:          body.icon ?? null,
      sort_order:    body.sort_order ?? 0,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ category: data })
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
  const { id, restaurant_id: _rest, ...updates } = body
  void _rest

  const { data, error } = await supabase
    .from('menu_categories')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ category: data })
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
  const { error } = await supabase.from('menu_categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
