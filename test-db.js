import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function test() {
  const { data: menuItems, error: menuErr } = await supabase
    .from('menu_items')
    .select('id, name, ingredients')
    .eq('name', 'Lomo a lo pobre')
  
  console.log('Menu Items:', JSON.stringify(menuItems, null, 2))

  const { data: stockItems, error: stockErr } = await supabase
    .from('stock_items')
    .select('id, name, unit')
  
  console.log('Stock Items (last 3):', JSON.stringify(stockItems?.slice(-3), null, 2))
}
test()
