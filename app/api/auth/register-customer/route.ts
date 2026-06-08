import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendBrandedEmail } from '@/lib/email/sender';
import { customerWelcomeEmail } from '@/lib/email/templates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email, password, display_name } = await req.json();

    if (!email || !password || !display_name) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    // 1. Create the user in Auth, auto-confirming their email so they can log in immediately
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'customer', display_name },
    });

    if (authError) {
      console.error('Error creating user:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Create the customer profile
    const { error: profileError } = await supabase
      .from('customer_profiles')
      .insert({
        user_id: userId,
        display_name,
      });

    if (profileError) {
      console.error('Error creating customer profile:', profileError);
      // We don't delete the auth user here as it might be too complex, but ideally we should rollback
      return NextResponse.json({ error: 'Error creando perfil de comensal' }, { status: 500 });
    }

    // 3. Send welcome email (fire-and-forget)
    void (async () => {
      try {
        const { subject, html, text } = customerWelcomeEmail({ customerName: display_name });
        await sendBrandedEmail({
          to: email,
          subject,
          html,
          text,
        });
      } catch (err) {
        console.error('Failed to send welcome email:', err);
      }
    })();

    return NextResponse.json({ success: true, user: authData.user });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
