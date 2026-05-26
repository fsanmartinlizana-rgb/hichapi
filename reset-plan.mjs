import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('restaurants')
    .update({ plan: 'free', plan_paid_at: null, plan_next_billing: null })
    .eq('id', 'a8d7ce05-5f0a-4079-8bd0-25756d883278'); // Este es el ID que vimos en los logs

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Restaurante reseteado a plan free exitosamente.');
  }
}

main();
