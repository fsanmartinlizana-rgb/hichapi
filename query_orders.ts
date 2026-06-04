import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, table_id, status, total, created_at, order_items(name, quantity, status)')
    .not('status', 'in', '("paid","cancelled")')
    .order('created_at', { ascending: false })
  
  console.log("ACTIVE ORDERS:", JSON.stringify(orders, null, 2))
}

run().catch(console.error)
