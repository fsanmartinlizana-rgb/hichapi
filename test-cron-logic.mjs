import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const restaurant_id = 'a8d7ce05-5f0a-4079-8bd0-25756d883278';
  
  // Set to blocked
  await supabase.from('restaurants').update({
    subscription_status: 'past_due'
  }).eq('id', restaurant_id);
  
  console.log('Restaurante puesto en estado past_due!');
}
run();
