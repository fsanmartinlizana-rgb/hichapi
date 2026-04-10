import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── Schemas ──────────────────────────────────────────────────────────────────

const CreateItemSchema = z.object({
  restaurant_id: z.string().uuid(),
  name:          z.string().min(1).max(100),
  description:   z.string().max(300).optional(),
  price:         z.number().int().min(0),
  category:      z.string().max(60).default('Principal'),
  tags:          z.array(z.string()).default([]),
  available:     z.boolean().default(true),
  cost_price:    z.number().int().min(0).optional(),
  photo_url:     z.string().url().optional(),
  display_order: z.number().int().optional(),
})

const UpdateItemSchema = z.object({
  id:            z.string().uuid(),
  restaurant_id: z.string().uuid(),
  name:          z.string().min(1).max(100).optional(),
  description:   z.string().max(300).optional(),
  price:         z.number().int().min(0).optional(),
  category:      z.string().max(60).optional(),
  tags:          z.array(z.string()).optional(),
  available:     z.boolean().optional(),
  cost_price:    z.number().int().min(0).nullish(),
  photo_url:     z.string().url().nullish(),
  display_order: z.number().int().optional(),
})

const DeleteItemSchema = z.object({
  id:            z.string().uuid(),
  restaurant_id: z.string().uuid(),
})

// ── GET /api/menu-items?restaurant_id=… ──────────────────────────────────────

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('category')
    .order('name')

  if (error) {
    return NextResponse.json({ error: 'Error al consultar' }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] })
}

// ── POST /api/menu-items — create ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = CreateItemSchema.parse(body)

    const supabase = createAdminClient()
    const { data: item, error } = await supabase
      .from('menu_items')
      .insert({
        restaurant_id: data.restaurant_id,
        name:          data.name,
        description:   data.description || null,
        price:         data.price,
        category:      data.category,
        tags:          data.tags,
        available:     data.available,
        cost_price:    data.cost_price || null,
        photo_url:     data.photo_url || null,
        display_order: data.display_order || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Menu item create error:', error)
      return NextResponse.json({ error: 'No se pudo crear el plato' }, { status: 500 })
    }

    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── PATCH /api/menu-items — update ───────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const data = UpdateItemSchema.parse(body)

    const { id, restaurant_id, ...updates } = data

    // Clean undefined values
    const payload: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) payload[k] = v
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: item, error } = await supabase
      .from('menu_items')
      .update(payload)
      .eq('id', id)
      .eq('restaurant_id', restaurant_id)
      .select()
      .single()

    if (error) {
      console.error('Menu item update error:', error)
      return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 })
    }

    return NextResponse.json({ item })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── DELETE /api/menu-items — delete ──────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, restaurant_id } = DeleteItemSchema.parse(body)

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurant_id)

    if (error) {
      console.error('Menu item delete error:', error)
      return NextResponse.json({ error: 'No se pudo eliminar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
