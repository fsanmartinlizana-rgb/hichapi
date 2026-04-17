export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ══════════════════════════════════════════════════════════════════════════════
//  POST /api/dte/aec  — registrar acuse de recibo (AEC) de una emisión DTE
//
//  Flow:
//    1. Validate inputs (restaurant_id, emission_id, aec_status)
//    2. Authenticate with requireRestaurantRole (owner, admin, supervisor)
//    3. Verify emission exists and belongs to the restaurant
//    4. Verify emission is of type 33, 56, or 61 (only facturas have AEC)
//    5. Update dte_emissions with aec_status, aec_fecha, aec_glosa
//    6. Return { ok: true } on success
//
//  Requirements: 8.1, 8.2, 8.3
// ══════════════════════════════════════════════════════════════════════════════

// ── Request schema ────────────────────────────────────────────────────────────

const AecSchema = z.object({
  restaurant_id: z.string().uuid(),
  emission_id:   z.string().uuid(),
  aec_status:    z.enum(['aceptado', 'rechazado', 'reclamado']),
  aec_glosa:     z.string().max(500).optional(),
})

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: z.infer<typeof AecSchema>
  try {
    body = AecSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { user, error: authErr } = await requireRestaurantRole(
    body.restaurant_id,
    ['owner', 'admin', 'supervisor']
  )
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No auth' }, { status: 401 })

  const supabase = createAdminClient()

  // Verify emission exists and belongs to the restaurant
  const { data: emission, error: fetchErr } = await supabase
    .from('dte_emissions')
    .select('id, document_type')
    .eq('id', body.emission_id)
    .eq('restaurant_id', body.restaurant_id)
    .single()

  if (fetchErr || !emission) {
    return NextResponse.json({ error: 'Emisión no encontrada' }, { status: 404 })
  }

  // Only facturas (33), notas de débito (56) and notas de crédito (61) support AEC
  const AEC_APPLICABLE_TYPES = [33, 56, 61]
  if (!AEC_APPLICABLE_TYPES.includes(emission.document_type)) {
    return NextResponse.json({ error: 'AEC_NOT_APPLICABLE' }, { status: 400 })
  }

  // Update emission with AEC data
  const { error: updateErr } = await supabase
    .from('dte_emissions')
    .update({
      aec_status: body.aec_status,
      aec_fecha:  new Date().toISOString(),
      aec_glosa:  body.aec_glosa ?? null,
    })
    .eq('id', body.emission_id)
    .eq('restaurant_id', body.restaurant_id)

  if (updateErr) {
    console.error('dte/aec update error:', updateErr)
    return NextResponse.json({ error: 'No se pudo actualizar el acuse de recibo' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
