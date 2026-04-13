import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/reservations/status?token=XXX — Public lookup by token

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: rows } = await supabase.rpc('get_reservation_by_token', { p_token: token })
  const entry = Array.isArray(rows) ? rows[0] : rows

  if (!entry) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  }

  // Get restaurant name
  const { data: rest } = await supabase
    .from('restaurants')
    .select('name, address, phone')
    .eq('id', entry.restaurant_id)
    .single()

  return NextResponse.json({
    reservation: entry,
    restaurant: rest || { name: 'Restaurante' },
  })
}
