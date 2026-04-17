export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { countAvailableFolios, ActiveCaf } from '@/lib/dte/folio'

// ══════════════════════════════════════════════════════════════════════════════
//  GET /api/dte/folios?restaurant_id=...
//
//  Returns available folio counts per document type (33, 39, 41, 56, 61).
//  Restricted to owner/admin/supervisor/cajero.
//
//  Requirements: 2.5, 6.1, 10.1
// ══════════════════════════════════════════════════════════════════════════════

const DOCUMENT_TYPES = [33, 39, 41, 56, 61] as const

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(
    restaurantId,
    ['owner', 'admin', 'supervisor', 'cajero']
  )
  if (authErr) return authErr

  const supabase = createAdminClient()

  // Fetch all active CAFs for this restaurant in a single query
  const { data: cafs, error: cafsErr } = await supabase
    .from('dte_cafs')
    .select('document_type, folio_desde, folio_hasta, folio_actual, expires_at, status')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'active')

  if (cafsErr) {
    console.error('GET /api/dte/folios query error:', cafsErr)
    return NextResponse.json({ error: 'Error consultando folios' }, { status: 500 })
  }

  const allCafs = cafs ?? []

  // Compute available folio count per document type
  const counts = DOCUMENT_TYPES.reduce<Record<number, number>>((acc, docType) => {
    const typeCafs = allCafs
      .filter((c: any) => c.document_type === docType)
      .map((c: any) => ({
        folio_desde:  c.folio_desde,
        folio_hasta:  c.folio_hasta,
        folio_actual: c.folio_actual,
        expires_at:   c.expires_at ?? null,
        status:       c.status as ActiveCaf['status'],
      }))

    acc[docType] = countAvailableFolios(typeCafs)
    return acc
  }, {})

  return NextResponse.json({
    folios: {
      33: counts[33],
      39: counts[39],
      41: counts[41],
      56: counts[56],
      61: counts[61],
    },
  })
}
