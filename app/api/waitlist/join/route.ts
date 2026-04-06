import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { calculateEta, DEFAULT_AVG_DURATION_MIN } from '@/lib/waitlist/eta'
import type { OccupiedTable } from '@/lib/waitlist/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const JoinSchema = z.object({
  restaurant_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  phone: z.string().min(6).max(20),
  party_size: z.number().int().min(1).max(20),
  notes: z.string().max(300).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = JoinSchema.parse(body)

    // ── Count current waiting to assign position ─────────────────────────────
    const { count } = await supabase
      .from('waitlist_entries')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', data.restaurant_id)
      .eq('status', 'waiting')

    const position = (count ?? 0) + 1

    // ── Compute ETA ──────────────────────────────────────────────────────────
    // Get avg table duration from last 7 days
    const { data: summaries } = await supabase
      .from('daily_summaries')
      .select('avg_table_duration')
      .eq('restaurant_id', data.restaurant_id)
      .order('date', { ascending: false })
      .limit(7)

    const avgDuration = summaries && summaries.length > 0
      ? Math.round(summaries.reduce((s, r) => s + (r.avg_table_duration ?? 60), 0) / summaries.length)
      : DEFAULT_AVG_DURATION_MIN

    // Get occupied tables (orders currently active)
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, created_at, status')
      .eq('restaurant_id', data.restaurant_id)
      .in('status', ['recibida', 'preparando', 'lista', 'cuenta'])

    const occupied: OccupiedTable[] = (activeOrders ?? []).map(o => ({
      tableId: o.id,
      seatedAt: new Date(o.created_at),
      status: o.status === 'cuenta' ? 'cuenta' : 'ocupada',
    }))

    const estimated_wait_min = calculateEta({ position, avgTableDurationMin: avgDuration, occupiedTables: occupied })

    // ── Insert entry ─────────────────────────────────────────────────────────
    const { data: entry, error } = await supabase
      .from('waitlist_entries')
      .insert({
        restaurant_id: data.restaurant_id,
        name: data.name,
        phone: data.phone,
        party_size: data.party_size,
        notes: data.notes ?? null,
        position,
        estimated_wait_min,
      })
      .select('token, position, estimated_wait_min')
      .single()

    if (error) throw error

    return NextResponse.json({
      token: entry.token,
      position: entry.position,
      estimated_wait_min: entry.estimated_wait_min,
    })
  } catch (err) {
    console.error('waitlist/join error:', err)
    return NextResponse.json({ error: 'Error al unirse a la lista' }, { status: 500 })
  }
}
