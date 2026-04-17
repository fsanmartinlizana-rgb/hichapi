export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/dte/debug?restaurant_id=...
 * 
 * Debug endpoint to check DTE configuration status
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Check credentials
  const { data: creds, error: credsErr } = await supabase
    .from('dte_credentials')
    .select('cert_base64, cert_password, rut_envia, fecha_resolucion, numero_resolucion, cert_subject, cert_valid_to')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  // Check CAFs
  const { data: cafs, error: cafsErr } = await supabase
    .from('dte_cafs')
    .select('id, document_type, folio_desde, folio_hasta, folio_actual, status, caf_xml')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'active')

  return NextResponse.json({
    credentials: {
      exists: !!creds,
      has_cert_base64: !!creds?.cert_base64,
      has_cert_password: !!creds?.cert_password,
      has_rut_envia: !!creds?.rut_envia,
      has_fecha_resolucion: !!creds?.fecha_resolucion,
      has_numero_resolucion: !!creds?.numero_resolucion,
      cert_subject: creds?.cert_subject,
      cert_valid_to: creds?.cert_valid_to,
      error: credsErr?.message,
    },
    cafs: {
      count: cafs?.length ?? 0,
      active: cafs?.map(c => ({
        id: c.id,
        document_type: c.document_type,
        folio_range: `${c.folio_desde}-${c.folio_hasta}`,
        folio_actual: c.folio_actual,
        has_caf_xml: !!c.caf_xml,
      })) ?? [],
      error: cafsErr?.message,
    },
  })
}
