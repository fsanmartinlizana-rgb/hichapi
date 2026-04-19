import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── POST /api/mermas/from-devolucion ─────────────────────────────────────────
// Registra una merma cuando se devuelve un item desde la pantalla de comandas.
//
// Context (bug fixed 2026-04-19):
// Antes este endpoint solo buscaba en stock_items con ilike. Si la devolución
// era un plato ya preparado (ej: "Lomo vetado") no matcheaba, el insert salía
// con stock_item_id=null Y menu_item_id=null → el CHECK waste_log_item_presence
// (stock_item_id IS NOT NULL OR menu_item_id IS NOT NULL) rechazaba el insert
// y la merma no aparecía en /mermas. Además, cuando sí matcheaba por accidente,
// el trigger handle_waste_insert descontaba stock del insumo aunque fuera un
// plato ya preparado → doble resta.
//
// Fix: ahora buscamos primero en menu_items (caso común de devolución desde
// comandas) y marcamos item_type='plato'. Si no matchea, caemos a stock_items
// y marcamos item_type='stock'. Si tampoco, devolvemos error explícito al
// cliente para que muestre un toast claro.

const BodySchema = z.object({
  restaurant_id: z.string().uuid(),
  item_name:     z.string().min(1),
  reason:        z.string().min(1),
  order_id:      z.string().optional(),
  // Opcionales: si el cliente ya tiene los IDs, nos ahorramos el lookup.
  menu_item_id:  z.string().uuid().optional(),
  stock_item_id: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user)
    return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = BodySchema.parse(body)
    const { restaurant_id, item_name, reason, order_id } = parsed

    const supabase = createAdminClient()

    let menu_item_id:  string | null = parsed.menu_item_id  ?? null
    let stock_item_id: string | null = parsed.stock_item_id ?? null
    let cost_lost = 0
    let item_type: 'plato' | 'stock' = 'plato'

    // ── Resolución por nombre si no vinieron IDs ─────────────────────────
    if (!menu_item_id && !stock_item_id) {
      // 1) Intentar match en menu_items (plato). Las devoluciones desde
      //    comandas siempre son de platos ya preparados.
      const menuRes = await supabase
        .from('menu_items')
        .select('id, cost_price')
        .eq('restaurant_id', restaurant_id)
        .ilike('name', item_name)
        .maybeSingle()
      const menuItem = menuRes.data as { id: string; cost_price: number | null } | null

      if (menuItem) {
        menu_item_id = menuItem.id
        cost_lost    = menuItem.cost_price ?? 0
        item_type    = 'plato'
      } else {
        // 2) Fallback: buscar en stock_items (ej: devolución de un insumo
        //    suelto tipo botella de vino que no es un menu_item).
        const stockRes = await supabase
          .from('stock_items')
          .select('id, cost_per_unit')
          .eq('restaurant_id', restaurant_id)
          .ilike('name', item_name)
          .maybeSingle()
        const stockItem = stockRes.data as { id: string; cost_per_unit: number | null } | null

        if (stockItem) {
          stock_item_id = stockItem.id
          cost_lost     = stockItem.cost_per_unit ?? 0
          item_type     = 'stock'
        }
      }
    } else if (menu_item_id) {
      // Cliente nos dio menu_item_id → solo traemos el cost_price
      const menuRes = await supabase
        .from('menu_items')
        .select('cost_price')
        .eq('id', menu_item_id)
        .eq('restaurant_id', restaurant_id)
        .maybeSingle()
      const menuItem = menuRes.data as { cost_price: number | null } | null
      cost_lost = menuItem?.cost_price ?? 0
      item_type = 'plato'
    } else if (stock_item_id) {
      const stockRes = await supabase
        .from('stock_items')
        .select('cost_per_unit')
        .eq('id', stock_item_id)
        .eq('restaurant_id', restaurant_id)
        .maybeSingle()
      const stockItem = stockRes.data as { cost_per_unit: number | null } | null
      cost_lost = stockItem?.cost_per_unit ?? 0
      item_type = 'stock'
    }

    // Si no resolvimos nada, no podemos satisfacer el CHECK constraint.
    if (!menu_item_id && !stock_item_id) {
      return NextResponse.json(
        { error: `No se encontró "${item_name}" en la carta ni en el inventario. Registrá la merma manualmente desde /mermas.` },
        { status: 404 },
      )
    }

    const notes = `Devolución comanda: ${reason}${order_id ? `. Pedido: ${order_id}` : ''}`

    const { error: insertErr } = await supabase.from('waste_log').insert({
      restaurant_id,
      item_type,
      menu_item_id,
      stock_item_id,
      qty_lost: 1,
      reason: 'devolucion',
      notes,
      cost_lost,
      logged_by: user.id,
    })

    if (insertErr) {
      console.error('waste_log insert error:', insertErr)
      return NextResponse.json({ error: 'No se pudo registrar la merma', details: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, item_type })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('mermas/from-devolucion error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
