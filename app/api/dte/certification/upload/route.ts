export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { parseSetDePruebas } from '@/lib/dte/certification-parser'

// ══════════════════════════════════════════════════════════════════════════════
//  POST /api/dte/certification/upload
//
//  Upload and parse SII SET_DE_PRUEBAS file for certification
//  
//  Requirements: 1.1-1.6, 2.1-2.10, 15.1
// ══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  let requestBody: {
    restaurant_id: string
    file_content: string
    file_name: string
  }

  try {
    requestBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Se esperaba JSON válido en el cuerpo de la petición' }, { status: 400 })
  }

  const { restaurant_id, file_content, file_name } = requestBody

  // Validate required fields
  if (!restaurant_id || typeof restaurant_id !== 'string') {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  if (!file_content || typeof file_content !== 'string') {
    return NextResponse.json({ error: 'file_content requerido' }, { status: 400 })
  }

  if (!file_name || typeof file_name !== 'string') {
    return NextResponse.json({ error: 'file_name requerido' }, { status: 400 })
  }

  // Validate restaurant access (owner/admin only)
  const { user, error: authErr } = await requireRestaurantRole(restaurant_id, ['owner', 'admin'])
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Validate file format is plain text
  if (!file_content.trim()) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  }

  // Parse the SET_DE_PRUEBAS file
  let parsedSet
  try {
    parsedSet = parseSetDePruebas(file_content)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido al parsear el archivo'
    return NextResponse.json({ 
      error: `Formato de archivo inválido: ${errorMessage}` 
    }, { status: 400 })
  }

  // Validate parsed data
  if (!parsedSet.attention_number || !parsedSet.set_type || parsedSet.cases.length === 0) {
    return NextResponse.json({ 
      error: 'El archivo no contiene casos de prueba válidos del SII' 
    }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    // Start transaction
    const { data: testSet, error: insertError } = await supabase
      .from('test_sets')
      .insert({
        restaurant_id,
        attention_number: parsedSet.attention_number,
        set_type: parsedSet.set_type,
        file_name,
        file_content,
        case_count: parsedSet.cases.length,
        uploaded_by: user.id
      })
      .select('id')
      .single()

    if (insertError) {
      // Check for unique constraint violation
      if (insertError.code === '23505' && insertError.message.includes('unique_attention_number')) {
        return NextResponse.json({ 
          error: `Ya existe un set de pruebas con el número de atención ${parsedSet.attention_number}` 
        }, { status: 409 })
      }
      
      console.error('Error inserting test_set:', insertError)
      return NextResponse.json({ error: 'Error almacenando el set de pruebas' }, { status: 500 })
    }

    const test_set_id = testSet.id

    // Batch insert test_cases
    const testCasesData = parsedSet.cases.map(testCase => ({
      test_set_id,
      case_number: testCase.case_number,
      document_type: testCase.document_type,
      items: testCase.items,
      receptor_data: testCase.receptor_data || null,
      reference_data: testCase.reference_data || null,
      global_discount: testCase.global_discount || null,
      export_data: testCase.export_data || null,
      liquidacion_data: testCase.liquidacion_data || null,
      raw_text: testCase.raw_text
    }))

    const { error: casesError } = await supabase
      .from('test_cases')
      .insert(testCasesData)

    if (casesError) {
      console.error('Error inserting test_cases:', casesError)
      // Clean up the test_set if cases insertion failed
      await supabase
        .from('test_sets')
        .delete()
        .eq('id', test_set_id)
      
      return NextResponse.json({ error: 'Error almacenando los casos de prueba' }, { status: 500 })
    }

    // Log upload event to certification_logs
    await supabase
      .from('certification_logs')
      .insert({
        restaurant_id,
        test_set_id,
        event_type: 'upload',
        event_data: {
          file_name,
          attention_number: parsedSet.attention_number,
          set_type: parsedSet.set_type,
          case_count: parsedSet.cases.length
        },
        user_id: user.id
      })

    // Prepare case summary for response
    const caseSummary = parsedSet.cases.map(testCase => ({
      case_number: testCase.case_number,
      document_type: testCase.document_type,
      item_count: testCase.items.length
    }))

    return NextResponse.json({
      test_set_id,
      attention_number: parsedSet.attention_number,
      set_type: parsedSet.set_type,
      case_count: parsedSet.cases.length,
      cases: caseSummary
    }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error in certification upload:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}