require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: zones } = await sb
    .from('delivery_zones')
    .select('*, restaurants!inner(id, name, cuisine_type, neighborhood, active)')
    .eq('active', true)
    .eq('restaurants.active', true);
  
  console.log("Zones found:", zones?.length);
  if (zones) {
    console.log(zones.map(z => z.restaurants));
  }
}
run();
