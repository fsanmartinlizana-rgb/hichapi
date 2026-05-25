const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const restaurant_id = 'a42f4ab8-9868-41e7-a4e2-eaf34d7786a0';
  const newStockRows = [
    {
      restaurant_id,
      name: 'Lomo test',
      unit: 'kg',
      current_qty: 0,
      min_qty: 0,
      cost_per_unit: 0
    }
  ];
  
  const { data, error } = await supabase.from('stock_items').insert(newStockRows).select('id, name');
  console.log('Error:', error);
  console.log('Inserted:', data);
  
  if (data && data.length > 0) {
    await supabase.from('stock_items').delete().eq('id', data[0].id);
  }
}
run();
