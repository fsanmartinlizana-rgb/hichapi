export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { submitCertificationBatch } from '@/lib/dte/certification-engine'

// ══════════════════════════════════════════════════════════════════════════════
//  POST /api/dte/certification/submit
//
//  Submit signed DTEs to SII for certification
//  
//  Requirements: 5.1-5.10, 15.3
// ══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  let requestBody: {
    restaurant_id: string
    test_set_id: string
  }

  try {
    requestBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Se esperaba JSON válido en el cuerpo de la petición' }, { status: 400 })
  }

  const { restaurant_id, test_set_id } = requestBody

  // Validate required fields
  if (!restaurant_id || typeof restaurant_id !== 'string') {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  if (!test_set_id || typeof test_set_id !== 'string') {
    return NextResponse.json({ error: 'test_set_id requerido' }, { status: 400 })
  }

  // Validate restaurant access (owner/admin only)
  const { user, error: authErr } = await requireRestaurantRole(restaurant_id, ['owner', 'admin'])
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()

  // Verify test set exists and belongs to this restaurant
  const { data: testSet, error: testSetError } = await supabase
    .from('test_sets')
    .select('id, status, generated_count')
    .eq('id', test_set_id)
    .eq('restaurant_id', restaurant_id)
    .maybeSingle()

  if (testSetError || !testSet) {
    return NextResponse.json({ error: 'Set de pruebas no encontrado' }, { status: 404 })
  }

  // Verify test set has generated DTEs
  if (!testSet.generated_count || testSet.generated_count === 0) {
    return NextResponse.json({ 
      error: 'No hay DTEs generados para enviar. Primero debe generar los DTEs.' 
    }, { status: 400 })
  }

  // Verify test set is not already submitted
  if (testSet.status === 'submitted' || testSet.status === 'approved') {
    return NextResponse.json({ 
      error: 'Este set de pruebas ya fue enviado al SII' 
    }, { status: 409 })
  }

  try {
    // Call submitCertificationBatch() from engine
    const result = await submitCertificationBatch(restaurant_id, test_set_id)

    if (!result.success) {
      // Log submission error
      await supabase
        .from('certification_logs')
        .insert({
          restaurant_id,
          test_set_id,
          event_type: 'submit_error',
          event_data: {
            error: result.error || 'Error desconocido'
          },
          user_id: user.id
        })

      return NextResponse.json({ 
        error: result.error || 'Error al enviar al SII' 
      }, { status: 500 })
    }

    // Log submission event to certification_logs
    await supabase
      .from('certification_logs')
      .insert({
        restaurant_id,
        test_set_id,
        event_type: 'submit',
        event_data: {
          track_id: result.track_id
        },
        user_id: user.id
      })

    // Update test set with track_id
    await supabase
      .from('test_sets')
      .update({
        track_id: result.track_id
      })
      .eq('id', test_set_id)

    // Return track_id, success status
    return NextResponse.json({
      success: true,
      track_id: result.track_id,
      test_set_id
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error in certification submit:', error)
    
    // Log error event
    await supabase
      .from('certification_logs')
      .insert({
        restaurant_id,
        test_set_id,
        event_type: 'submit_error',
        event_data: {
          error: error instanceof Error ? error.message : 'Error desconocido'
        },
        user_id: user.id
      })

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
