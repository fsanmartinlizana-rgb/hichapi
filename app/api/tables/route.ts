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

    const supabase = createAdminClient()

    // Prevent deleting a table that has active (unpaid) orders
    const { data: activeOrders, error: ordersErr } = await supabase
      .from('orders')
      .select('id')
      .eq('table_id', id)
      .not('status', 'in', '("paid","cancelled")')
      .limit(1)

    if (ordersErr) {
      console.error('check orders error:', ordersErr)
    }
    if (activeOrders && activeOrders.length > 0) {
      return NextResponse.json(
        { error: 'La mesa tiene pedidos activos. Ciérralos o cancélalos primero.' },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurant_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('DELETE /api/tables error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
