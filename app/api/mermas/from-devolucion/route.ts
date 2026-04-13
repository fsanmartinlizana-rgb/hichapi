import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const BodySchema = z.object({
  restaurant_id: z.string().uuid(),
  item_name: z.string().min(1),
  reason: z.string().min(1),
  order_id: z.string().optional(),
})

// ── POST /api/mermas/from-devolucion ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user)
    return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const { restaurant_id, item_name, reason, order_id } = BodySchema.parse(body)

    const supabase = createAdminClient()

    // Look up matching stock item by name for this restaurant
    const { data: stockItem } = await supabase
      .from('stock_items')
      .select('id, cost_per_unit')
      .eq('restaurant_id', restaurant_id)
      .ilike('name', item_name)
      .maybeSingle()

    const notes = `Devolución comanda: ${reason}${order_id ? `. Pedido: ${order_id}` : ''}`

    const { error: insertErr } = await supabase.from('waste_log').insert({
      stock_item_id: stockItem?.id ?? null,
      qty_lost: 1,
      reason: 'devolucion',
      notes,
      restaurant_id,
      cost_lost: stockItem?.cost_per_unit ?? 0,
    })

    if (insertErr) {
      console.error('waste_log insert error:', insertErr)
      return NextResponse.json({ error: 'No se pudo registrar la merma' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('mermas/from-devolucion error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
