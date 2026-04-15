import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

// ── Helpers ─────────────────────────────────────────────────────────────────

function genQrToken(label: string) {
  return `qr-${label.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 10)}`
}

// ── Schemas ─────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  label:         z.string().min(1),
  seats:         z.number().int().min(1).max(30),
  zone:          z.string().default('interior'),
  smoking:       z.boolean().default(false),
  restaurant_id: z.string().uuid(),
})

const DeleteSchema = z.object({
  id:            z.string().uuid(),
  restaurant_id: z.string().uuid(),
})

// PATCH supports two shapes:
//   1. Single update: { id, restaurant_id, pos_x?, pos_y?, label?, seats?, zone?, smoking? }
//   2. Bulk position update: { restaurant_id, positions: [{ id, pos_x, pos_y }] }
//
// Bulk shape is what the floorplan uses to flush a drag session in one call
// without N round-trips when several tables are moved.
const PatchSchema = z.union([
  z.object({
    id:            z.string().uuid(),
    restaurant_id: z.string().uuid(),
    pos_x:         z.number().nullable().optional(),
    pos_y:         z.number().nullable().optional(),
    label:         z.string().optional(),
    seats:         z.number().int().min(1).max(30).optional(),
    zone:          z.string().optional(),
    smoking:       z.boolean().optional(),
  }),
  z.object({
    restaurant_id: z.string().uuid(),
    positions: z.array(z.object({
      id:    z.string().uuid(),
      pos_x: z.number(),
      pos_y: z.number(),
    })).min(1).max(200),
  }),
])

