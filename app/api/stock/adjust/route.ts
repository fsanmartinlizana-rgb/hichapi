import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const AdjustSchema = z.object({
  stock_item_id: z.string().uuid(),
  delta: z.number().refine((v) => v !== 0, { message: 'delta no puede ser cero' }),
  reason: z.string().optional(),
})

// POST /api/stock/adjust — ajuste manual de stock con delta + razón
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  let body: z.infer<typeof AdjustSchema>
  try {
    body = AdjustSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { stock_item_id, delta, reason } = body

  // Fetch current product to get current_qty and restaurant_id
  const { data: current, error: fetchErr } = await supabase
    .from('stock_items')
    .select('current_qty, restaurant_id')
    .eq('id', stock_item_id)
    .single()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
  }

  const newQty = (current.current_qty as number) + delta

  // Update stock_items.current_qty
  const { data: updatedItem, error: updateErr } = await supabase
    .from('stock_items')
    .update({ current_qty: newQty, updated_at: new Date().toISOString() })
    .eq('id', stock_item_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 })
  }

  // Insert stock_movements record
  const { error: movErr } = await supabase.from('stock_movements').insert({
    stock_item_id,
    restaurant_id: current.restaurant_id,
    delta,
    reason: reason ?? 'ajuste_manual',
  })

  if (movErr) {
    return NextResponse.json({ error: movErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, item: updatedItem })
}
