import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── Schema ───────────────────────────────────────────────────────────────────

const ClaimSchema = z.object({
  restaurant_id: z.string().uuid(),
  owner_name:    z.string().min(2).max(100),
  owner_email:   z.string().email(),
  owner_phone:   z.string().max(20).optional(),
  claimant_rut:  z.string().max(15).optional(),
  message:       z.string().max(500).optional(), // "Soy el dueño porque…"
})

// ── POST /api/restaurants/claim ──────────────────────────────────────────────
// Submit a claim request for an unclaimed restaurant

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = ClaimSchema.parse(body)

    const supabase = createAdminClient()

    // 1. Verify restaurant exists and is unclaimed
    const { data: restaurant, error: findErr } = await supabase
      .from('restaurants')
      .select('id, name, slug, claimed')
      .eq('id', data.restaurant_id)
      .single()

    if (findErr || !restaurant) {
      return NextResponse.json(
        { error: 'Restaurante no encontrado' },
        { status: 404 }
      )
    }

    if (restaurant.claimed) {
      return NextResponse.json(
        { error: 'Este restaurante ya fue reclamado' },
        { status: 409 }
      )
    }

    // 2. Check for existing pending claim
    const { data: existingClaim } = await supabase
      .from('restaurant_claims')
      .select('id')
      .eq('restaurant_id', data.restaurant_id)
      .eq('status', 'pending')
      .single()

    if (existingClaim) {
      return NextResponse.json(
        { error: 'Ya existe una solicitud pendiente para este restaurante' },
        { status: 409 }
      )
    }

    // 3. Create claim request
    const { data: claim, error: claimErr } = await supabase
      .from('restaurant_claims')
      .insert({
        restaurant_id: data.restaurant_id,
        owner_name:    data.owner_name,
        owner_email:   data.owner_email,
        owner_phone:   data.owner_phone  || null,
        claimant_rut:  data.claimant_rut || null,
        message:       data.message      || null,
        status:        'pending',
      })
      .select('id')
      .single()

    if (claimErr) {
      console.error('Claim insert error:', claimErr)
      return NextResponse.json(
        { error: 'No se pudo procesar la solicitud' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      claim_id: claim.id,
      restaurant_name: restaurant.name,
      message: '¡Solicitud recibida! Revisaremos tu solicitud pronto.',
    }, { status: 201 })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: err.issues },
        { status: 400 }
      )
    }
    console.error('Claim route error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── PATCH /api/restaurants/claim — approve/reject (admin) ────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = z.object({
      claim_id:  z.string().uuid(),
      action:    z.enum(['approve', 'reject']),
      admin_key: z.string(),
    }).parse(body)

    if (parsed.admin_key !== (process.env.ADMIN_SEED_KEY || process.env.ADMIN_SECRET)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Get claim
    const { data: claim, error: claimErr } = await supabase
      .from('restaurant_claims')
      .select('id, restaurant_id, status')
      .eq('id', parsed.claim_id)
      .single()

    if (claimErr || !claim) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    if (claim.status !== 'pending') {
      return NextResponse.json({ error: 'Solicitud ya procesada' }, { status: 409 })
    }

    if (parsed.action === 'approve') {
      // Mark restaurant as claimed + verified + transitionar data_source.
      // Después de approve, el restaurant deja de ser 'agent_enriched' y pasa
      // a ser 'owner_claimed' — esto es lo que controla si genera comisión.
      await supabase
        .from('restaurants')
        .update({
          claimed:     true,
          verified:    true,
          claimed_at:  new Date().toISOString(),
          data_source: 'owner_claimed',
        })
        .eq('id', claim.restaurant_id)

      // Update claim status
      await supabase
        .from('restaurant_claims')
        .update({ status: 'approved', resolved_at: new Date().toISOString() })
        .eq('id', parsed.claim_id)

      return NextResponse.json({ ok: true, action: 'approved' })
    } else {
      // Reject
      await supabase
        .from('restaurant_claims')
        .update({ status: 'rejected', resolved_at: new Date().toISOString() })
        .eq('id', parsed.claim_id)

      return NextResponse.json({ ok: true, action: 'rejected' })
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
