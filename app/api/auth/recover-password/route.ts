import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendBrandedEmail } from '@/lib/email/sender';
import { passwordResetEmail } from '@/lib/email/templates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'El correo es requerido' }, { status: 400 });
    }

    // 1. Generate recovery link using admin API so we get the raw link and Supabase doesn't email it
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://www.hichapi.com/update-password'
      }
    });

    if (linkError) {
      console.error('Error generating recovery link:', linkError);
      return NextResponse.json({ error: 'No pudimos generar el enlace de recuperación' }, { status: 400 });
    }

    const resetUrl = linkData.properties.action_link;

    // 2. Send email via Resend
    const { subject, html, text } = passwordResetEmail({ resetUrl });
    const mailRes = await sendBrandedEmail({
      to: email,
      subject,
      html,
      text,
    });

    if (!mailRes.ok) {
      console.error('Error sending recovery email:', mailRes.error);
      return NextResponse.json({ error: 'No se pudo enviar el correo de recuperación' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Recover password error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
