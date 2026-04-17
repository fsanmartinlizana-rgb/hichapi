export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { checkDteStatus, getSiiToken, getSiiTokenFactura, queryEstDteFactura, SiiEnvironment } from '@/lib/dte/sii-client'
import { loadCredentials } from '@/lib/dte/signer'

// ══════════════════════════════════════════════════════════════════════════════
//  POST /api/dte/status
//
//  Polls the SII for the status of a previously submitted DTE emission.
//  Updates the emission row: accepted → status='accepted', accepted_at=now();
//                            rejected → status='rejected', error_detail=detail
//
//  For type 33 (factura): uses SOAP QueryEstDte via queryEstDteFactura.
//  For types 39/41 (boleta): uses existing checkDteStatus flow.
//
//  Restricted to owner/admin.
//
//  Requirements: 4.5, 4.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
// ══════════════════════════════════════════════════════════════════════════════

const StatusSchema = z.object({
  restaurant_id: z.string().uuid(),
  emission_id:   z.string().uuid(),
})

// Maps DB dte_environment value to SiiEnvironment type
function toSiiEnvironment(dbValue: string | null | undefined): SiiEnvironment {
  if (dbValue === 'production') return 'produccion'
  return 'certificacion'
}

// Rejection states returned by QueryEstDte
const REJECTION_STATES = ['RFR', 'RCT', 'FAU', 'FNA']

export async function POST(req: NextRequest) {
  let body: z.infer<typeof StatusSchema>
  try {
    body = StatusSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()

  // Load emission + restaurant in parallel
  const [emissionResult, restaurantResult] = await Promise.all([
    supabase
      .from('dte_emissions')
      .select('id, sii_track_id, status, document_type, folio, emitted_at, total_amount, rut_receptor')
      .eq('id', body.emission_id)
      .eq('restaurant_id', body.restaurant_id)
      .maybeSingle(),
    supabase
      .from('restaurants')
      .select('rut, dte_environment')
      .eq('id', body.restaurant_id)
      .maybeSingle(),
  ])

  if (emissionResult.error) {
    console.error('GET emission error:', emissionResult.error)
    return NextResponse.json({ error: 'Error consultando la emisión' }, { status: 500 })
  }

  const emission = emissionResult.data
  if (!emission) {
    return NextResponse.json({ error: 'Emisión no encontrada' }, { status: 404 })
  }

  if (!emission.sii_track_id) {
    return NextResponse.json(
      { error: 'La emisión no tiene track_id del SII. Debe estar en estado "sent" o posterior.' },
      { status: 400 }
    )
  }

  const restaurant = restaurantResult.data
  const environment = toSiiEnvironment(restaurant?.dte_environment)

  // Get SII credentials
  const creds = await loadCredentials(body.restaurant_id)
  if ('error' in creds) {
    return NextResponse.json({ error: `Error cargando credenciales: ${creds.error}` }, { status: 500 })
  }

  // ── Branch by document type ───────────────────────────────────────────────

  if (emission.document_type === 33) {
    // ── Factura electrónica: use QueryEstDte SOAP ─────────────────────────

    // Validate rut_receptor format (strip dots, then check XXXXXXXX-X pattern)
    const rawRut = (emission.rut_receptor ?? '').replace(/\./g, '')
    const rutReceptorValid = /^\d{7,8}-[\dkK]$/.test(rawRut)

    if (!rutReceptorValid) {
      await supabase
        .from('dte_emissions')
        .update({ error_detail: 'RECEPTOR_DATOS_INVALIDOS_PARA_CONSULTA' })
        .eq('id', body.emission_id)

      return NextResponse.json(
        { error: 'RECEPTOR_DATOS_INVALIDOS_PARA_CONSULTA' },
        { status: 400 }
      )
    }

    // Get token using factura SOAP endpoint
    const tokenResult = await getSiiTokenFactura(creds.privateKeyPem, creds.certificate, environment)
    if (!tokenResult.token) {
      return NextResponse.json({ error: `Error obteniendo token SII: ${tokenResult.error}` }, { status: 502 })
    }

    // Query individual DTE status
    const queryResult = await queryEstDteFactura(
      {
        rutConsultante: restaurant?.rut ?? '',
        rutCompania:    restaurant?.rut ?? '',
        rutReceptor:    rawRut,
        tipoDte:        33,
        folioDte:       emission.folio,
        fechaEmisionDte: (emission.emitted_at as string).split('T')[0], // YYYY-MM-DD
        montoDte:       emission.total_amount,
        token:          tokenResult.token,
      },
      environment
    )

    if (queryResult.error) {
      return NextResponse.json({ error: queryResult.error }, { status: 502 })
    }

    const now = new Date().toISOString()
    const errorDetailJson = JSON.stringify({ estado: queryResult.estado, glosa: queryResult.glosa })

    if (queryResult.estado === 'DOK') {
      await supabase
        .from('dte_emissions')
        .update({ status: 'accepted', accepted_at: now, error_detail: errorDetailJson })
        .eq('id', body.emission_id)
    } else if (queryResult.estado && REJECTION_STATES.includes(queryResult.estado)) {
      await supabase
        .from('dte_emissions')
        .update({
          status:       'rejected',
          error_detail: errorDetailJson,
        })
        .eq('id', body.emission_id)
    } else {
      // Pending or unknown state — just save traceability info
      await supabase
        .from('dte_emissions')
        .update({ error_detail: errorDetailJson })
        .eq('id', body.emission_id)
    }

    return NextResponse.json({
      ok:    true,
      status: queryResult.estado,
      glosa:  queryResult.glosa,
    })

  } else {
    // ── Boleta (types 39/41): keep existing flow unchanged ────────────────

    const tokenResult = await getSiiToken(creds.privateKeyPem, creds.certificate, environment)
    if (!tokenResult.token) {
      return NextResponse.json({ error: `Error obteniendo token SII: ${tokenResult.error}` }, { status: 502 })
    }

    // Poll SII for current status
    const pollResult = await checkDteStatus(
      emission.sii_track_id,
      restaurant?.rut ?? '',
      tokenResult.token,
      environment
    )

    if (!pollResult.success) {
      return NextResponse.json({ error: pollResult.error }, { status: 502 })
    }

    const siiStatus = pollResult.sii_response?.estado ?? pollResult.status
    const now = new Date().toISOString()

    // EPR with aceptados > 0 = accepted
    const estadistica = pollResult.sii_response?.estadistica ?? []
    const aceptados = estadistica.reduce((sum: number, s: any) => sum + (s.aceptados ?? 0), 0)
    const rechazados = estadistica.reduce((sum: number, s: any) => sum + (s.rechazados ?? 0), 0)

    if (siiStatus === 'EPR' && aceptados > 0 && rechazados === 0) {
      await supabase
        .from('dte_emissions')
        .update({ status: 'accepted', accepted_at: now })
        .eq('id', body.emission_id)
    } else if (rechazados > 0 || siiStatus === 'RFR') {
      const detalle = pollResult.sii_response?.detalle_rep_rech?.[0]?.error?.[0]?.descripcion
      await supabase
        .from('dte_emissions')
        .update({ status: 'rejected', error_detail: detalle ?? 'Rechazado por el SII' })
        .eq('id', body.emission_id)
    }

    return NextResponse.json({
      ok:           true,
      status:       siiStatus,
      aceptados,
      rechazados,
      sii_response: pollResult.sii_response,
    })
  }
}
