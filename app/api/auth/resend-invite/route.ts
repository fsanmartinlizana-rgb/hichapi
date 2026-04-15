import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { sendBrandedEmail } from '@/lib/email/sender'
import { teamInviteEmail } from '@/lib/email/templates'
import { resolveAppUrl } from '@/lib/app-url'
import { createInviteToken } from '@/lib/invite-token'

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

    // Generar un nuevo token firmado por NOSOTROS (bypass Supabase Site URL)
    const inviteToken = createInviteToken({
      email,
      restaurant_id: member.restaurant_id,
      role:          member.role,
    })
    const actionLink = `${origin}/aceptar-invitacion?t=${encodeURIComponent(inviteToken)}`

    // Mandar email branded
    const { subject, html, text } = teamInviteEmail({
      restaurantName: rest?.name ?? 'tu restaurante',
      role:           member.role,
      actionUrl:      actionLink,
    })
    const mail = await sendBrandedEmail({ to: email, subject, html, text })

    if (mail.ok) {
      return NextResponse.json({
        ok:        true,
        sent:      true,
        provider:  'resend',
        message:   'Te enviamos un nuevo link a tu correo. Revisá tu bandeja en 1-2 minutos.',
      })
    }

    // Si Resend no está / falló, devolvemos el link directo para que el admin
    // pueda compartirlo manualmente (no falla el flujo)
    return NextResponse.json({
      ok:        true,
      sent:      false,
      skipped:   mail.skipped ?? false,
      action_link: actionLink,
      message:   mail.skipped
        ? 'El envío de emails no está configurado. Pedile al admin que te comparta el link directamente.'
        : 'No pudimos enviar el email. Probá pedirle al admin que te comparta el link.',
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    console.error('resend-invite error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
