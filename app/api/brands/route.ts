import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ── /api/brands ──────────────────────────────────────────────────────────────
// GET:   brand del restaurante (o por id directo si super_admin)
// PATCH: toggles dinámicos (share_menu, share_stock, share_reports) + metadata

const UpdateSchema = z.object({
  id:              z.string().uuid(),
  restaurant_id:   z.string().uuid(), // para autorizar
  name:            z.string().min(1).max(200).optional(),
  description:     z.string().nullish(),
  logo_url:        z.string().nullish(),
  primary_color:   z.string().max(20).nullish(),
  share_menu:      z.boolean().optional(),
  share_stock:     z.boolean().optional(),
  share_reports:   z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  const { data: rest } = await supabase
    .from('restaurants')
    .select('brand_id, primary_location_id')
    .eq('id', restaurantId)
    .maybeSingle()

  if (!rest?.brand_id) {
    return NextResponse.json({ brand: null, effective: null })
  }

  const { data: brand } = await supabase
    .from('brands')
    .select('*')
    .eq('id', rest.brand_id)
    .maybeSingle()

  // También consulta la config efectiva resuelta (brand + location override)
  let effective = null
  try {
    const { data } = await supabase.rpc('effective_sharing_config', { p_restaurant_id: restaurantId })
    effective = Array.isArray(data) ? data[0] : data
  } catch { /* helper no existe aún si migration no aplicada */ }

  return NextResponse.json({ brand, effective })
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

  // Seguridad extra: el brand_id que intenta editar tiene que matchear con el del restaurant
  const { data: rest } = await supabase
    .from('restaurants')
    .select('brand_id')
    .eq('id', body.restaurant_id)
    .maybeSingle()

  if (!rest?.brand_id || rest.brand_id !== body.id) {
    return NextResponse.json({ error: 'Brand no pertenece al restaurante' }, { status: 403 })
  }

  const { id, restaurant_id, ...updates } = body

  const { data, error } = await supabase
    .from('brands')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ brand: data })
}
