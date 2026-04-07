/**
 * HiChapi Demo Seed Script
 *
 * Seeds the demo restaurant "El Rincón de Don José" into Supabase.
 *
 * PREREQUISITES — run this SQL first in the Supabase SQL Editor
 * (supabase/migrations/20260407_012_tables_and_owner.sql):
 *
 *   CREATE TABLE IF NOT EXISTS public.tables (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 *     label TEXT NOT NULL, seats INT NOT NULL DEFAULT 4,
 *     status TEXT NOT NULL DEFAULT 'libre'
 *       CHECK (status IN ('libre','ocupada','reservada','bloqueada')),
 *     zone TEXT DEFAULT 'interior', smoking BOOLEAN DEFAULT false,
 *     min_pax INT DEFAULT 1, max_pax INT DEFAULT 4,
 *     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *   ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "public_read_tables" ON public.tables FOR SELECT USING (true);
 *   ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rtdryqujuywwaetzjxdo.supabase.co';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0ZHJ5cXVqdXl3d2FldHpqeGRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI3NDA1NCwiZXhwIjoyMDkwODUwMDU0fQ.q4_DzWULHAODAwJOS5zuLDkW_PkBIlg29dV8KetyHKY';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const RESTAURANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ── 1. Restaurant ─────────────────────────────────────────────────────────────
async function seedRestaurant() {
  console.log('\n[1] Seeding restaurant…');
  const { data, error } = await supabase
    .from('restaurants')
    .upsert(
      {
        id: RESTAURANT_ID,
        name: 'El Rincón de Don José',
        slug: 'el-rincon-de-don-jose',
        address: 'Av. Providencia 2124, Providencia',
        neighborhood: 'Providencia',
        lat: -33.4308,
        lng: -70.6108,
        cuisine_type: 'Chilena / Italiana',
        price_range: '$$',
        rating: 4.7,
        review_count: 142,
        active: true,
        plan: 'at_table',
        photo_url: null,
      },
      { onConflict: 'slug' }
    )
    .select('id, name');

  if (error) {
    console.error('  ERROR:', error.message, error.details ?? '');
    return false;
  }
  console.log(`  OK — "${data?.[0]?.name}" (id: ${data?.[0]?.id})`);
  return true;
}

// ── 2. Tables ─────────────────────────────────────────────────────────────────
const TABLE_ROWS = [
  { id: '10000001-0000-0000-0000-000000000001', label: '01', seats: 4 },
  { id: '10000001-0000-0000-0000-000000000002', label: '02', seats: 2 },
  { id: '10000001-0000-0000-0000-000000000003', label: '03', seats: 4 },
  { id: '10000001-0000-0000-0000-000000000004', label: '04', seats: 6 },
  { id: '10000001-0000-0000-0000-000000000005', label: '05', seats: 2 },
  { id: '10000001-0000-0000-0000-000000000006', label: '06', seats: 4 },
  { id: '10000001-0000-0000-0000-000000000007', label: '07', seats: 4 },
  { id: '10000001-0000-0000-0000-000000000008', label: '08', seats: 6 },
  { id: '10000001-0000-0000-0000-000000000009', label: '09', seats: 4 },
  { id: '10000001-0000-0000-0000-000000000010', label: '10', seats: 2 },
  { id: '10000001-0000-0000-0000-000000000011', label: '11', seats: 4 },
  { id: '10000001-0000-0000-0000-000000000012', label: '12', seats: 4 },
].map((t) => ({ ...t, restaurant_id: RESTAURANT_ID, status: 'libre' }));

async function seedTables() {
  console.log('\n[2] Seeding tables (mesas)…');
  const { data, error } = await supabase
    .from('tables')
    .upsert(TABLE_ROWS, { onConflict: 'id', ignoreDuplicates: true })
    .select('id, label, seats');

  if (error) {
    if (
      error.message.includes("'public.tables'") ||
      error.message.includes('schema cache')
    ) {
      console.warn('  SKIP — "tables" table does not exist yet.');
      console.warn('  Run supabase/migrations/20260407_012_tables_and_owner.sql in the SQL Editor, then re-run this script.');
      return false;
    }
    console.error('  ERROR:', error.message, error.details ?? '');
    return false;
  }
  console.log(`  OK — ${data?.length} tables inserted:`);
  for (const t of (data ?? [])) {
    console.log(`       Mesa ${t.label} (${t.seats} asientos)`);
  }
  return true;
}

// ── 3. Menu items ─────────────────────────────────────────────────────────────
// UUIDs use a1b2c3d4-e5f6-7890-abcd-ef00000000XX (valid UUID format)
const MENU_ITEMS = [
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000001', name: 'Ensalada César',         description: 'Lechuga romana, crutones artesanales, parmesano y aderezo César',         price: 8900,  category: 'entrada',        tags: [] },
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000002', name: 'Gazpacho',               description: 'Sopa fría de tomate andaluza con pepino y pimiento',                       price: 7500,  category: 'entrada',        tags: ['vegano', 'sin gluten'] },
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000003', name: 'Tabla de quesos',        description: 'Selección de quesos con frutos secos, mermelada y crostinis',              price: 13900, category: 'para compartir', tags: ['vegetariano'] },
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000004', name: 'Lomo vetado',            description: 'Corte premium a la parrilla con papas fritas y ensalada de temporada',     price: 15900, category: 'principal',      tags: [] },
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000005', name: 'Pasta arrabiata',        description: 'Pasta con salsa de tomate picante, albahaca fresca y aceitunas',           price: 12900, category: 'principal',      tags: ['vegano'] },
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000006', name: 'Salmón grillado',        description: 'Salmón fresco con puré de papas y salsa de limón y alcaparras',            price: 16900, category: 'principal',      tags: ['sin gluten'] },
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000007', name: 'Risotto de champiñones', description: 'Risotto cremoso con mezcla de champiñones y parmesano',                    price: 13900, category: 'principal',      tags: ['vegetariano'] },
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000008', name: 'Pizza napolitana',       description: 'Masa delgada con tomate san marzano, mozzarella fresca y albahaca',        price: 12900, category: 'principal',      tags: ['vegetariano'] },
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000009', name: 'Tiramisú',               description: 'Receta italiana tradicional con mascarpone y café espresso',               price: 6900,  category: 'postre',         tags: ['vegetariano'] },
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000010', name: 'Panna cotta',            description: 'Con coulis de frutos rojos y menta fresca',                                price: 5900,  category: 'postre',         tags: ['vegetariano', 'sin gluten'] },
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000011', name: 'Pisco sour',             description: 'Clásico chileno con pisco 35°, limón de pica y clara de huevo',            price: 5900,  category: 'bebida',         tags: [] },
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000012', name: 'Copa de vino tinto',     description: 'Selección del sommelier — carmenère o cabernet sauvignon',                price: 5500,  category: 'bebida',         tags: [] },
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000013', name: 'Agua con gas',           description: 'Agua mineral con gas 500ml',                                              price: 2900,  category: 'bebida',         tags: ['vegano', 'sin gluten'] },
].map((item) => ({ ...item, restaurant_id: RESTAURANT_ID, available: true }));

async function seedMenuItems() {
  console.log('\n[3] Seeding menu items…');
  const { data, error } = await supabase
    .from('menu_items')
    .upsert(MENU_ITEMS, { onConflict: 'id', ignoreDuplicates: true })
    .select('id, name, price, category');

  if (error) {
    console.error('  ERROR:', error.message, error.details ?? '');
    return false;
  }

  const byCategory = {};
  for (const item of (data ?? [])) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  }
  console.log(`  OK — ${data?.length} items inserted:`);
  for (const [cat, items] of Object.entries(byCategory)) {
    console.log(`       [${cat}]`);
    for (const item of items) {
      console.log(`         · ${item.name} — $${item.price.toLocaleString()} CLP`);
    }
  }
  return true;
}

// ── 4. Verify owner_id column ─────────────────────────────────────────────────
async function checkOwnerIdColumn() {
  console.log('\n[4] Checking owner_id column on restaurants…');
  const { error } = await supabase
    .from('restaurants')
    .select('owner_id')
    .eq('id', RESTAURANT_ID)
    .maybeSingle();

  if (error && (error.message.includes('owner_id') || error.message.includes('column'))) {
    console.warn('  MISSING — owner_id column not yet added.');
    console.warn('  Run in SQL Editor: ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);');
    return false;
  } else if (error) {
    console.error('  ERROR probing owner_id:', error.message);
    return false;
  }
  console.log('  OK — owner_id column present');
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== HiChapi Demo Seed ===');
  console.log(`Target: ${SUPABASE_URL}\n`);

  const results = {
    restaurant: await seedRestaurant(),
    tables:     await seedTables(),
    menuItems:  await seedMenuItems(),
    ownerIdCol: await checkOwnerIdColumn(),
  };

  console.log('\n── Summary ──────────────────────────────────');
  console.log(`  Restaurant:   ${results.restaurant ? 'OK' : 'FAILED'}`);
  console.log(`  Tables:       ${results.tables     ? 'OK' : 'NEEDS MIGRATION (run 20260407_012_tables_and_owner.sql first)'}`);
  console.log(`  Menu items:   ${results.menuItems  ? 'OK' : 'FAILED'}`);
  console.log(`  owner_id col: ${results.ownerIdCol ? 'OK' : 'NEEDS MIGRATION'}`);

  if (!results.tables || !results.ownerIdCol) {
    console.log('\n ACTION REQUIRED:');
    console.log('  1. Open https://supabase.com/dashboard/project/rtdryqujuywwaetzjxdo/sql/new');
    console.log('  2. Paste and run the contents of:');
    console.log('     supabase/migrations/20260407_012_tables_and_owner.sql');
    console.log('  3. Re-run: node scripts/seed-demo.mjs');
  } else {
    console.log('\n All done! Visit /api/admin/demo-setup to link your user as restaurant owner.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
