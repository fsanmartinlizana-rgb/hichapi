import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ItemSchema = z.object({
  restaurant_id:    z.string().uuid(),
  name:             z.string().min(1).max(100),
  unit:             z.enum(['kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja', 'onza']),
  current_qty:      z.number().min(0),
  min_qty:          z.number().min(0).optional().default(0),
  cost_per_unit:    z.number().int().min(0),
  supplier:         z.string().optional(),
  category:         z.string().optional(),
  expiry_date:      z.string().nullish(),          // YYYY-MM-DD
  shelf_life_days:  z.number().int().min(0).nullish(),
})

// GET /api/stock?restaurant_id=xxx — list active stock items grouped by category with KPIs
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

  // Group by category and compute per-item valor_total
  const categories: Record<string, { items: typeof data }> = {}
  let total_inventory_value = 0
  const below_minimum: string[] = []

  for (const item of data ?? []) {
    const valor_total = (item.current_qty ?? 0) * (item.cost_per_unit ?? 0)
    const enriched = { ...item, valor_total }

    const cat = item.category ?? 'Sin categoría'
    if (!categories[cat]) categories[cat] = { items: [] }
    categories[cat].items.push(enriched)

    total_inventory_value += valor_total

    if ((item.current_qty ?? 0) <= (item.min_qty ?? 0)) {
      below_minimum.push(item.id)
    }
  }

  return NextResponse.json({ categories, total_inventory_value, below_minimum })
}

// POST /api/stock — create stock item + initial movement if qty > 0
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const body = ItemSchema.parse(await req.json())
    const { data, error } = await supabase.from('stock_items').insert(body).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (body.current_qty > 0) {
      await supabase.from('stock_movements').insert({
        stock_item_id: data.id,
        restaurant_id: body.restaurant_id,
        delta: body.current_qty,
        reason: 'compra',
      })
    }

    return NextResponse.json({ item: data })
  } catch (err) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
}

// PATCH /api/stock — edit product fields; if current_qty changes, records an ajuste_manual movement
export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const body = await req.json()
    const { id, ...fields } = body

    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    // Never allow updating the id field
    delete fields.id

    // Fetch current product to compare current_qty
    const { data: current } = await supabase
      .from('stock_items')
      .select('current_qty, restaurant_id')
      .eq('id', id)
      .single()

    if (!current) return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })

    const { data, error } = await supabase
      .from('stock_items')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // If current_qty was provided and differs from the stored value, record an ajuste_manual movement
    if (fields.current_qty !== undefined && fields.current_qty !== current.current_qty) {
      const delta = fields.current_qty - (current.current_qty as number)
      await supabase.from('stock_movements').insert({
        restaurant_id: current.restaurant_id,
        stock_item_id: id,
        delta,
        reason: 'ajuste_manual',
      })
    }

    return NextResponse.json({ item: data })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE /api/stock?id=xxx — soft delete if recent movements exist, hard delete otherwise
export async function DELETE(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await supabase
    .from('stock_movements')
    .select('id', { count: 'exact', head: true })
    .eq('stock_item_id', id)
    .gte('logged_at', cutoff)

  if (countError) return NextResponse.json({ error: countError.message }, { status: 400 })

  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from('stock_items')
      .update({ active: false })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, action: 'deactivated' })
  } else {
    const { error } = await supabase
      .from('stock_items')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, action: 'deleted' })
  }
}
