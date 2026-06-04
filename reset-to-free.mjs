import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('restaurants')
    .update({ 
      plan: 'free', 
      subscription_status: 'active',
      trial_ends_at: null,
      plan_next_billing: null,
      plan_paid_at: null
    })
    .eq('id', 'a8d7ce05-5f0a-4079-8bd0-25756d883278');
  
  if (error) console.error(error);
  else console.log('Restaurante reseteado a plan free exitosamente.');
}
run();
