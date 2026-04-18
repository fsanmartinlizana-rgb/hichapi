export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ══════════════════════════════════════════════════════════════════════════════
//  GET /api/dte/certification/sets
//
//  List all certification test sets for a restaurant
//  
//  Requirements: 6.1-6.8, 9.1-9.7
// ══════════════════════════════════════════════════════════════════════════════

interface TestSet {
  id: string
  attention_number: string
  set_type: string
  file_name: string
  case_count: number
  generated_count: number
  submitted_count: number
  approved_count: number
  status: string
  track_id: string | null
  created_at: string
  updated_at: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const restaurant_id = searchParams.get('restaurant_id')

  // Validate required parameter
  if (!restaurant_id || typeof restaurant_id !== 'string') {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  // Validate restaurant access
  const { error: authErr } = await requireRestaurantRole(restaurant_id, ['owner', 'admin', 'supervisor'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  try {
    // Query test_sets with aggregated counts
    const { data: testSets, error: testSetsError } = await supabase
      .from('test_sets')
      .select(`
        id,
        attention_number,
        set_type,
        file_name,
        case_count,
        generated_count,
        submitted_count,
        approved_count,
        status,
        track_id,
        created_at,
        updated_at
      `)
      .eq('restaurant_id', restaurant_id)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })

    if (testSetsError) {
      console.error('Error fetching test sets:', testSetsError)
      return NextResponse.json({ error: 'Error al obtener los sets de prueba' }, { status: 500 })
    }

    // For each test set, get document type breakdown from test_cases
    const setsWithDetails = await Promise.all(
      (testSets || []).map(async (testSet: TestSet) => {
        const { data: testCases, error: testCasesError } = await supabase
          .from('test_cases')
          .select('document_type, status')
          .eq('test_set_id', testSet.id)

        if (testCasesError) {
          console.error('Error fetching test cases:', testCasesError)
          return {
            ...testSet,
            document_types: {},
            status_breakdown: {}
          }
        }

        // Count document types
        const documentTypes: Record<number, number> = {}
        const statusBreakdown: Record<string, number> = {}

        for (const testCase of testCases || []) {
          documentTypes[testCase.document_type] = (documentTypes[testCase.document_type] || 0) + 1
          statusBreakdown[testCase.status || 'pending'] = (statusBreakdown[testCase.status || 'pending'] || 0) + 1
        }

        return {
          ...testSet,
          document_types: documentTypes,
          status_breakdown: statusBreakdown
        }
      })
    )

    // Return array of test sets with metadata
    return NextResponse.json({
      test_sets: setsWithDetails
    }, { status: 200 })

  } catch (error) {
    console.error('Unexpected error in certification sets list:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
