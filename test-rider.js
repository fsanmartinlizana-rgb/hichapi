require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: riders } = await sb.from('rider_profiles').select('*').limit(5);
  console.log("Rider profiles:", riders?.length);
  if (riders) console.log(riders);
}
run();
