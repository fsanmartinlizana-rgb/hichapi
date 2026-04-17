export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { listCafs, uploadCaf } from '@/lib/dte/caf'

// ══════════════════════════════════════════════════════════════════════════════
//  GET  /api/dte/caf?restaurant_id=...
//  POST /api/dte/caf  (multipart/form-data: file + restaurant_id)
//
//  Requirements: 1.1, 1.2, 1.3, 1.4, 1.7
// ══════════════════════════════════════════════════════════════════════════════

// ── Error code → HTTP status mapping ─────────────────────────────────────────

function cafErrorStatus(errorCode: string): number {
  if (errorCode.startsWith('CAF_INVALID_XML')) return 400
  if (errorCode.startsWith('CAF_RUT_MISMATCH')) return 400
  if (errorCode.startsWith('CAF_CERT_MISMATCH')) return 400
  if (errorCode.startsWith('CERT_REQUIRED')) return 403
  if (errorCode.startsWith('CAF_OVERLAP')) return 409
  return 400
}

// ── GET — list CAFs for a restaurant ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin'])
  if (authErr) return authErr

  const cafs = await listCafs(restaurantId)
  return NextResponse.json({ cafs })
}

// ── POST — upload a new CAF XML file ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Se esperaba multipart/form-data' }, { status: 400 })
  }

  const restaurantId = formData.get('restaurant_id')
  if (!restaurantId || typeof restaurantId !== 'string') {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { user, error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin'])
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No auth' }, { status: 401 })

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Se esperaba un archivo XML en el campo "file"' }, { status: 400 })
  }

  // Read file content as text
  let xmlContent: string
  try {
    xmlContent = await file.text()
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo' }, { status: 400 })
  }

  if (!xmlContent.trim()) {
    return NextResponse.json({ error: 'El archivo XML está vacío' }, { status: 400 })
  }

  const result = await uploadCaf(restaurantId, xmlContent, user.id)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: cafErrorStatus(result.error) })
  }

  return NextResponse.json({ ok: true, caf_id: result.caf_id }, { status: 201 })
}
