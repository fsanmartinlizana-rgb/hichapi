import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── POST /api/menu-items/bulk ───────────────────────────────────────────────
//
// Inserta múltiples menu_items en una sola llamada.
// Usado por el flujo de "Importar carta" (foto / Excel / PDF).

const ItemSchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(300).nullish(),
  price:       z.number().int().min(0),
  category:    z.string().max(60).default('principal'),
  tags:        z.array(z.string()).default([]),
  available:   z.boolean().default(true),
  photo_url:   z.string().url().nullish(),
})

const BodySchema = z.object({
  restaurant_id: z.string().uuid(),
  items:         z.array(ItemSchema).min(1).max(100),
})

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const { restaurant_id, items } = BodySchema.parse(await req.json())

    const supabase = createAdminClient()
    const rows = items.map(i => ({
      restaurant_id,
      name:        i.name,
      description: i.description || null,
      price:       i.price,
      category:    i.category,
      tags:        i.tags,
      available:   i.available,
      photo_url:   i.photo_url || null,
    }))

    const { data, error } = await supabase
      .from('menu_items')
      .insert(rows)
      .select()

    if (error) {
      console.error('bulk insert error:', error)
      return NextResponse.json({ error: 'No se pudieron crear los platos' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, items: data ?? [], count: (data ?? []).length })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('bulk error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
