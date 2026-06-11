import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'
import { buildWasteSummary, type WasteRow } from '@/lib/mermas/summary'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const MermaSchema = z.object({
  restaurant_id: z.string().uuid(),
  stock_item_id: z.string().uuid(),
  qty_lost: z.number().positive(),
  reason: z.enum([
    'vencimiento', 'deterioro', 'rotura', 'error_prep', 'sobras',
    'merma', 'perdida', 'otro',
  ]),
  notes: z.string().optional(),
})

// GET /api/mermas?restaurant_id=&from_date=&to_date= — lista mermas con resumen semanal
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const { searchParams } = req.nextUrl
  const restaurant_id = searchParams.get('restaurant_id')
  if (!restaurant_id) return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })

  const from_date = searchParams.get('from_date') ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const to_date = searchParams.get('to_date') ?? new Date().toISOString()

  const supabase = getSupabaseClient()
  // Incluimos TODAS las mermas (stock Y platos). Las devoluciones desde comandas
  // se registran con item_type='plato' (bug 2026-06: el filtro item_type='stock'
  // las excluía del contador aunque sí se guardaban en waste_log).
  const { data: entries, error } = await supabase
    .from('waste_log')
    .select('id, stock_item_id, menu_item_id, item_type, qty_lost, reason, cost_lost, logged_at, stock_items(name, unit), menu_items(name)')
    .eq('restaurant_id', restaurant_id)
    .gte('logged_at', from_date)
    .lte('logged_at', to_date)
    .order('logged_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Resumen semanal: agrupa stock + platos (devoluciones). Ver lib/mermas/summary.
  const summary = buildWasteSummary((entries ?? []) as WasteRow[])

  return NextResponse.json({
    entries: entries ?? [],
    summary,
  })
}

// POST /api/mermas — registra una merma de stock
export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: z.infer<typeof MermaSchema>
  try {
    body = MermaSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { restaurant_id, stock_item_id, qty_lost, reason, notes } = body

  const supabase = getSupabaseClient()
  // Verify the stock item belongs to this restaurant
  const { data: item, error: itemErr } = await supabase
    .from('stock_items')
    .select('id, cost_per_unit, active')
    .eq('id', stock_item_id)
    .eq('restaurant_id', restaurant_id)
    .single()

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }
  if (!item.active) {
    return NextResponse.json({ error: 'El producto está inactivo' }, { status: 400 })
  }

  // Insert into waste_log — the trigger handle_waste_insert will deduct stock and compute cost_lost
  const { data, error } = await supabase.from('waste_log').insert({
    restaurant_id,
    stock_item_id,
    item_type: 'stock',
    qty_lost,
    reason,
    notes: notes ?? null,
    logged_by: user.id,
  }).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, merma: data })
}
