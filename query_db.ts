import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data, error } = await sb
    .from('restaurants')
    .select('id, name, cuisine_type, neighborhood, active')
    .ilike('neighborhood', '%Ovalle%');
  
  if (error) console.error(error);
  else console.log(data);
}

run();
