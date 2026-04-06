import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { calculateEta, DEFAULT_AVG_DURATION_MIN } from '@/lib/waitlist/eta'
import type { OccupiedTable } from '@/lib/waitlist/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

    // Use the SECURITY DEFINER RPC for safe anon lookup
    const { data: entries, error } = await supabase
      .rpc('get_waitlist_entry_by_token', { p_token: token })

    if (error || !entries || entries.length === 0) {
      return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })
    }

    const entry = entries[0]

    // Fetch restaurant name
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name, neighborhood')
      .eq('id', entry.restaurant_id)
      .single()

    // Re-compute fresh ETA if still waiting
    let etaMin = entry.estimated_wait_min ?? DEFAULT_AVG_DURATION_MIN

    if (entry.status === 'waiting') {
      const { data: summaries } = await supabase
        .from('daily_summaries')
        .select('avg_table_duration')
        .eq('restaurant_id', entry.restaurant_id)
        .order('date', { ascending: false })
        .limit(7)

      const avgDuration = summaries && summaries.length > 0
        ? Math.round(summaries.reduce((s: number, r: { avg_table_duration: number | null }) => s + (r.avg_table_duration ?? 60), 0) / summaries.length)
        : DEFAULT_AVG_DURATION_MIN

      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id, created_at, status')
        .eq('restaurant_id', entry.restaurant_id)
        .in('status', ['recibida', 'preparando', 'lista', 'cuenta'])

      const occupied: OccupiedTable[] = (activeOrders ?? []).map((o: { id: string; created_at: string; status: string }) => ({
        tableId: o.id,
        seatedAt: new Date(o.created_at),
        status: o.status === 'cuenta' ? 'cuenta' : 'ocupada',
      }))

      etaMin = calculateEta({ position: entry.position, avgTableDurationMin: avgDuration, occupiedTables: occupied })
    }

    return NextResponse.json({
      entry,
      restaurantName: restaurant?.name ?? '',
      restaurantNeighborhood: restaurant?.neighborhood ?? '',
      etaMin,
    })
  } catch (err) {
    console.error('waitlist/status error:', err)
    return NextResponse.json({ error: 'Error al obtener estado' }, { status: 500 })
  }
}
