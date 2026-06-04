import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function run() {
  const customerId = 'bceaa543-f1e7-40e9-9799-4347148f98fd'
  
  const { data, error } = await supabase.from('customer_profiles').select('*').eq('user_id', customerId)

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Customer profile found:', data)
  }
}

run()
