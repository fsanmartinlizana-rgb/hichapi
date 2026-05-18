require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: tiers } = await sb.from('delivery_fee_tiers').select('*');
  console.log("Tiers found:", tiers?.length);
  console.log(tiers);
}
run();
