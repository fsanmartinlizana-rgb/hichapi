export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { generateCertificationBatch } from '@/lib/dte/certification-engine'

// ══════════════════════════════════════════════════════════════════════════════
//  POST /api/dte/certification/generate
//
//  Generate and sign all DTEs for a certification test set
//  
//  Requirements: 3.1-3.12, 10.1-10.7, 15.2
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

  // Validate restaurant has required data for DTE generation
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('rut, razon_social, giro, direccion, comuna, dte_enabled')
    .eq('id', restaurant_id)
    .maybeSingle()

  if (restaurantError || !restaurant) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }

  if (!restaurant.dte_enabled) {
    return NextResponse.json({ error: 'DTE no habilitado para este restaurante' }, { status: 400 })
  }

  // Validate required restaurant data
  const validationErrors: string[] = []

  if (!restaurant.rut || !restaurant.razon_social) {
    validationErrors.push('RUT y razón social del emisor son requeridos')
  }

  // Check if certificate exists
  const { data: credentials, error: credError } = await supabase
    .from('dte_credentials')
    .select('id, cert_ciphertext')
    .eq('restaurant_id', restaurant_id)
    .maybeSingle()

  if (credError || !credentials || !credentials.cert_ciphertext) {
    validationErrors.push('Certificado digital no encontrado o inválido')
  }

  // Return validation errors if any (solo validamos certificado y datos básicos)
  // Los CAFs y resolución se validarán durante la generación
  if (validationErrors.length > 0) {
    return NextResponse.json({ 
      error: 'Validación fallida', 
      validation_errors: validationErrors 
    }, { status: 400 })
  }

  try {
    // Call generateCertificationBatch() from engine
    const result = await generateCertificationBatch(restaurant_id, test_set_id)

    // Log generation event to certification_logs
    await supabase
      .from('certification_logs')
      .insert({
        restaurant_id,
        test_set_id,
        event_type: 'generate',
        event_data: {
          generated_count: result.generated_count,
          signed_count: result.signed_count,
          error_count: result.errors.length
        },
        user_id: user.id
      })

    // Return generated_count, signed_count, and errors array
    return NextResponse.json({
      test_set_id: result.test_set_id,
      generated_count: result.generated_count,
      signed_count: result.signed_count,
      errors: result.errors
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error in certification generate:', error)
    
    // Log error event
    await supabase
      .from('certification_logs')
      .insert({
        restaurant_id,
        test_set_id,
        event_type: 'generate_error',
        event_data: {
          error: error instanceof Error ? error.message : 'Error desconocido'
        },
        user_id: user.id
      })

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
