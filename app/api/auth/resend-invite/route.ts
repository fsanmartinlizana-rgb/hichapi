import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { sendBrandedEmail } from '@/lib/email/sender'
import { teamInviteEmail } from '@/lib/email/templates'
import { resolveAppUrl } from '@/lib/app-url'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/resend-invite
// Re-genera el link de invitación de Supabase y lo manda por email branded.
// Pensado para cuando el link original expira o se consume (escáneres de email
// como Outlook/Gmail security suelen "preview" el link, gastándolo).
//
// PUBLIC: no requiere auth. Sólo manda invitación si hay un team_member
// pendiente con ese email. Esto previene enumeración de cuentas.
// ─────────────────────────────────────────────────────────────────────────────

const BodySchema = z.object({
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())
    const email = body.email.trim().toLowerCase()
    const supabase = createAdminClient()

    // Buscar team_member pendiente o activo con ese email
    const { data: members } = await supabase
      .from('team_members')
      .select('id, restaurant_id, role, status')
      .eq('invited_email', email)
      .neq('status', 'revoked')
      .limit(1)

    if (!members || members.length === 0) {
      // Respuesta genérica para no filtrar si el email existe o no
      return NextResponse.json({
        ok: true,
        sent: false,
        message: 'Si el email tiene una invitación pendiente, te llegará un correo nuevo en breve.',
      })
    }

    const member = members[0]

    // Get restaurant name for the email
    const { data: rest } = await supabase
      .from('restaurants')
      .select('name')
      .eq('id', member.restaurant_id)
      .maybeSingle()

    const origin = resolveAppUrl(req)
    const useBranded = !!process.env.RESEND_API_KEY

    // Generar un link nuevo (siempre vía generateLink para evitar el SMTP de Supabase)
    let actionLink: string | null = null
    let inviteErr: { message?: string } | null = null

    {
      const { data, error } = await supabase.auth.admin.generateLink({
        type:  'invite',
        email,
        options: {
          redirectTo: `${origin}/invite-callback`,
          data: {
            restaurant_id: member.restaurant_id,
            role:          member.role,
          },
        },
      })
      inviteErr = error
      actionLink = data?.properties?.action_link ?? null
    }

    // Si generateLink falló porque el user ya existe sin link pendiente
    // (p.ej. ya aceptó), igual mandamos un magic-link como fallback.
    if (!actionLink || inviteErr) {
      const { data: ml, error: mlErr } = await supabase.auth.admin.generateLink({
        type:  'magiclink',
        email,
        options: {
          redirectTo: `${origin}/invite-callback`,
        },
      })
      if (!mlErr && ml?.properties?.action_link) {
        actionLink = ml.properties.action_link
      } else {
        return NextResponse.json(
          {
            error: 'No pudimos generar un nuevo link. Pídele al administrador que te re-invite desde /equipo.',
            detail: mlErr?.message ?? inviteErr?.message ?? 'unknown',
          },
          { status: 500 },
        )
      }
    }

    // Mandar email branded vía Resend
    if (useBranded && actionLink) {
      const { subject, html, text } = teamInviteEmail({
        restaurantName: rest?.name ?? 'tu restaurante',
        role:           member.role,
        actionUrl:      actionLink,
      })
      const mail = await sendBrandedEmail({ to: email, subject, html, text })
      return NextResponse.json({
        ok:         mail.ok,
        sent:       mail.ok,
        provider:   'resend',
        skipped:    mail.skipped ?? false,
        message:    mail.ok
          ? 'Te enviamos un nuevo link a tu correo. Revisá tu bandeja en 1-2 minutos.'
          : 'No pudimos enviar el email. Pídele al admin que te re-invite manualmente desde /equipo.',
      })
    }

    // Sin Resend: usar el flujo de Supabase (puede caer en spam o tardar)
    const { error: smtpErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/invite-callback`,
      data: {
        restaurant_id: member.restaurant_id,
        role:          member.role,
      },
    })

    if (smtpErr) {
      return NextResponse.json(
        {
          error: 'No pudimos reenviar la invitación. Pídele al admin que te re-invite desde /equipo.',
          detail: smtpErr.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok:       true,
      sent:     true,
      provider: 'supabase',
      message:  'Te enviamos un nuevo link a tu correo. Si no lo recibes en 5 min, revisá tu carpeta de spam.',
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    console.error('resend-invite error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
