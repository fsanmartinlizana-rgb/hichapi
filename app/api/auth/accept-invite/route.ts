import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyInviteToken } from '@/lib/invite-token'
import { resolveAppUrl } from '@/lib/app-url'
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/accept-invite
// Recibe un token firmado por nosotros, valida, asegura que el usuario existe
// en auth.users y devuelve un magic link de Supabase para que el cliente lo
// use con setSession y entre logueado.
//
// Si el usuario no existe → lo creamos (auto-confirmado) y le mandamos al
// /update-password para que ponga contraseña.
// Si ya existe → magic link directo al panel.
// ─────────────────────────────────────────────────────────────────────────────

const BodySchema = z.object({
  token: z.string().min(10),
})

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())

    const verified = verifyInviteToken(body.token)
    if (!verified.ok) {
      const human = verified.reason === 'expired'
        ? 'Esta invitación expiró. Pedile a tu admin que te re-invite.'
        : 'El link de invitación es inválido o fue alterado.'
      return NextResponse.json(
        { error: human, reason: verified.reason },
        { status: 400 },
      )
    }

    const { email, restaurant_id, role, full_name, phone } = verified.payload
    const supabase = createAdminClient()

    // ── Asegurar que el usuario existe en auth.users ─────────────────────────
    let userId: string | null = null
    {
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 200 })
      const found = list?.users?.find(
        (u: { email?: string | null; id: string }) => u.email?.toLowerCase() === email.toLowerCase(),
      )
      if (found) {
        userId = found.id
      } else {
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            full_name: full_name ?? null,
            phone:     phone ?? null,
            invited_to_restaurant: restaurant_id,
          },
        })
        if (createErr || !created?.user) {
          return NextResponse.json(
            { error: 'No pudimos crear tu cuenta. Reintentá o contactá a soporte.' },
            { status: 500 },
          )
        }
        userId = created.user.id
      }
    }

    // ── Asegurar que existe team_member ──────────────────────────────────────
    {
      const { data: existing } = await supabase
        .from('team_members')
        .select('id')
        .eq('restaurant_id', restaurant_id)
        .eq('invited_email', email)
        .neq('status', 'revoked')
        .maybeSingle()

      const memberData: Record<string, unknown> = {
        user_id:       userId,
        role,
        roles:         [role],
        status:        'active',
        active:        true,
      }
      if (full_name) memberData.full_name = full_name
      if (phone)     memberData.phone = phone

      if (existing) {
        const { error: updErr } = await supabase
          .from('team_members')
          .update(memberData)
          .eq('id', existing.id)
        if (updErr) {
          // Fallback sin full_name/phone si las columnas no existen
          delete memberData.full_name
          delete memberData.phone
          await supabase.from('team_members').update(memberData).eq('id', existing.id)
        }
      } else {
        const { error: insErr } = await supabase
          .from('team_members')
          .insert({ ...memberData, restaurant_id, invited_email: email })
        if (insErr) {
          delete memberData.full_name
          delete memberData.phone
          await supabase.from('team_members').insert({ ...memberData, restaurant_id, invited_email: email })
        }
      }
    }

    // ── Generar magic link de Supabase para crear la sesión en el browser ───
    const origin = resolveAppUrl(req)
    const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
      type:  'magiclink',
      email,
      options: {
        redirectTo: `${origin}/update-password`,
      },
    })

    if (linkErr || !link?.properties?.action_link) {
      // Fallback: si no podemos generar magic-link, igual devolvemos OK
      // y el cliente puede ir directo a /login y entrar con su contraseña.
      return NextResponse.json({
        ok: true,
        method: 'manual_login',
        message: 'Tu cuenta está activa. Iniciá sesión con tu email y la contraseña que elegiste.',
        email,
      })
    }

    return NextResponse.json({
      ok: true,
      method: 'magic_link',
      action_link: link.properties.action_link,
      email,
      restaurant_id,
      role,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }
    console.error('accept-invite error:', err)
    return NextResponse.json({ error: 'Error interno procesando la invitación' }, { status: 500 })
  }
}
