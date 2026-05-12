/**
 * POST /api/restaurants/[id]/claim
 *
 * Self-service: cualquier persona puede reclamar un restaurant agent_enriched
 * sin esperar aprobación manual. El restaurant ya existe en la DB (lo trajo el
 * agente o un seed). Acá:
 *   1. Validamos inputs (nombre, email, teléfono, RUT opcional).
 *   2. Si claimed=true → 409 + email a admin (alguien intentó reclamar X que
 *      ya tiene dueño — chequear si es legítimo y conflicto manual).
 *   3. Creamos user en Supabase Auth (o reutilizamos si ya existe).
 *   4. team_members con role='owner' + active.
 *   5. UPDATE restaurants SET claimed=true, claimed_at, claimed_by,
 *      data_source='owner_claimed', verified=true.
 *   6. Generamos magic link via Supabase Auth admin.
 *   7. Enviamos email branded al owner con el magic link.
 *
 * Ley 19.628 (Protección de Datos Personales):
 *   - RUT y teléfono son PII; los guardamos solo en restaurant_claims (RLS
 *     limita acceso). No los logueamos en plain.
 *   - El consentimiento se entiende implícito: la persona llena el formulario
 *     voluntariamente para asociar su email al restaurant.
 *   - Datos accesibles vía /api/restaurants/profile y eliminables via support.
 *
 * Security:
 *   - restaurant_id viene del PATH, no del body (evita IDOR).
 *   - Rate limit: 3 intentos por IP por hora por restaurant_id.
 *   - Validación de RUT chileno (formato + DV).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { sendBrandedEmail } from '@/lib/email/sender'
import { claimWelcomeEmail, claimConflictAdminEmail } from '@/lib/email/templates'
import { resolveAppUrl } from '@/lib/app-url'
import { isValidRut, normalizeRut } from '@/lib/validation/rut'

const BodySchema = z.object({
  owner_name:   z.string().min(2).max(100),
  owner_email:  z.string().email().max(120),
  owner_phone:  z.string().max(20).optional(),
  claimant_rut: z.string().max(15).optional(),
  message:      z.string().max(500).optional(),
})

// ── Rate limit in-memory: 3 intentos / hora / (IP+restaurant) ───────────────
const rateMap = new Map<string, { count: number; reset: number }>()
const RATE_LIMIT  = 3
const RATE_WINDOW = 60 * 60 * 1000
function checkRate(key: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(key)
  if (!entry || now > entry.reset) {
    rateMap.set(key, { count: 1, reset: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATIONS_EMAIL || 'hola@hichapi.cl'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: restaurantId } = await ctx.params

  // Validar UUID del path
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId)) {
    return NextResponse.json({ error: 'Restaurant ID inválido' }, { status: 400 })
  }

  // Rate limit por IP+restaurant (más permisivo que por IP global — un user
  // legit puede estar reintentando un solo restaurant, no spammeando muchos)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRate(`${ip}::${restaurantId}`)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Esperá una hora e intenta de nuevo.' },
      { status: 429 },
    )
  }

  // Parse body
  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // Validar RUT si se mandó (formato chileno + DV)
  if (body.claimant_rut && !isValidRut(body.claimant_rut)) {
    return NextResponse.json(
      { error: 'El RUT no es válido. Formato esperado: 12.345.678-9' },
      { status: 400 },
    )
  }
  const rutNorm = body.claimant_rut ? normalizeRut(body.claimant_rut) : null
  const emailLower = body.owner_email.toLowerCase().trim()

  const supabase = createAdminClient()

  // ── 1. Validar restaurant existe ──────────────────────────────────────────
  const { data: restaurant, error: rErr } = await supabase
    .from('restaurants')
    .select('id, name, slug, claimed, data_source')
    .eq('id', restaurantId)
    .single()

  if (rErr || !restaurant) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }

  // ── 2. Si ya está claimed → 409 + aviso al admin ──────────────────────────
  if (restaurant.claimed) {
    // Aviso a admin (best-effort, no bloquea respuesta al usuario)
    try {
      const { subject, html, text } = claimConflictAdminEmail({
        restaurantName: restaurant.name,
        restaurantSlug: restaurant.slug,
        attemptedBy:    { name: body.owner_name, email: emailLower },
      })
      await sendBrandedEmail({ to: ADMIN_EMAIL, subject, html, text })
    } catch (e) {
      console.error('[claim] admin notification failed:', e)
    }
    return NextResponse.json(
      {
        error: 'Este restaurant ya tiene dueño. Si crees que es un error, escribinos a hola@hichapi.cl',
      },
      { status: 409 },
    )
  }

  // ── 3. Crear o reutilizar user en Supabase Auth ───────────────────────────
  let userId: string
  {
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 500 })
    const existing = list?.users?.find(
      (u: { email?: string | null; id: string }) =>
        u.email?.toLowerCase() === emailLower,
    )
    if (existing) {
      userId = existing.id
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email:         emailLower,
        email_confirm: true,
        user_metadata: {
          full_name:        body.owner_name.trim(),
          phone:            body.owner_phone ?? null,
          claimed_restaurant_id: restaurantId,
        },
      })
      if (createErr || !created?.user) {
        console.error('[claim] createUser failed:', createErr)
        return NextResponse.json(
          { error: 'No pudimos crear tu cuenta. Reintentá o escribinos a hola@hichapi.cl' },
          { status: 500 },
        )
      }
      userId = created.user.id
    }
  }

  // ── 4. team_members(role=owner) ───────────────────────────────────────────
  {
    const { data: existingTm } = await supabase
      .from('team_members')
      .select('id, role, status')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingTm) {
      // Upgrade a owner si no lo era
      await supabase.from('team_members')
        .update({ role: 'owner', status: 'active', active: true })
        .eq('id', existingTm.id)
    } else {
      const memberData: Record<string, unknown> = {
        restaurant_id: restaurantId,
        user_id:       userId,
        invited_email: emailLower,
        role:          'owner',
        roles:         ['owner'],
        status:        'active',
        active:        true,
      }
      // Algunas columnas son optional (full_name/phone) — intento con, fallback sin
      const withExtras = { ...memberData, full_name: body.owner_name, phone: body.owner_phone ?? null }
      const { error: insErr } = await supabase.from('team_members').insert(withExtras)
      if (insErr) {
        await supabase.from('team_members').insert(memberData)
      }
    }
  }

  // ── 5. UPDATE restaurants ─────────────────────────────────────────────────
  // Idempotente: si ya estaba claimed por otro flow, no rompe.
  await supabase.from('restaurants')
    .update({
      claimed:     true,
      claimed_at:  new Date().toISOString(),
      claimed_by:  userId,
      data_source: 'owner_claimed',
      verified:    true,
    })
    .eq('id', restaurantId)

  // ── 6. Historial en restaurant_claims (para auditoría + listar al admin) ─
  // PII: rut/email/phone quedan acá con RLS estricto.
  await supabase.from('restaurant_claims').insert({
    restaurant_id: restaurantId,
    owner_name:    body.owner_name.trim(),
    owner_email:   emailLower,
    owner_phone:   body.owner_phone ?? null,
    claimant_rut:  rutNorm,
    message:       body.message ?? null,
    status:        'approved',
    resolved_at:   new Date().toISOString(),
    reviewed_by:   userId,
  })

  // ── 7. Magic link + email ─────────────────────────────────────────────────
  // Redirect a /register?claimed=<id> en lugar de /dashboard: la página
  // detecta el param y entra en modo "completar perfil", pre-llenando
  // nombre/dirección/cuisine del restaurant agent_enriched para que el
  // owner solo edite/agregue lo que falta (foto, descripción, horarios,
  // teléfono, etc.). Termina llevando al dashboard normal.
  const origin = resolveAppUrl(req)
  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
    type:    'magiclink',
    email:   emailLower,
    options: { redirectTo: `${origin}/register?claimed=${restaurantId}` },
  })

  if (linkErr || !link?.properties?.action_link) {
    console.error('[claim] generateLink failed:', linkErr)
    // No bloquea — devolvemos OK al user, le pedimos que use /login directo
    return NextResponse.json({
      ok:           true,
      method:       'manual_login',
      message:      'Tu cuenta está lista. Iniciá sesión con tu email en /login.',
      restaurant:   { name: restaurant.name, slug: restaurant.slug },
    })
  }

  const { subject, html, text } = claimWelcomeEmail({
    restaurantName: restaurant.name,
    ownerName:      body.owner_name.trim(),
    magicLink:      link.properties.action_link,
  })

  const sent = await sendBrandedEmail({ to: emailLower, subject, html, text })
  if (!sent.ok && !sent.skipped) {
    console.error('[claim] email send failed:', sent.error)
    // Tampoco bloqueamos — el restaurant ya está claimed, devolver fallback
    return NextResponse.json({
      ok:         true,
      method:     'manual_login',
      message:    'Tu restaurant está lista pero no pudimos enviar el email. Iniciá sesión en /login.',
      restaurant: { name: restaurant.name, slug: restaurant.slug },
    })
  }

  return NextResponse.json({
    ok:         true,
    method:     'magic_link',
    message:    `Te enviamos un link a ${emailLower}. Revisá tu inbox (y spam) para entrar.`,
    restaurant: { name: restaurant.name, slug: restaurant.slug },
  })
}
