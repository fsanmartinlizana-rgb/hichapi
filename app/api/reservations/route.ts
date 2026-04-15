import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { z } from 'zod'
import { sendBrandedEmail } from '@/lib/email/sender'
import { reservationConfirmEmail } from '@/lib/email/templates'

// ── POST /api/reservations — Create a reservation (public) ──────────────────

const CreateSchema = z.object({
  restaurant_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  phone: z.string().min(6).max(20),
  email: z.string().email().optional(),
  party_size: z.number().int().min(1).max(20),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reservation_time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = CreateSchema.parse(body)

    const supabase = createAdminClient()

    // ── Validate restaurant accepts reservations ────────────────────────────
    const { data: rest, error: restErr } = await supabase
      .from('restaurants')
      .select('id, name, reservations_enabled, reservation_timeout_min, reservation_slot_duration, reservation_max_party, reservation_advance_days, capacity')
      .eq('id', data.restaurant_id)
      .single()

    if (restErr || !rest) {
      return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
    }

    if (!rest.reservations_enabled) {
      return NextResponse.json({ error: 'Este restaurante no acepta reservas online' }, { status: 400 })
    }

    if (data.party_size > (rest.reservation_max_party || 10)) {
      return NextResponse.json({
        error: `Máximo ${rest.reservation_max_party || 10} personas para reserva online. Llama al restaurante para grupos más grandes.`,
      }, { status: 400 })
    }

    // ── Validate date is within allowed range ───────────────────────────────
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const resDate = new Date(data.reservation_date + 'T00:00:00')
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + (rest.reservation_advance_days || 30))

    if (resDate < today) {
      return NextResponse.json({ error: 'No puedes reservar en una fecha pasada' }, { status: 400 })
    }
    if (resDate > maxDate) {
      return NextResponse.json({ error: `Solo se puede reservar hasta ${rest.reservation_advance_days || 30} días de anticipación` }, { status: 400 })
    }

    // ── Check availability ──────────────────────────────────────────────────
    const duration = rest.reservation_slot_duration || 90
    const { data: avail } = await supabase.rpc('check_reservation_availability', {
      p_restaurant_id: data.restaurant_id,
      p_date: data.reservation_date,
      p_time: data.reservation_time,
      p_party_size: data.party_size,
      p_duration_min: duration,
    })

    const availability = Array.isArray(avail) ? avail[0] : avail
    if (!availability?.available) {
      return NextResponse.json({
        error: 'No hay disponibilidad para ese horario. Intenta otra hora o fecha.',
        available_tables: 0,
      }, { status: 409 })
    }

    // ── Create reservation ──────────────────────────────────────────────────
    const { data: reservation, error: insertErr } = await supabase
      .from('reservations')
      .insert({
        restaurant_id: data.restaurant_id,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        party_size: data.party_size,
        reservation_date: data.reservation_date,
        reservation_time: data.reservation_time,
        duration_min: duration,
        notes: data.notes || null,
        status: 'confirmed',  // Auto-confirm for now
        confirmed_at: new Date().toISOString(),
      })
      .select('id, token, reservation_date, reservation_time, status, party_size')
      .single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'Ya tienes una reserva para esa fecha y hora' }, { status: 409 })
      }
      throw insertErr
    }

    // ── Enviar email de confirmación (best-effort) ──────────────────────────
    let emailSent = false
    if (data.email) {
      try {
        const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin
        const statusUrl = reservation.token
          ? `${origin}/reservar/${rest.id}?token=${reservation.token}`
          : `${origin}/reservar/${rest.id}`
        const displayDate = new Date(`${data.reservation_date}T${data.reservation_time}:00`)
          .toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

        const { subject, html, text } = reservationConfirmEmail({
          restaurantName: rest.name,
          guestName:      data.name,
          date:           displayDate,
          time:           data.reservation_time,
          partySize:      data.party_size,
          statusUrl,
        })
        const res = await sendBrandedEmail({
          to:      data.email,
          subject,
          html,
          text,
        })
        emailSent = res.ok === true
      } catch (mailErr) {
        console.error('[email] reservation confirm send failed (non-blocking):', mailErr)
      }
    }

    return NextResponse.json({
      reservation,
      restaurant_name: rest.name,
      message: 'Reserva confirmada',
      email_sent: emailSent,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('POST /api/reservations error:', err)
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
  }
}

// ── GET /api/reservations — List reservations for a restaurant (staff) ──────

export async function GET(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) {
    return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const restaurantId = url.searchParams.get('restaurant_id')
  const date = url.searchParams.get('date') // YYYY-MM-DD
  const status = url.searchParams.get('status') // optional filter

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  let query = supabase
    .from('reservations')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('reservation_time', { ascending: true })

  if (date) {
    query = query.eq('reservation_date', date)
  } else {
    // Default: today and future
    const today = new Date().toISOString().split('T')[0]
    query = query.gte('reservation_date', today)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data: reservations, error } = await query.limit(200)

  if (error) {
    console.error('GET /api/reservations error:', error)
    return NextResponse.json({ error: 'Error al cargar reservas' }, { status: 500 })
  }

  // Also mark no-shows
  try {
    await supabase.rpc('mark_noshow_reservations')
  } catch { /* RPC may not exist yet */ }

  return NextResponse.json({ reservations })
}

// ── PATCH /api/reservations — Update reservation status (staff) ─────────────

const PatchSchema = z.object({
  reservation_id: z.string().uuid(),
  action: z.enum(['confirm', 'seat', 'complete', 'no_show', 'cancel', 'assign_table']),
  table_id: z.string().uuid().optional(),
})

export async function PATCH(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) {
    return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { reservation_id, action, table_id } = PatchSchema.parse(body)

    const supabase = createAdminClient()

    const updates: Record<string, unknown> = {}

    switch (action) {
      case 'confirm':
        updates.status = 'confirmed'
        updates.confirmed_at = new Date().toISOString()
        break
      case 'seat':
        updates.status = 'seated'
        updates.seated_at = new Date().toISOString()
        if (table_id) updates.table_id = table_id
        break
      case 'complete':
        updates.status = 'completed'
        updates.completed_at = new Date().toISOString()
        break
      case 'no_show':
        updates.status = 'no_show'
        updates.no_show_at = new Date().toISOString()
        break
      case 'cancel':
        updates.status = 'cancelled'
        break
      case 'assign_table':
        if (!table_id) return NextResponse.json({ error: 'table_id required' }, { status: 400 })
        updates.table_id = table_id
        break
    }

    const { data: updated, error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('id', reservation_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ reservation: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('PATCH /api/reservations error:', err)
    return NextResponse.json({ error: 'Error al actualizar reserva' }, { status: 500 })
  }
}
