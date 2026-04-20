import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── PATCH /api/orders/station ────────────────────────────────────────────────
// Marks all items of a destination ready for an order.
// If all non-'ninguno' items are ready, order advances to 'ready'.
// Otherwise it sits at 'partial_ready'.

// Schema: acepta station_ids (nuevo, multi-local) o destination (legacy).
// station_ids debe ser UUIDs de stations del restaurant que hace la request.
// destination se mantiene por compat con paneles que no migraron.
const StationReadySchema = z.object({
  order_id:    z.string().uuid(),
  destination: z.enum(['cocina', 'barra']).optional(),
  station_ids: z.array(z.string().uuid()).optional(),
}).refine(d => d.destination || (d.station_ids && d.station_ids.length > 0), {
  message: 'Debe enviarse destination o station_ids',
})

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const body = await req.json()
    const parsed = StationReadySchema.parse(body)

    const supabase = createAdminClient()

    // Preferir RPC nuevo (por station_ids) si el cliente lo envia. Esto
    // evita el bug cross-local donde mark_station_ready con destination
    // marcaba TODOS los items de cocina del order, incluyendo los de otro
    // local. Fallback al RPC viejo si solo vino destination.
    let data, error
    if (parsed.station_ids && parsed.station_ids.length > 0) {
      ;({ data, error } = await supabase.rpc('mark_station_ready_by_stations', {
        p_order_id:    parsed.order_id,
        p_station_ids: parsed.station_ids,
      }))
    } else {
      ;({ data, error } = await supabase.rpc('mark_station_ready', {
        p_order_id:    parsed.order_id,
        p_destination: parsed.destination,
      }))
    }

    if (error) {
      console.error('mark_station_ready error:', error)
      return NextResponse.json({ error: 'No se pudo marcar listo', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ...data })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('station route error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
