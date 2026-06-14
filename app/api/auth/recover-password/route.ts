import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendBrandedEmail } from '@/lib/email/sender';
import { passwordResetEmail } from '@/lib/email/templates';
import { resolveAppUrl } from '@/lib/app-url';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Email simple regex — solo para no llamar a Supabase con basura. La validación
 * fuerte la hace Supabase del lado server. Este filtro previo es solo UX.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Respuesta uniforme para todos los casos en que NO queremos confirmar si el
// email existe o no (evita user enumeration). El cliente la ve igual que un
// success real. Logueamos internamente la causa para debugging.
const UNIFORM_OK = { ok: true, message: 'Si el correo está registrado, te enviamos un link para restablecer la contraseña.' }

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    // 400 solo cuando el INPUT está malformado (no es enumeration: cualquiera
    // que mande "" o "no-es-email" sabe que es inválido).
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: 'Ingresá un correo válido' }, { status: 400 });
    }
    const normalized = email.trim().toLowerCase();

    // 1. Generate recovery link via admin API. redirectTo apunta a
    //    /auth/callback?type=recovery — el callback hace exchangeCodeForSession
    //    y crea la cookie de sesión antes de mandar al usuario a /update-password.
    //    Bug 2026-06: antes apuntábamos directo a /update-password → no había
    //    sesión activa y la página mostraba el error "No hay sesión activa…".
    const origin = resolveAppUrl(req) ?? 'https://www.hichapi.com'
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: normalized,
      options: {
        redirectTo: `${origin}/auth/callback?type=recovery`,
      },
    });

    // Si Supabase no pudo generar el link (email no registrado, etc.), respondemos
    // 200 uniforme. Solo logueamos para investigación. NO confirmamos al cliente
    // la existencia del email — evita enumeration.
    if (linkError || !linkData?.properties?.action_link) {
      console.warn('[recover-password] generateLink falló (puede ser email inexistente):', linkError?.message);
      return NextResponse.json(UNIFORM_OK);
    }

    const resetUrl = linkData.properties.action_link;

    // 2. Enviar email via Resend (template HiChapi).
    const { subject, html, text } = passwordResetEmail({ resetUrl });
    const mailRes = await sendBrandedEmail({
      to: normalized,
      subject,
      html,
      text,
    });

    if (!mailRes.ok) {
      console.error('[recover-password] Resend falló:', mailRes.error);
      // Mantenemos respuesta uniforme: el usuario no tiene cómo distinguir
      // "no existe" de "falló Resend". Logueamos para soporte.
      return NextResponse.json(UNIFORM_OK);
    }

    return NextResponse.json(UNIFORM_OK);
  } catch (error) {
    console.error('[recover-password] error:', error);
    // En catastrophic failure (DB caída, etc.) sí devolvemos 500 para que el
    // front muestre "intentá de nuevo" — no es un usuario válido pidiendo, es
    // el servidor caído.
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
