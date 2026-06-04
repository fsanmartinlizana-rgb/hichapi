import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: users, error: usersErr } = await sb.auth.admin.listUsers();
  if (usersErr) {
    console.error("Error fetching users:", usersErr);
    return;
  }

  for (const user of users.users) {
    // Check if profile exists
    const { data: profile } = await sb
      .from('customer_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile) {
      console.log(`Creating missing profile for customer: ${user.email}`);
      const { error: insertErr } = await sb
        .from('customer_profiles')
        .insert({
          user_id: user.id,
          display_name: user.user_metadata.display_name || user.email?.split('@')[0] || 'Usuario',
        });
      
      if (insertErr) {
        console.error(`Failed to create profile for ${user.email}:`, insertErr);
      } else {
        console.log(`Successfully created profile for ${user.email}`);
      }
    }
  }
}

run();
