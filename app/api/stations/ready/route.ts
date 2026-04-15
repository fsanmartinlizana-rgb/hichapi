import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications/server'

// ── POST /api/stations/ready ─────────────────────────────────────────────────
// Cocina marca un order_item como listo → dispara notificación al garzón con
// el NOMBRE DE LA LOCATION donde retirar. Resuelve el dolor del Dante:
// garzón ya no camina a ciegas entre locales.
//
// Body: { order_item_id, ready_by (user_id, opcional) }
//
// Side-effects:
//   1. UPDATE order_items SET station_status='ready', station_ready_at=now()
//   2. Si TODOS los items del order están ready → update orders.status='ready'
//   3. Crea notification type='station_ready' con metadata { station_name, location_name, table_label }
// ─────────────────────────────────────────────────────────────────────────────

const Schema = z.object({
  order_item_id: z.string().uuid(),
  ready_by:      z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Schema>
  try {
    body = Schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 1. Traer item + relaciones para la notificación
  const { data: item, error: itemErr } = await supabase
    .from('order_items')
    .select(`
      id, name, quantity, order_id, station_id, station_status,
      orders!inner (
        id, restaurant_id, table_id, location_id,
        tables ( label ),
        locations ( name )
      ),
      stations ( name, kind, locations ( name ) )
    `)
    .eq('id', body.order_item_id)
    .maybeSingle()

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order       = Array.isArray((item as any).orders) ? (item as any).orders[0] : (item as any).orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const station     = Array.isArray((item as any).stations) ? (item as any).stations[0] : (item as any).stations
  const tableLabel  = Array.isArray(order?.tables) ? order.tables[0]?.label : order?.tables?.label
  const orderLoc    = Array.isArray(order?.locations) ? order.locations[0]?.name : order?.locations?.name
  const stationLoc  = Array.isArray(station?.locations) ? station.locations[0]?.name : station?.locations?.name
  const locationName = stationLoc || orderLoc // donde se prepara (puede ser distinta de donde está la mesa)

  if ((item as { station_status?: string }).station_status === 'ready') {
    // Idempotente — no re-notificar si ya estaba ready
    return NextResponse.json({ ok: true, already_ready: true })
  }

  // 2. Marcar item ready
  const { error: updErr } = await supabase
    .from('order_items')
    .update({
      station_status:   'ready',
      station_ready_at: new Date().toISOString(),
      status:           'ready',
    })
    .eq('id', body.order_item_id)

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  // 3. Notificación al garzón — ojo al nombre del local si es distinto
  const isOtherLocation = stationLoc && orderLoc && stationLoc !== orderLoc
  try {
    await createNotification({
      restaurant_id: order.restaurant_id,
      type:          'station_ready',
      severity:      'success',
      category:      'operacion',
      title:         isOtherLocation
        ? `${item.name} lista — retira en ${stationLoc}`
        : `${item.name} lista`,
      message:       isOtherLocation
        ? `Mesa ${tableLabel ?? '—'} (${orderLoc}). Retirar en ${stationLoc}.`
        : `Mesa ${tableLabel ?? '—'}. Retirar en ${station?.name ?? 'cocina'}.`,
      action_url:    `/comandas?focus=${order.id}`,
      action_label:  'Ver comanda',
      dedupe_key:    `station_ready:${body.order_item_id}`,
      metadata: {
        order_id:      order.id,
        order_item_id: body.order_item_id,
        station_id:    (item as { station_id?: string }).station_id,
        station_name:  station?.name ?? null,
        station_kind:  station?.kind ?? null,
        location_name: locationName,
        order_location_name:   orderLoc,
        station_location_name: stationLoc,
        cross_location: !!isOtherLocation,
        table_label:   tableLabel,
        item_name:     item.name,
      },
    })
  } catch (e) {
    console.error('[notifications] station_ready failed:', e)
  }

  // 4. Si TODOS los items del order ya están ready → promover la orden a 'ready'
  const { data: remainingItems } = await supabase
    .from('order_items')
    .select('id, station_status, status')
    .eq('order_id', order.id)

  type ItemStatus = { station_status: string | null; status: string | null }
  const allReady = ((remainingItems ?? []) as ItemStatus[]).every(
    (r: ItemStatus) => r.station_status === 'ready' || r.status === 'ready' || r.status === 'cancelled',
  )
  if (allReady) {
    await supabase
      .from('orders')
      .update({ status: 'ready' })
      .eq('id', order.id)
      .in('status', ['pending', 'confirmed', 'preparing', 'partial_ready'])
  } else {
    // Al menos un item listo → partial_ready para visibilidad en kanban
    await supabase
      .from('orders')
      .update({ status: 'partial_ready' })
      .eq('id', order.id)
      .in('status', ['pending', 'confirmed', 'preparing'])
  }

  return NextResponse.json({ ok: true, cross_location: !!isOtherLocation })
}
