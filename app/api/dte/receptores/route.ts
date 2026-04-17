export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'

// ══════════════════════════════════════════════════════════════════════════════
//  /api/dte/receptores — Directorio de receptores frecuentes
//
//  GET  ?restaurant_id=...&rut=...
//       Busca receptores por RUT (autocompletado). Si no se pasa rut,
//       devuelve los últimos 20 usados.
//
//  POST { restaurant_id, rut, razon_social, giro, direccion, comuna, email }
//       Upsert: crea o actualiza el receptor, incrementa facturas_emitidas.
//       Llamado automáticamente al emitir una factura exitosa.
// ══════════════════════════════════════════════════════════════════════════════

const UpsertSchema = z.object({
  restaurant_id: z.string().uuid(),
  rut:           z.string().min(1).max(20),
  razon_social:  z.string().min(1).max(200),
  giro:          z.string().max(100).optional(),
  direccion:     z.string().max(150).optional(),
  comuna:        z.string().max(60).optional(),
  email:         z.string().email().optional(),
})

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  const rut          = req.nextUrl.searchParams.get('rut')?.trim()

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(
    restaurantId,
    ['owner', 'admin', 'supervisor', 'cajero']
  )
  if (authErr) return authErr

  const supabase = createAdminClient()

  let query = supabase
    .from('dte_receptores')
    .select('rut, razon_social, giro, direccion, comuna, email, facturas_emitidas, ultima_emision')
    .eq('restaurant_id', restaurantId)
    .order('ultima_emision', { ascending: false })
    .limit(20)

  // Si se pasa rut, filtrar por coincidencia parcial (para autocompletado)
  if (rut) {
    query = query.ilike('rut', `${rut}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Error consultando receptores' }, { status: 500 })
  }

  return NextResponse.json({ receptores: data ?? [] })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: z.infer<typeof UpsertSchema>
  try {
    body = UpsertSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(
    body.restaurant_id,
    ['owner', 'admin', 'supervisor', 'cajero']
  )
  if (authErr) return authErr

  const supabase = createAdminClient()

  // Upsert: si ya existe el RUT para este restaurante, actualizar datos y contador
  const { error } = await supabase
    .from('dte_receptores')
    .upsert(
      {
        restaurant_id:    body.restaurant_id,
        rut:              body.rut,
        razon_social:     body.razon_social,
        giro:             body.giro ?? null,
        direccion:        body.direccion ?? null,
        comuna:           body.comuna ?? null,
        email:            body.email ?? null,
        ultima_emision:   new Date().toISOString(),
        // facturas_emitidas se incrementa via SQL para evitar race conditions
      },
      {
        onConflict:        'restaurant_id,rut',
        ignoreDuplicates:  false,
      }
    )

  // Incrementar contador por separado (upsert no soporta incremento atómico)
  if (!error) {
    await supabase.rpc('increment_receptor_facturas', {
      p_restaurant_id: body.restaurant_id,
      p_rut:           body.rut,
    }).maybeSingle()
    // Si la función RPC no existe aún, no falla — el upsert ya guardó los datos
  }

  if (error) {
    console.error('dte/receptores upsert error:', error)
    return NextResponse.json({ error: 'No se pudo guardar el receptor' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
