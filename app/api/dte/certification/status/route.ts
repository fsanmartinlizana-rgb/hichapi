export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { checkCertificationStatus } from '@/lib/dte/certification-engine'

// ══════════════════════════════════════════════════════════════════════════════
//  GET /api/dte/certification/status
//
//  Check certification status with SII using track_id
//  
//  Requirements: 7.1-7.8, 15.4
// ══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const track_id = searchParams.get('track_id')
  const restaurant_id = searchParams.get('restaurant_id')

  // Validate required parameters
  if (!track_id || typeof track_id !== 'string') {
    return NextResponse.json({ error: 'track_id requerido' }, { status: 400 })
  }

  if (!restaurant_id || typeof restaurant_id !== 'string') {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  // Validate restaurant access
  const { user, error: authErr } = await requireRestaurantRole(restaurant_id, ['owner', 'admin', 'supervisor'])
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const supabase = createAdminClient()

  // Find test set associated with this track_id
  const { data: testSet, error: testSetError } = await supabase
    .from('test_sets')
    .select('id')
    .eq('restaurant_id', restaurant_id)
    .eq('track_id', track_id)
    .maybeSingle()

  if (testSetError || !testSet) {
    return NextResponse.json({ 
      error: 'No se encontró un set de pruebas con este track_id' 
    }, { status: 404 })
  }

  try {
    // Call checkCertificationStatus() from engine
    const result = await checkCertificationStatus(restaurant_id, track_id)

    // Log status check event to certification_logs
    await supabase
      .from('certification_logs')
      .insert({
        restaurant_id,
        test_set_id: testSet.id,
        event_type: 'status_check',
        event_data: {
          track_id,
          status: result.status,
          accepted: result.accepted,
          details: result.details
        },
        user_id: user.id
      })

    // Return track_id, status, accepted flag, details, and last_checked timestamp
    return NextResponse.json({
      track_id,
      status: result.status,
      accepted: result.accepted,
      details: result.details,
      last_checked: new Date().toISOString()
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error in certification status check:', error)
    
    // Log error event
    await supabase
      .from('certification_logs')
      .insert({
        restaurant_id,
        test_set_id: testSet.id,
        event_type: 'status_check_error',
        event_data: {
          track_id,
          error: error instanceof Error ? error.message : 'Error desconocido'
        },
        user_id: user.id
      })

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
