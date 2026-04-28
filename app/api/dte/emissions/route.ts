import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// GET /api/dte/emissions?restaurant_id=...&limit=50
// Returns the most recent DTE emissions for the given restaurant.

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  const limit        = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200)
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin', 'supervisor', 'cajero'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('dte_emissions')
    .select(`
      id, document_type, folio, status, total_amount, net_amount, iva_amount,
      rut_receptor, razon_receptor, sii_track_id, emitted_at, order_id, error_detail, xml_signed,
      aec_status, aec_fecha, aec_glosa,
      giro_receptor, direccion_receptor, comuna_receptor,
      folio_ref, tipo_doc_ref, razon_ref
    `)
    .eq('restaurant_id', restaurantId)
    .order('emitted_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: 'Error consultando emisiones' }, { status: 500 })
  }

  // Quick stats
  const totals = (data ?? []).reduce(
    (acc: { count: number; gross: number; accepted: number }, row: { status: string; total_amount: number }) => {
      acc.count += 1
      acc.gross += row.total_amount
      if (row.status === 'accepted') acc.accepted += 1
      return acc
    },
    { count: 0, gross: 0, accepted: 0 },
  )

  return NextResponse.json({ emissions: data ?? [], totals })
}
