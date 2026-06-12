import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveWasteItem } from '@/lib/mermas/resolve'

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
    // Traemos la carta + inventario completos y matcheamos en JS. Antes se
    // usaba ilike + .maybeSingle(), que tiraba error (silenciado) si había
    // nombres duplicados, y era sensible a espacios/mayúsculas. Ver
    // lib/mermas/resolve (con tests).
    if (!menu_item_id && !stock_item_id) {
      const [menuRes, stockRes] = await Promise.all([
        supabase.from('menu_items').select('id, name, cost_price').eq('restaurant_id', restaurant_id),
        supabase.from('stock_items').select('id, name, cost_per_unit').eq('restaurant_id', restaurant_id),
      ])

      if (menuRes.error || stockRes.error) {
        console.error('[mermas/from-devolucion] lookup error:', menuRes.error ?? stockRes.error)
        return NextResponse.json(
          { error: 'No se pudo consultar la carta/inventario', details: (menuRes.error ?? stockRes.error)?.message },
          { status: 500 },
        )
      }

      const match = resolveWasteItem(
        item_name,
        (menuRes.data ?? []) as { id: string; name: string; cost_price: number | null }[],
        (stockRes.data ?? []) as { id: string; name: string; cost_per_unit: number | null }[],
      )

      if (!match) {
        console.warn(`[mermas/from-devolucion] sin match para "${item_name}" en restaurant ${restaurant_id} (${menuRes.data?.length ?? 0} platos, ${stockRes.data?.length ?? 0} insumos)`)
        return NextResponse.json(
          { error: `No se encontró "${item_name}" en la carta ni en el inventario. Registrá la merma manualmente desde /mermas.` },
          { status: 404 },
        )
      }
      menu_item_id  = match.menu_item_id
      stock_item_id = match.stock_item_id
      cost_lost     = match.cost_lost
      item_type     = match.item_type
    } else if (menu_item_id) {
      // Cliente nos dio menu_item_id → solo traemos el cost_price
      const menuRes = await supabase
        .from('menu_items')
        .select('cost_price')
        .eq('id', menu_item_id)
        .eq('restaurant_id', restaurant_id)
        .maybeSingle()
      cost_lost = (menuRes.data as { cost_price: number | null } | null)?.cost_price ?? 0
      item_type = 'plato'
    } else if (stock_item_id) {
      const stockRes = await supabase
        .from('stock_items')
        .select('cost_per_unit')
        .eq('id', stock_item_id)
        .eq('restaurant_id', restaurant_id)
        .maybeSingle()
      cost_lost = (stockRes.data as { cost_per_unit: number | null } | null)?.cost_per_unit ?? 0
      item_type = 'stock'
    }

    const notes = `Devolución comanda: ${reason}${order_id ? `. Pedido: ${order_id}` : ''}`

    // already_deducted=true: el plato ya consumió su stock al prepararse; la
    // merma es solo para registro/contador, no debe re-descontar insumos.
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
      already_deducted: true,
    })

    if (insertErr) {
      console.error('[mermas/from-devolucion] waste_log insert error:', insertErr.code, insertErr.message, insertErr.details)
      // Mensaje claro si el esquema no tiene soporte de merma de platos.
      const needsMigration = insertErr.code === '42703' || insertErr.code === '23514'
      return NextResponse.json(
        {
          error: needsMigration
            ? 'La base de datos no acepta este tipo de merma. Aplicá la migration 20260414_041_waste_plate.sql en Supabase.'
            : `No se pudo registrar la merma: ${insertErr.message}`,
          code: insertErr.code,
        },
        { status: 500 },
      )
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
