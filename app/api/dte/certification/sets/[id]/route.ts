export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ══════════════════════════════════════════════════════════════════════════════
//  DELETE /api/dte/certification/sets/[id]
//
//  Delete a certification test set (soft delete)
//  
//  Requirements: 9.4, 9.7
// ══════════════════════════════════════════════════════════════════════════════

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  // Await params if it's a Promise (Next.js 15+)
  const params = await Promise.resolve(context.params)
  const test_set_id = params.id
  const { searchParams } = new URL(req.url)
  const restaurant_id = searchParams.get('restaurant_id')

  // Validate required parameters
  if (!test_set_id || typeof test_set_id !== 'string') {
    return NextResponse.json({ error: 'test_set_id requerido' }, { status: 400 })
  }

  if (!restaurant_id || typeof restaurant_id !== 'string') {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  // Validate restaurant access (owner/admin only)
  const { user, error: authErr } = await requireRestaurantRole(restaurant_id, ['owner', 'admin'])
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()

  try {
    // Verify test set exists and belongs to this restaurant
    const { data: testSet, error: testSetError } = await supabase
      .from('test_sets')
      .select('id, status')
      .eq('id', test_set_id)
      .eq('restaurant_id', restaurant_id)
      .maybeSingle()

    if (testSetError || !testSet) {
      return NextResponse.json({ error: 'Set de pruebas no encontrado' }, { status: 404 })
    }

    // Check if already deleted
    if (testSet.status === 'deleted') {
      return NextResponse.json({ error: 'Este set de pruebas ya fue eliminado' }, { status: 410 })
    }

    // Mark test_set as deleted (soft delete)
    const { error: updateError } = await supabase
      .from('test_sets')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', test_set_id)

    if (updateError) {
      console.error('Error marking test set as deleted:', updateError)
      return NextResponse.json({ error: 'Error al eliminar el set de pruebas' }, { status: 500 })
    }

    // Get all test cases for this set
    const { data: testCases, error: testCasesError } = await supabase
      .from('test_cases')
      .select('emission_id')
      .eq('test_set_id', test_set_id)
      .not('emission_id', 'is', null)

    if (!testCasesError && testCases && testCases.length > 0) {
      const emissionIds = testCases.map((tc: { emission_id: string | null }) => tc.emission_id).filter(Boolean) as string[]

      if (emissionIds.length > 0) {
        // Mark all associated emissions as cancelled
        const { error: emissionsError } = await supabase
          .from('dte_emissions')
          .update({ status: 'cancelled' })
          .in('id', emissionIds)

        if (emissionsError) {
          console.error('Error marking emissions as cancelled:', emissionsError)
          // Continue anyway - test set is already marked as deleted
        }
      }
    }

    // Log deletion event to certification_logs
    await supabase
      .from('certification_logs')
      .insert({
        restaurant_id,
        test_set_id,
        event_type: 'delete',
        event_data: {
          deleted_at: new Date().toISOString()
        },
        user_id: user.id
      })

    // Return success response
    return NextResponse.json({
      success: true,
      test_set_id,
      message: 'Set de pruebas eliminado exitosamente'
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error in certification set deletion:', error)
    
    // Log error event
    await supabase
      .from('certification_logs')
      .insert({
        restaurant_id,
        test_set_id,
        event_type: 'delete_error',
        event_data: {
          error: error instanceof Error ? error.message : 'Error desconocido'
        },
        user_id: user.id
      })

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
