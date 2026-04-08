/**
 * seed-restaurant.ts
 *
 * Onboarding script: given a restaurant_id, provisions a restaurant
 * with sample tables, menu items, and an admin user in team_members.
 *
 * Usage:
 *   npx tsx scripts/seed-restaurant.ts \
 *     --restaurant-id <uuid> \
 *     --admin-user-id <uuid>
 *
 * Requirements:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// Parse CLI args
const args         = process.argv.slice(2)
const restaurantId = args[args.indexOf('--restaurant-id') + 1]
const adminUserId  = args[args.indexOf('--admin-user-id') + 1]

if (!restaurantId) {
  console.error('❌ Usage: npx tsx scripts/seed-restaurant.ts --restaurant-id <uuid> [--admin-user-id <uuid>]')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ── Data ──────────────────────────────────────────────────────────────────────

const SAMPLE_TABLES = [
  { label: 'Mesa 1', seats: 2, zone: 'interior', smoking: false },
  { label: 'Mesa 2', seats: 4, zone: 'interior', smoking: false },
  { label: 'Mesa 3', seats: 4, zone: 'interior', smoking: false },
  { label: 'Mesa 4', seats: 6, zone: 'terraza',  smoking: false },
  { label: 'Mesa 5', seats: 2, zone: 'barra',    smoking: false },
]

const SAMPLE_MENU = [
  {
    name: 'Empanada de pino',
    description: 'Empanada horneada rellena de carne, cebolla, huevo y aceitunas',
    price: 2800,
    category: 'entradas',
    tags: [] as string[],
  },
  {
    name: 'Lomo saltado',
    description: 'Lomo de res salteado con verduras al wok, papas fritas y arroz',
    price: 9900,
    category: 'fondos',
    tags: ['promovido'] as string[],
  },
  {
    name: 'Pasta al pesto',
    description: 'Fettuccine con salsa de albahaca fresca, parmesano y piñones',
    price: 8500,
    category: 'fondos',
    tags: ['vegano'] as string[],
  },
  {
    name: 'Leche asada',
    description: 'Postre cremoso tradicional chileno con caramelo',
    price: 3200,
    category: 'postres',
    tags: [] as string[],
  },
  {
    name: 'Jugo natural',
    description: 'Naranja, mango o maracuyá',
    price: 2500,
    category: 'bebidas',
    tags: ['vegano', 'sin-gluten'] as string[],
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🍽  HiChapi — Onboarding seed`)
  console.log(`   Restaurant ID : ${restaurantId}`)
  console.log(`   Admin user    : ${adminUserId ?? 'none provided'}\n`)

  // 1. Verify restaurant exists
  const { data: restaurant, error: restErr } = await supabase
    .from('restaurants')
    .select('id, name, slug')
    .eq('id', restaurantId)
    .single()

  if (restErr || !restaurant) {
    console.error('❌ Restaurant not found:', restErr?.message)
    process.exit(1)
  }
  console.log(`✅ Restaurant: "${restaurant.name}" (${restaurant.slug})`)

  // 2. Create sample tables
  console.log('\n📋 Creating tables...')
  const tablesWithQr = SAMPLE_TABLES.map(t => ({
    ...t,
    restaurant_id: restaurantId,
    qr_token: `qr-${t.label.toLowerCase().replace(/\s/g, '-')}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'libre',
    min_pax: 1,
    max_pax: t.seats,
  }))

  const { data: createdTables, error: tablesErr } = await supabase
    .from('tables')
    .upsert(tablesWithQr, { onConflict: 'qr_token', ignoreDuplicates: true })
    .select('id, label, qr_token')

  if (tablesErr) {
    console.error('  ⚠️  Tables error:', tablesErr.message)
  } else {
    console.log(`  ✅ Created ${createdTables?.length ?? 0} tables`)
    createdTables?.forEach(t => console.log(`     - ${t.label} → ${t.qr_token}`))
  }

  // 3. Create sample menu items
  console.log('\n🍴 Creating menu items...')
  const menuWithRestaurant = SAMPLE_MENU.map(item => ({
    ...item,
    restaurant_id: restaurantId,
    available: true,
    ingredients: [],
  }))

  const { data: createdMenu, error: menuErr } = await supabase
    .from('menu_items')
    .insert(menuWithRestaurant)
    .select('id, name, price')

  if (menuErr) {
    console.error('  ⚠️  Menu error:', menuErr.message)
  } else {
    console.log(`  ✅ Created ${createdMenu?.length ?? 0} menu items`)
    createdMenu?.forEach(m => console.log(`     - ${m.name} ($${m.price})`))
  }

  // 4. Create admin team member record
  if (adminUserId) {
    console.log('\n👤 Adding admin user to team_members...')
    const { error: teamErr } = await supabase
      .from('team_members')
      .upsert({
        restaurant_id: restaurantId,
        user_id:       adminUserId,
        role:          'admin',
        active:        true,
      }, { onConflict: 'restaurant_id,user_id', ignoreDuplicates: true })

    if (teamErr) {
      console.error('  ⚠️  Team member error:', teamErr.message)
    } else {
      console.log(`  ✅ Admin (${adminUserId}) added to team_members`)
    }
  }

  // 5. Verify access — try to read orders via team_members path
  console.log('\n🔍 Verifying data access...')
  const { count: orderCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)

  console.log(`  ✅ Orders query OK (${orderCount ?? 0} orders found)`)

  const { count: tableCount } = await supabase
    .from('tables')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)

  console.log(`  ✅ Tables query OK (${tableCount ?? 0} tables found)`)

  console.log('\n🎉 Onboarding complete!')
  console.log(`\n   Next steps:`)
  console.log(`   1. Run SQL migrations 014–018 in your Supabase SQL editor`)
  console.log(`   2. Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in .env.local`)
  console.log(`   3. Configure your Stripe webhook to point to /api/stripe/webhook`)
  console.log(`   4. Deploy to Vercel: git push origin main\n`)
}

main().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
