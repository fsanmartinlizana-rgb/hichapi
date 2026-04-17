export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ══════════════════════════════════════════════════════════════════════════════
//  DELETE /api/dte/caf/[id]
//
//  Deletes a CAF file. Only allowed if no emissions have used this CAF yet.
// ══════════════════════════════════════════════════════════════════════════════

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cafId } = await params

  if (!cafId) {
    return NextResponse.json({ error: 'CAF ID requerido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Get CAF to verify ownership
  const { data: caf } = await supabase
    .from('dte_caf_files')
    .select('restaurant_id')
    .eq('id', cafId)
    .maybeSingle()

  if (!caf) {
    return NextResponse.json({ error: 'CAF no encontrado' }, { status: 404 })
  }

  // Check auth
  const { error: authErr } = await requireRestaurantRole(caf.restaurant_id, ['owner', 'admin'])
  if (authErr) return authErr

  // Check if any emissions have used this CAF
  const { data: emissions } = await supabase
    .from('dte_emissions')
    .select('id')
    .eq('caf_id', cafId)
    .limit(1)

  if (emissions && emissions.length > 0) {
    return NextResponse.json(
      { error: 'No se puede eliminar un CAF que ya ha sido usado para emitir documentos' },
      { status: 400 }
    )
  }

  // Delete the CAF
  const { error: deleteErr } = await supabase
    .from('dte_caf_files')
    .delete()
    .eq('id', cafId)

  if (deleteErr) {
    console.error('CAF delete error:', deleteErr)
    return NextResponse.json({ error: 'No se pudo eliminar el CAF' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
