import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/reservations/availability?restaurant_id=X&date=YYYY-MM-DD&party_size=N
// Returns available time slots for a given date

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const restaurantId = url.searchParams.get('restaurant_id')
  const date = url.searchParams.get('date')
  const partySize = parseInt(url.searchParams.get('party_size') || '2', 10)

  if (!restaurantId || !date) {
    return NextResponse.json({ error: 'restaurant_id and date required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Get restaurant config
  const { data: rest } = await supabase
    .from('restaurants')
    .select('hours, reservation_slot_duration, reservations_enabled, capacity')
    .eq('id', restaurantId)
    .single()

  if (!rest || !rest.reservations_enabled) {
    return NextResponse.json({ error: 'Restaurante no acepta reservas' }, { status: 400 })
  }

  // Get the day of week for the requested date
  const dateObj = new Date(date + 'T12:00:00')
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const dayName = dayNames[dateObj.getDay()]

  const hours = rest.hours as Record<string, { open: string; close: string; closed: boolean }> | null
  const daySchedule = hours?.[dayName]

  if (!daySchedule || daySchedule.closed) {
    return NextResponse.json({ slots: [], closed: true, message: 'Restaurante cerrado este día' })
  }

  const duration = rest.reservation_slot_duration || 90

  // Generate 30-minute interval slots from open to (close - duration)
  const slots: { time: string; available: boolean; remaining: number }[] = []
  const [openH, openM] = daySchedule.open.split(':').map(Number)
  const [closeH, closeM] = daySchedule.close.split(':').map(Number)
  const openMin = openH * 60 + openM
  const closeMin = closeH * 60 + closeM
  const lastSlotMin = closeMin - duration

  // Get all reservations for this date
  const { data: existing } = await supabase
    .from('reservations')
    .select('reservation_time, duration_min, party_size')
    .eq('restaurant_id', restaurantId)
    .eq('reservation_date', date)
    .in('status', ['pending', 'confirmed', 'seated'])

  // Count total tables that fit party size
  const { count: totalTables } = await supabase
    .from('tables')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .gte('seats', partySize)
    .neq('status', 'bloqueada')

  const tableCount = totalTables || Math.max(rest.capacity || 10, 1)

  for (let min = openMin; min <= lastSlotMin; min += 30) {
    const h = Math.floor(min / 60)
    const m = min % 60
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    // Count overlapping reservations at this time
    const slotStart = min
    const slotEnd = min + duration
    let overlapping = 0

    for (const r of (existing || [])) {
      const [rH, rM] = r.reservation_time.split(':').map(Number)
      const rStart = rH * 60 + rM
      const rEnd = rStart + (r.duration_min || 90)
      if (rStart < slotEnd && rEnd > slotStart) overlapping++
    }

    const remaining = Math.max(tableCount - overlapping, 0)
    slots.push({
      time: timeStr,
      available: remaining > 0,
      remaining,
    })
  }

  return NextResponse.json({ slots, date, day: dayName })
}
