import { POST } from './app/api/menu-items/bulk/route';
import { NextRequest } from 'next/server';

async function run() {
  const req = new NextRequest('http://localhost/api/menu-items/bulk', {
    method: 'POST',
    body: JSON.stringify({
      restaurant_id: 'a42f4ab8-9868-41e7-a4e2-eaf34d7786a0',
      items: [
        {
          name: 'Prueba de Lomo Final',
          price: 15000,
          category: 'principal',
          rawRecipe: 'Lomo test (kg): 0.5, Papas test (g): 200'
        }
      ]
    })
  });
  
  // mock requireUser
  jest.mock('./lib/supabase/auth-guard', () => ({
    requireUser: () => ({ user: { id: 'test' }, error: null })
  }));

  const res = await POST(req);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

run().catch(console.error);
