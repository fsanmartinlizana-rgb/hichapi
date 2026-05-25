const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

(async () => {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const restaurant_id = 'a42f4ab8-9868-41e7-a4e2-eaf34d7786a0';

  // 1. Manually call the route handler function
  const { POST } = require('./app/api/menu-items/bulk/route');
  
  // mock request
  const mockReq = {
    json: async () => ({
      restaurant_id,
      items: [
        {
          name: 'Prueba Real API 2',
          price: 1000,
          category: 'principal',
          rawRecipe: 'Ingrediente API Test (kg): 0.5'
        }
      ]
    })
  };

  // Mock next/server and auth
  jest = { mock: () => {} }; // fake jest to avoid error if any
  const authGuard = require('./lib/supabase/auth-guard');
  authGuard.requireUser = async () => ({ user: { id: 'test' }, error: null });

  try {
    const res = await POST(mockReq);
    const data = await res.json();
    console.log('Result:', JSON.stringify(data, null, 2));

    if (data.items && data.items.length) {
      await supabase.from('menu_items').delete().eq('id', data.items[0].id);
      const { data: stock } = await supabase.from('stock_items').select('id').eq('name', 'Ingrediente API Test');
      if (stock && stock.length) {
        await supabase.from('stock_items').delete().eq('id', stock[0].id);
      }
    }
  } catch (e) {
    console.error('Error:', e);
  }
})();
