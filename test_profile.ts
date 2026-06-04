import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // Let's list all users
  const { data: users, error: usersErr } = await sb.auth.admin.listUsers();
  if (usersErr) {
    console.error(usersErr);
    return;
  }
  
  // Find customer profiles
  const { data: profiles, error: profErr } = await sb
    .from('customer_profiles')
    .select('id, user_id, display_name, phone, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (profErr) {
    console.error(profErr);
    return;
  }
  
  console.log("Recent profiles:");
  profiles.forEach(p => {
    const u = users.users.find(x => x.id === p.user_id);
    console.log(`Email: ${u?.email}, Name: ${p.display_name}, Phone: ${p.phone}`);
  });
}

run();
