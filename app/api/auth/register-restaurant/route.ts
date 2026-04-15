import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendBrandedEmail } from '@/lib/email/sender'
import { welcomeEmail } from '@/lib/email/templates'
import { resolveAppUrl } from '@/lib/app-url'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register-restaurant
// Onboarding completo en una sola llamada server-side:
//   1. Crea el usuario en Supabase Auth (auto-confirmado)
//   2. Crea el restaurante con owner_id, active=true, plan=free
//   3. Crea el row en team_members con role=owner para que el panel
//      cargue el restaurante automáticamente al hacer login.
// ─────────────────────────────────────────────────────────────────────────────

const BodySchema = z.object({
  email:        z.string().email(),
  password:     z.string().min(12),
  ownerName:    z.string().min(2).max(100),
  restName:     z.string().min(2).max(100),
  restAddress:  z.string().min(2).max(200),
  restBarrio:   z.string().min(2).max(80),
  restCocina:   z.string().min(2).max(60),
})

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())
    const supabase = createAdminClient()

    // 1. Crear usuario auth (auto-confirmado para que pueda entrar de inmediato)
    const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
      email:         body.email.toLowerCase().trim(),
      password:      body.password,
      email_confirm: true,
      user_metadata: { owner_name: body.ownerName.trim() },
    })

    if (userErr || !userData?.user) {
      const msg = userErr?.message ?? ''
      if (msg.includes('already been registered') || msg.includes('already exists')) {
        return NextResponse.json(
          { error: 'Este email ya tiene una cuenta. Inicia sesión.' },
          { status: 409 }
        )
      }
      console.error('register-restaurant create user error:', userErr)
      return NextResponse.json({ error: 'No pudimos crear tu cuenta.' }, { status: 500 })
    }

    const userId = userData.user.id

    // 2. Crear restaurante (slug único)
    const baseSlug = toSlug(body.restName)
    const slug     = `${baseSlug}-${Date.now().toString(36).slice(-4)}`

    const { data: restData, error: restErr } = await supabase
      .from('restaurants')
      .insert({
        name:         body.restName.trim(),
        slug,
        address:      body.restAddress.trim(),
        neighborhood: body.restBarrio.trim(),
        cuisine_type: body.restCocina.trim(),
        owner_id:     userId,
        active:       true,
        plan:         'free',
        claimed:      true,
      })
      .select('id, slug')
      .single()

    if (restErr || !restData) {
      // Rollback: eliminar el usuario que recién creamos
      await supabase.auth.admin.deleteUser(userId).catch(() => {})
      console.error('register-restaurant create restaurant error:', restErr)
      return NextResponse.json({ error: 'No pudimos crear tu restaurante.' }, { status: 500 })
    }

    // 3. Crear team_members (rol owner) — obligatorio para que el panel
    //    muestre el restaurante en el contexto del usuario
    const { error: teamErr } = await supabase.from('team_members').insert({
      restaurant_id: restData.id,
      user_id:       userId,
      invited_email: body.email.toLowerCase().trim(),
      role:          'owner',
      status:        'active',
      active:        true,
    })

    if (teamErr) {
      console.error('register-restaurant create team_member error:', teamErr)
      // No rollback aquí — el restaurante existe; pero avisamos
      return NextResponse.json(
        { error: 'Cuenta creada pero no pudimos asignar tu rol. Contacta soporte.' },
        { status: 500 }
      )
    }

    // 4. Enviar email de bienvenida (best-effort — no bloqueante)
    try {
      const origin = resolveAppUrl(req)
      const { subject, html, text } = welcomeEmail({
        restaurantName: body.restName.trim(),
        dashboardUrl:   `${origin}/dashboard`,
      })
      await sendBrandedEmail({
        to:      body.email.toLowerCase().trim(),
        subject,
        html,
        text,
      })
    } catch (mailErr) {
      console.error('[email] welcome send failed (non-blocking):', mailErr)
    }

    return NextResponse.json({
      ok:            true,
      user_id:       userId,
      restaurant_id: restData.id,
      slug:          restData.slug,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: err.issues },
        { status: 400 }
      )
    }
    console.error('register-restaurant error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
