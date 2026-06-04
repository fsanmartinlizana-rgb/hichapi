import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data, error } = await sb
    .from('customer_profiles')
    .select('*')
    .limit(5);
  
  if (error) console.error(error);
  else console.log(data);
}

run();
