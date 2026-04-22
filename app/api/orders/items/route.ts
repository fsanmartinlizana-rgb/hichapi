import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ── PATCH /api/orders/items ───────────────────────────────────────────────────
// Actualiza la cantidad de un ítem de una comanda.
// Si qty llega a 0, elimina el ítem (equivalente a DELETE).
// Recalcula el total de la orden padre.

const PatchSchema = z.object({
  restaurant_id:  z.string().uuid(),
  order_item_id:  z.string().uuid(),
  quantity:       z.number().int().min(0),
})

export async function PATCH(req: NextRequest) {
  let body: z.infer<typeof PatchSchema>
  try {
    body = PatchSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, [
    'owner', 'admin', 'supervisor', 'garzon', 'waiter', 'anfitrion', 'super_admin',
  ])
  if (authErr) return authErr

  const supabase = createAdminClient()

  // Verificar que el ítem pertenece a una orden de este restaurant
  const { data: item, error: itemErr } = await supabase
    .from('order_items')
    .select('id, order_id, unit_price, quantity')
    .eq('id', body.order_item_id)
    .maybeSingle()

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 })
  }
  const it = item as { id: string; order_id: string; unit_price: number; quantity: number }

  // Verificar que la orden pertenece al restaurant
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, total, restaurant_id')
    .eq('id', it.order_id)
    .eq('restaurant_id', body.restaurant_id)
    .maybeSingle()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Orden no encontrada en este restaurant' }, { status: 404 })
  }
  const ord = order as { id: string; total: number; restaurant_id: string }

  if (body.quantity === 0) {
    // Eliminar el ítem
    const { error: delErr } = await supabase
      .from('order_items')
      .delete()
      .eq('id', body.order_item_id)

    if (delErr) {
      return NextResponse.json({ error: 'No se pudo eliminar el ítem', details: delErr.message }, { status: 500 })
    }
  } else {
    // Actualizar cantidad
    const { error: updErr } = await supabase
      .from('order_items')
      .update({ quantity: body.quantity })
      .eq('id', body.order_item_id)

    if (updErr) {
      return NextResponse.json({ error: 'No se pudo actualizar el ítem', details: updErr.message }, { status: 500 })
    }
  }

  // Recalcular total de la orden sumando todos los ítems restantes
  const { data: remaining } = await supabase
    .from('order_items')
    .select('quantity, unit_price')
    .eq('order_id', it.order_id)

  const newTotal = ((remaining ?? []) as { quantity: number; unit_price: number }[])
    .reduce((s, r) => s + r.quantity * r.unit_price, 0)

  await supabase
    .from('orders')
    .update({ total: newTotal })
    .eq('id', it.order_id)

  // Si no quedan ítems, liberar la mesa y cancelar la orden
  if (!remaining || remaining.length === 0) {
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', it.order_id)
    const { data: tableRow } = await supabase
      .from('orders')
      .select('table_id')
      .eq('id', it.order_id)
      .maybeSingle()
    const tableId = (tableRow as { table_id?: string } | null)?.table_id
    if (tableId) {
      await supabase.from('tables').update({ status: 'libre' }).eq('id', tableId)
    }
  }

  return NextResponse.json({ ok: true, newTotal, remainingItems: remaining?.length ?? 0 })
}

// ── DELETE /api/orders/items ──────────────────────────────────────────────────
// Elimina un ítem directamente (sin pasar quantity=0).

const DeleteSchema = z.object({
  restaurant_id: z.string().uuid(),
  order_item_id: z.string().uuid(),
})

export async function DELETE(req: NextRequest) {
  let body: z.infer<typeof DeleteSchema>
  try {
    body = DeleteSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  // Reusar PATCH con quantity=0
  const patchReq = new Request(req.url, {
    method: 'PATCH',
    headers: req.headers,
    body: JSON.stringify({ ...body, quantity: 0 }),
  })
  return PATCH(new NextRequest(patchReq))
}
