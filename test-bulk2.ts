import { POST } from './app/api/menu-items/bulk/route';
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/auth-guard', () => ({
  requireUser: async () => ({ user: { id: 'test' }, error: null })
}));

async function run() {
  const req = new NextRequest('http://localhost/api/menu-items/bulk', {
    method: 'POST',
    body: JSON.stringify({
      restaurant_id: 'a42f4ab8-9868-41e7-a4e2-eaf34d7786a0',
      items: [
        {
          name: 'Lomo test',
          price: 15000,
          category: 'principal',
          rawRecipe: 'Lomo test (kg): 0.5'
        }
      ]
    })
  });

  const res = await POST(req);
  const json = await res.json();
  console.log('Result:', JSON.stringify(json, null, 2));

  // cleanup
  if (json.items && json.items.length) {
    const supabase = createAdminClient();
    await supabase.from('menu_items').delete().eq('id', json.items[0].id);
  }
}

run();