// ── POST /api/tables — create single ────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const body = await req.json()
    const { label, seats, zone, smoking, restaurant_id } = CreateSchema.parse(body)

    const fullLabel = /^Mesa\s+/i.test(label) ? label : `Mesa ${label}`
    const qr_token  = genQrToken(fullLabel)

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('tables')
      .insert({ label: fullLabel, seats, zone, smoking, status: 'libre', qr_token, restaurant_id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, table: data })
  } catch (err) {
    console.error('POST /api/tables error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── PATCH /api/tables — update single or bulk positions ────────────────────

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const body = await req.json()
    const data = PatchSchema.parse(body)

    const supabase = createAdminClient()

    // Bulk positions
    if ('positions' in data) {
      // Update each row, scoped by restaurant_id to keep RLS-equivalent isolation.
      const updates = data.positions.map(p =>
        supabase
          .from('tables')
          .update({ pos_x: p.pos_x, pos_y: p.pos_y })
          .eq('id', p.id)
          .eq('restaurant_id', data.restaurant_id)
      )
      const results = await Promise.all(updates)
      const failed = results.find(r => r.error)
      if (failed?.error) {
        return NextResponse.json({ error: failed.error.message }, { status: 400 })
      }
      return NextResponse.json({ ok: true, updated: data.positions.length })
    }

    // Single update
    const { id, restaurant_id, ...rest } = data
    // Drop undefined keys so we don't overwrite columns the client didn't send.
    const update: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) update[k] = v
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const { data: row, error } = await supabase
      .from('tables')
      .update(update)
      .eq('id', id)
      .eq('restaurant_id', restaurant_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, table: row })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('PATCH /api/tables error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── DELETE /api/tables — eliminar mesa ──────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const body = await req.json()
    const { id, restaurant_id } = DeleteSchema.parse(body)
    const force = req.nextUrl.searchParams.get('force') === '1'

    const supabase = createAdminClient()

    // 1. Load the table for context (label, status)
    const { data: table } = await supabase
      .from('tables')
      .select('id, label, status, split_into_ids')
      .eq('id', id)
      .eq('restaurant_id', restaurant_id)
      .maybeSingle()

    if (!table) {
      return NextResponse.json(
        { error: 'La mesa ya no existe o no pertenece a este restaurante.' },
        { status: 404 }
      )
    }

    const tableLabel = (table as { label?: string }).label ?? 'Esta mesa'

    // 2. Block active (unpaid) orders — siempre bloqueante
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('table_id', id)
      .not('status', 'in', '("paid","cancelled")')

    if (activeOrders && activeOrders.length > 0) {
      return NextResponse.json(
        {
          error: `${tableLabel} tiene ${activeOrders.length} pedido${activeOrders.length === 1 ? '' : 's'} activo${activeOrders.length === 1 ? '' : 's'} sin cerrar. Ciérralos o cancélalos antes de eliminar la mesa.`,
          reason: 'active_orders',
          active_orders: activeOrders.length,
        },
        { status: 409 }
      )
    }

    // 3. Block if it's a parent table that was split (must merge first)
    const splitInto = (table as { split_into_ids?: string[] | null }).split_into_ids
    if (Array.isArray(splitInto) && splitInto.length > 0) {
      return NextResponse.json(
        {
          error: `${tableLabel} está dividida en ${splitInto.length} sub-mesas. Usá "Volver a unir" antes de eliminarla.`,
          reason: 'is_split_parent',
        },
        { status: 409 }
      )
    }

    // 4. Count historical orders (paid/cancelled) — these block deletion
    //    via the FK `orders.table_id` → `tables.id` unless the FK has
    //    ON DELETE SET NULL. Migration 047 lo arregla a nivel de schema.
    //    Mientras no se aplique, ofrecemos `?force=1` para nullear los
    //    orders.table_id manualmente y preservar la historia de ventas.
    const { data: historicalOrders, count: historicalCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact' })
      .eq('table_id', id)

    const historic = historicalCount ?? historicalOrders?.length ?? 0

    if (historic > 0 && !force) {
      // Try the delete first — if migration 047 corrió, debería funcionar
      // (FK tiene ON DELETE SET NULL). Si falla por FK, devolvemos mensaje
      // descriptivo con opción de forzar.
      const { error: delErr } = await supabase
        .from('tables')
        .delete()
        .eq('id', id)
        .eq('restaurant_id', restaurant_id)

      if (!delErr) return NextResponse.json({ ok: true, historical_orders: historic })

      const isFkViolation =
        delErr.code === '23503' ||
        /foreign key/i.test(delErr.message ?? '')

      if (isFkViolation) {
        return NextResponse.json(
          {
            error:
              `${tableLabel} tiene ${historic} pedido${historic === 1 ? '' : 's'} histórico${historic === 1 ? '' : 's'} ` +
              `(pagados o cancelados). Eliminar la mesa mantendría la historia de ventas pero desvincularía los pedidos antiguos. ` +
              `Confirmá en el modal para forzar la eliminación.`,
            reason: 'has_historical_orders',
            historical_orders: historic,
            can_force: true,
          },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: `No se pudo eliminar: ${delErr.message}` }, { status: 500 })
    }

    // 5. Force path: null out table_id on historical orders first
    if (force && historic > 0) {
      const { error: nullErr } = await supabase
        .from('orders')
        .update({ table_id: null })
        .eq('table_id', id)
      if (nullErr) {
        return NextResponse.json(
          { error: `No se pudieron desvincular los pedidos históricos: ${nullErr.message}` },
          { status: 500 }
        )
      }
    }

    // 6. Delete the table
    const { error: finalDelErr } = await supabase
      .from('tables')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurant_id)

    if (finalDelErr) {
      return NextResponse.json(
        {
          error: `No se pudo eliminar ${tableLabel}: ${finalDelErr.message}`,
          detail: finalDelErr.message,
        },
        { status: 400 }
      )
    }
    return NextResponse.json({ ok: true, historical_orders: historic, forced: force })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos. Verificá que el ID de la mesa sea correcto.', issues: err.issues },
        { status: 400 }
      )
    }
    console.error('DELETE /api/tables error:', err)
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: `Error interno: ${msg}` }, { status: 500 })
  }
}
