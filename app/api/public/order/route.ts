/**
 * POST /api/public/order
 * Creates a public order + delivery request (no auth required).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications/server'

const PublicOrderSchema = z.object({
  restaurant_id:    z.string().uuid(),
  client_name:      z.string().min(1).max(100),
  client_phone:     z.string().min(8).max(20),
  delivery_address: z.string().min(5).max(300),
  notes:            z.string().max(500).optional(),
  items: z.array(z.object({
    id:       z.string().uuid(),
    name:     z.string(),
    price:    z.number().int().min(0),
    quantity: z.number().int().min(1),
  })).min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = PublicOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { restaurant_id, client_name, client_phone, delivery_address, notes, items } = parsed.data

    const supabase = createAdminClient()

    // 1. Verify restaurant exists and is active
    const { data: restaurant, error: restErr } = await supabase
      .from('restaurants')
      .select('id, name, address, active')
      .eq('id', restaurant_id)
      .eq('active', true)
      .single()

    if (restErr || !restaurant) {
      return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
    }

    // 2. Find or create a "Delivery" virtual table to comply with table_id NOT NULL constraint
    let tableId: string | null = null
    const { data: existingTable } = await supabase
      .from('tables')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .eq('label', 'Delivery')
      .maybeSingle()

    if (existingTable) {
      tableId = existingTable.id
    } else {
      const { data: newTable, error: tableErr } = await supabase
        .from('tables')
        .insert({
          restaurant_id,
          label: 'Delivery',
          status: 'libre',
        })
        .select('id')
        .single()

      if (tableErr || !newTable) {
        console.error('[public/order] Error creating Delivery table:', tableErr)
        return NextResponse.json({ error: 'Error al inicializar mesa de entrega' }, { status: 500 })
      }
      tableId = newTable.id
    }

    const total_clp = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

    // 3. Create order in 'orders' table
    const { data: parentOrder, error: parentErr } = await supabase
      .from('orders')
      .insert({
        restaurant_id,
        table_id: tableId,
        status: 'pending',
        subtotal: total_clp,
        tip: 0,
        total: total_clp,
        client_name: `${client_name} (Delivery)`,
        notes: notes || null,
      })
      .select('id')
      .single()

    if (parentErr || !parentOrder) {
      console.error('[public/order] Error creating parent order:', parentErr)
      return NextResponse.json({ error: 'Error al registrar el pedido' }, { status: 500 })
    }

    // 4. Create order items in 'order_items'
    // Resolve item destinations (cocina / barra) from menu_items
    const menuItemIds = items.map(i => i.id)
    const { data: menuDetails } = await supabase
      .from('menu_items')
      .select('id, destination, category_id, tax_exempt')
      .in('id', menuItemIds)

    const destMap = new Map<string, string>()
    const exemptMap = new Map<string, boolean>()
    if (menuDetails) {
      for (const m of menuDetails) {
        destMap.set(m.id, m.destination || 'cocina')
        exemptMap.set(m.id, m.tax_exempt ?? false)
      }
    }

    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(
        items.map(item => ({
          order_id: parentOrder.id,
          menu_item_id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          destination: destMap.get(item.id) || 'cocina',
          tax_exempt: exemptMap.get(item.id) ?? false,
          status: 'pending',
        }))
      )

    if (itemsErr) {
      console.error('[public/order] Error creating order items:', itemsErr)
      // Rollback parent order
      await supabase.from('orders').delete().eq('id', parentOrder.id)
      return NextResponse.json({ error: 'Error al registrar platos del pedido' }, { status: 500 })
    }

    // 5. Create delivery request in 'delivery_orders'
    const itemsSummary = items.map(i => `${i.quantity}x ${i.name}`).join(', ')
    const fullNotes = [
      `Dirección: ${delivery_address}`,
      notes ? `Nota: ${notes}` : null,
      `Detalle: ${itemsSummary}`,
    ].filter(Boolean).join(' | ')

    const { data: delivOrder, error: delivErr } = await supabase
      .from('delivery_orders')
      .insert({
        restaurant_id,
        order_id:         parentOrder.id,
        pickup_address:   restaurant.address || `${restaurant.name}`,
        delivery_address,
        client_name,
        client_phone,
        total_clp,
        status:           'pending_assignment',
      })
      .select()
      .single()

    if (delivErr || !delivOrder) {
      console.error('[public/order] Error creating delivery request:', delivErr)
      // Rollback parent order (cascade will delete items or we delete manually)
      await supabase.from('orders').delete().eq('id', parentOrder.id)
      return NextResponse.json({ error: 'Error al solicitar repartidor' }, { status: 500 })
    }

    // 6. Notify restaurant in real-time
    try {
      await createNotification({
        restaurant_id,
        type:          'order_placed',
        severity:      'info',
        category:      'operacion',
        title:         `Nuevo Pedido Online`,
        message:       `Cliente: ${client_name} - Dirección: ${delivery_address}. Total: $${total_clp.toLocaleString('es-CL')}`,
        action_url:    `/comandas?focus=${parentOrder.id}`,
        action_label:  'Ver comanda',
        dedupe_key:    `order_placed:${parentOrder.id}`,
        metadata:      { order_id: parentOrder.id, total: total_clp },
      })
    } catch (notifErr) {
      console.warn('[public/order] Notification error (non-blocking):', notifErr)
    }

    return NextResponse.json({ order_id: delivOrder.id, status: delivOrder.status }, { status: 201 })
  } catch (err: any) {
    console.error('[public/order] Unexpected error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
