import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ItemSchema = z.object({
  restaurant_id: z.string().uuid(),
  name:          z.string().min(1).max(100),
  unit:          z.enum(['kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja']),
  current_qty:   z.number().min(0),
  min_qty:       z.number().min(0),
  cost_per_unit: z.number().int().min(0),
  supplier:      z.string().optional(),
  category:      z.string().optional(),
})

// GET /api/stock?restaurant_id=xxx — list all stock items
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const restaurant_id = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('stock_items')
    .select('*')
    .eq('restaurant_id', restaurant_id)
    .eq('active', true)
    .order('category')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ items: data })
}

// POST /api/stock — create stock item
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const body = ItemSchema.parse(await req.json())
    const { data, error } = await supabase.from('stock_items').insert(body).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ item: data })
  } catch (err) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
}

// PATCH /api/stock — adjust qty or update item
export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const body = await req.json()
    const { id, delta, ...fields } = body

    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    if (delta !== undefined) {
      // Qty adjustment
      const { data: current } = await supabase
        .from('stock_items')
        .select('current_qty, restaurant_id')
        .eq('id', id)
        .single()

      if (!current) return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })

      const newQty = Math.max(0, (current.current_qty as number) + delta)

      const { data, error } = await supabase
        .from('stock_items')
        .update({ current_qty: newQty, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      // Log movement
      await supabase.from('stock_movements').insert({
        restaurant_id: current.restaurant_id,
        stock_item_id: id,
        delta,
        reason: body.reason ?? 'ajuste_manual',
        logged_by: body.logged_by ?? null,
      })

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ item: data })
    }

    // Full field update
    const { data, error } = await supabase
      .from('stock_items')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ item: data })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE /api/stock?id=xxx — soft delete
export async function DELETE(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabase
    .from('stock_items')
    .update({ active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
