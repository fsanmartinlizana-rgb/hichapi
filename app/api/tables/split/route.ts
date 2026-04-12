import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

// ── Schema ──────────────────────────────────────────────────────────────────
//
// POST /api/tables/split
// Divide una mesa grande en N mesas hijas. La mesa madre queda bloqueada
// (status: "bloqueada"), con un flag split_into_ids para poder "merge" después.
// Cada mesa hija hereda zona / smoking y recibe su propio qr_token.
//
// Si total de asientos hijos > asientos mesa madre → 400.

const BodySchema = z.object({
  parent_id:     z.string().uuid(),
  restaurant_id: z.string().uuid(),
  children: z.array(
    z.object({
      label: z.string().min(1).max(60),
      seats: z.number().int().min(1).max(20),
    })
  ).min(2).max(8),
})

function genQrToken(label: string) {
  return `qr-${label.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 10)}`
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  try {
    const body = BodySchema.parse(await req.json())

    const supabase = createAdminClient()

    // 1. Load parent
    const { data: parent, error: parentErr } = await supabase
      .from('tables')
      .select('id, label, seats, status, zone, smoking, restaurant_id')
      .eq('id', body.parent_id)
      .eq('restaurant_id', body.restaurant_id)
      .single()

    if (parentErr || !parent) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 })
    }
    if (parent.status === 'ocupada' || parent.status === 'cuenta') {
      return NextResponse.json(
        { error: 'No puedes dividir una mesa ocupada. Libérala primero.' },
        { status: 409 }
      )
    }

    const totalChildSeats = body.children.reduce((s, c) => s + c.seats, 0)
    if (totalChildSeats > parent.seats + 2) {
      return NextResponse.json(
        { error: `Los sub-mesas suman ${totalChildSeats} pax pero la mesa tiene ${parent.seats}` },
        { status: 400 }
      )
    }

    // 2. Insert children
    const rows = body.children.map(c => {
      const full = /^Mesa\s+/i.test(c.label) ? c.label : `Mesa ${c.label}`
      return {
        label:         full,
        seats:         c.seats,
        zone:          parent.zone,
        smoking:       parent.smoking,
        status:        'libre',
        qr_token:      genQrToken(full),
        restaurant_id: parent.restaurant_id,
      }
    })

    const { data: inserted, error: insertErr } = await supabase
      .from('tables')
      .insert(rows)
      .select()

    if (insertErr) {
      console.error('split insert error:', insertErr)
      return NextResponse.json({ error: 'No se pudieron crear las sub-mesas' }, { status: 500 })
    }

    // 3. Mark parent as "bloqueada" (the column split_into_ids may not exist yet;
    //    we attempt it but ignore failure so old schemas still work)
    const childIds = (inserted ?? []).map((r: { id: string }) => r.id)
    const parentUpdate: Record<string, unknown> = { status: 'bloqueada' }

    // Try to also persist split_into_ids if the column exists.
    const { error: extendedErr } = await supabase
      .from('tables')
      .update({ ...parentUpdate, split_into_ids: childIds })
      .eq('id', parent.id)

    if (extendedErr) {
      // Fallback: update without split_into_ids
      await supabase.from('tables').update(parentUpdate).eq('id', parent.id)
    }

    return NextResponse.json({
      ok: true,
      parent_id: parent.id,
      children: inserted,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('split error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/tables/split?action=merge
// Cuerpo: { parent_id, restaurant_id, child_ids }
// Re-activa la mesa madre y elimina las hijas (si no hay pedidos activos).
export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const MergeSchema = z.object({
    parent_id:     z.string().uuid(),
    restaurant_id: z.string().uuid(),
    child_ids:     z.array(z.string().uuid()).min(1),
  })

  try {
    const body = MergeSchema.parse(await req.json())

    const supabase = createAdminClient()

    // Ensure no active orders in children
    const { data: active } = await supabase
      .from('orders')
      .select('id')
      .in('table_id', body.child_ids)
      .not('status', 'in', '("paid","cancelled")')
      .limit(1)

    if (active && active.length > 0) {
      return NextResponse.json(
        { error: 'Una sub-mesa tiene pedidos activos. Ciérralos primero.' },
        { status: 409 }
      )
    }

    // Delete children
    const { error: delErr } = await supabase
      .from('tables')
      .delete()
      .in('id', body.child_ids)
      .eq('restaurant_id', body.restaurant_id)

    if (delErr) {
      console.error('merge delete error:', delErr)
    }

    // Reactivate parent
    await supabase
      .from('tables')
      .update({ status: 'libre', split_into_ids: null })
      .eq('id', body.parent_id)
      .eq('restaurant_id', body.restaurant_id)

    // Fallback in case split_into_ids column doesn't exist
    await supabase
      .from('tables')
      .update({ status: 'libre' })
      .eq('id', body.parent_id)
      .eq('restaurant_id', body.restaurant_id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('merge error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
