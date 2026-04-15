import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/restaurants/sucursal
// Crea un nuevo restaurante (sucursal) y asigna al usuario autenticado como
// owner. El usuario debe ser owner/admin de al menos otro restaurante para
// poder crear sucursales (anti-spam).
//
// Si copy_menu_from_id está presente, copia el menú del restaurant de origen
// (útil para sucursales de la misma marca con la misma carta).
// ─────────────────────────────────────────────────────────────────────────────

const BodySchema = z.object({
  name:                 z.string().min(2).max(100),
  address:              z.string().min(2).max(200),
  neighborhood:         z.string().min(2).max(80),
  cuisine_type:         z.string().min(2).max(60).optional(),
  copy_menu_from_id:    z.string().uuid().optional(),
  parent_restaurant_id: z.string().uuid().optional(), // si viene, hereda brand_id de ese restaurant
})

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const { user, error: authErr } = await requireUser()
    if (authErr || !user) {
      return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const data = BodySchema.parse(await req.json())
    const supabase = createAdminClient()

    // Verificar que el user tiene rol owner/admin en al menos un restaurant
    const { data: existing } = await supabase
      .from('team_members')
      .select('role, restaurant_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'super_admin'])

    if (!existing || existing.length === 0) {
      return NextResponse.json(
        {
          error: 'Solo owners o admins pueden crear sucursales. Pedile a tu admin que te dé permiso.',
        },
        { status: 403 },
      )
    }

    // Si pidió copiar menú: verificar que es de un restaurant donde es owner/admin
    if (data.copy_menu_from_id) {
      const allowedRestaurants = existing.map((e: { restaurant_id: string }) => e.restaurant_id)
      if (!allowedRestaurants.includes(data.copy_menu_from_id)) {
        return NextResponse.json(
          { error: 'No podés copiar el menú de un restaurante donde no sos owner/admin.' },
          { status: 403 },
        )
      }
    }

    // Resolver brand_id a heredar (en orden de preferencia):
    //   1. parent_restaurant_id explícito
    //   2. copy_menu_from_id (si está copiando menú, probablemente del mismo grupo)
    //   3. primer restaurant del user que ya tenga brand_id
    const parentRestaurantId = data.parent_restaurant_id ?? data.copy_menu_from_id ?? null
    let inheritedBrandId: string | null = null

    if (parentRestaurantId) {
      // Verificar que el user es owner/admin del parent
      const allowed = existing.map((e: { restaurant_id: string }) => e.restaurant_id)
      if (!allowed.includes(parentRestaurantId)) {
        return NextResponse.json(
          { error: 'No sos owner/admin del restaurante padre.' },
          { status: 403 },
        )
      }
      const { data: parent } = await supabase
        .from('restaurants')
        .select('brand_id')
        .eq('id', parentRestaurantId)
        .maybeSingle()
      inheritedBrandId = (parent as { brand_id?: string | null } | null)?.brand_id ?? null
    }

    // Fallback: primer restaurant del user con brand_id
    if (!inheritedBrandId) {
      const allowedIds = existing.map((e: { restaurant_id: string }) => e.restaurant_id)
      const { data: anyWithBrand } = await supabase
        .from('restaurants')
        .select('brand_id')
        .in('id', allowedIds)
        .not('brand_id', 'is', null)
        .limit(1)
        .maybeSingle()
      inheritedBrandId = (anyWithBrand as { brand_id?: string | null } | null)?.brand_id ?? null
    }

    // Crear restaurante con slug único
    const baseSlug = toSlug(data.name)
    const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`

    const { data: newRest, error: restErr } = await supabase
      .from('restaurants')
      .insert({
        name:         data.name.trim(),
        slug,
        address:      data.address.trim(),
        neighborhood: data.neighborhood.trim(),
        cuisine_type: data.cuisine_type?.trim() ?? null,
        owner_id:     user.id,
        active:       true,
        plan:         'free',
        claimed:      true,
        brand_id:     inheritedBrandId, // ← la clave: se une a la brand existente
      })
      .select('id, slug, name, brand_id')
      .single()

    if (restErr || !newRest) {
      return NextResponse.json(
        { error: `No pudimos crear la sucursal: ${restErr?.message ?? 'unknown'}` },
        { status: 500 },
      )
    }

    // Si no heredó brand (caso edge: usuario sin brand en ningún restaurant) → crear una nueva
    let effectiveBrandId = newRest.brand_id as string | null
    if (!effectiveBrandId) {
      const { data: newBrand } = await supabase
        .from('brands')
        .insert({
          name:       data.name.trim(),
          slug:       `${baseSlug}-brand-${newRest.id.slice(0, 8)}`,
          owner_id:   user.id,
          share_menu: false, share_stock: false, share_reports: true,
        })
        .select('id')
        .single()
      effectiveBrandId = (newBrand as { id?: string } | null)?.id ?? null
      if (effectiveBrandId) {
        await supabase.from('restaurants').update({ brand_id: effectiveBrandId }).eq('id', newRest.id)
      }
    }

    // Crear location bajo la brand + stations default
    let newLocationId: string | null = null
    if (effectiveBrandId) {
      const locSlug = `${toSlug(data.name)}-${Date.now().toString(36).slice(-4)}`
      const { data: newLoc } = await supabase
        .from('locations')
        .insert({
          brand_id:      effectiveBrandId,
          restaurant_id: newRest.id,
          name:          data.name.trim(),
          slug:          locSlug,
          address:       data.address.trim(),
          neighborhood:  data.neighborhood.trim(),
          active:        true,
        })
        .select('id')
        .single()
      newLocationId = (newLoc as { id?: string } | null)?.id ?? null

      if (newLocationId) {
        await supabase.from('restaurants').update({ primary_location_id: newLocationId }).eq('id', newRest.id)
        // Stations default: Cocina + Barra
        await supabase.from('stations').insert([
          { location_id: newLocationId, restaurant_id: newRest.id, name: 'Cocina', kind: 'cocina', sort_order: 1, active: true },
          { location_id: newLocationId, restaurant_id: newRest.id, name: 'Barra',  kind: 'barra',  sort_order: 2, active: true },
        ])
      }
    }

    // Asignar al usuario como owner del nuevo restaurant
    const { error: memErr } = await supabase.from('team_members').insert({
      restaurant_id: newRest.id,
      user_id:       user.id,
      invited_email: user.email ?? '',
      role:          'owner',
      roles:         ['owner', 'admin'],
      status:        'active',
      active:        true,
    })

    if (memErr) {
      console.error('[sucursal] team_members insert error:', memErr.message)
      // Intento sin roles[]
      await supabase.from('team_members').insert({
        restaurant_id: newRest.id,
        user_id:       user.id,
        invited_email: user.email ?? '',
        role:          'owner',
        status:        'active',
        active:        true,
      })
    }

    // Copiar menú si lo pidió
    let copiedItems = 0
    if (data.copy_menu_from_id) {
      const { data: srcItems } = await supabase
        .from('menu_items')
        .select('name, description, price, category, tags, ingredients, destination, available')
        .eq('restaurant_id', data.copy_menu_from_id)

      if (srcItems && srcItems.length > 0) {
        const rows = srcItems.map((it: Record<string, unknown>) => ({
          ...it,
          restaurant_id: newRest.id,
        }))
        for (let i = 0; i < rows.length; i += 50) {
          const chunk = rows.slice(i, i + 50)
          const { error } = await supabase.from('menu_items').insert(chunk)
          if (!error) copiedItems += chunk.length
        }
      }
    }

    return NextResponse.json({
      ok: true,
      restaurant:        newRest,
      brand_id:          effectiveBrandId,
      location_id:       newLocationId,
      inherited_brand:   !!inheritedBrandId,
      copied_menu_items: copiedItems,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('sucursal create error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
