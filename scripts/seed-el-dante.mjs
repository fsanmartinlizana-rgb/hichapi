/**
 * Seed: Restaurante "El Dante 1949 - Jorge Washington" (piloto)
 *
 * Crea el restaurante y le carga la carta extraída de queresto.com.
 *
 * Uso:
 *   set -a && source .env.local && set +a
 *   node scripts/seed-el-dante.mjs
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// Datos del piloto
const REST_NAME       = 'El Dante 1949 — Jorge Washington'
const REST_SLUG       = 'el-dante-jorge-washington'
const REST_ADDRESS    = 'Jorge Washington 295, Ñuñoa, Santiago'  // (admin podrá editar después)
const REST_BARRIO     = 'Ñuñoa'
const REST_CUISINE    = 'Italiana / Cafetería'

const ADMIN_EMAIL     = 'admin.eldante@hichapi.com'  // placeholder — el admin real lo cambia
const ADMIN_NAME      = 'Administradora El Dante'

// Cargar el menú parseado
const menuJson = JSON.parse(fs.readFileSync('./scripts/dante-menu.json', 'utf8'))

console.log('🌱 Seeding El Dante - Jorge Washington')
console.log(`   Categorías: ${menuJson.categories.length}`)
console.log(`   Items totales: ${menuJson.categories.reduce((s, c) => s + c.items.length, 0)}`)

// 1. Crear o ubicar el restaurante
let { data: existing } = await sb
  .from('restaurants')
  .select('id, slug, name')
  .eq('slug', REST_SLUG)
  .maybeSingle()

let restId
if (existing) {
  restId = existing.id
  console.log(`✅ Restaurante existente: ${existing.name} (${restId})`)
} else {
  const { data: created, error } = await sb
    .from('restaurants')
    .insert({
      name:         REST_NAME,
      slug:         REST_SLUG,
      address:      REST_ADDRESS,
      neighborhood: REST_BARRIO,
      cuisine_type: REST_CUISINE,
      active:       true,
      claimed:      true,
      plan:         'pro',  // piloto con todos los módulos habilitados
    })
    .select('id, slug')
    .single()

  if (error) {
    console.error('❌ Error creando restaurant:', error.message)
    process.exit(1)
  }
  restId = created.id
  console.log(`✅ Restaurante creado: ${REST_NAME} (id: ${restId})`)
}

// 2. Crear o ubicar la cuenta admin
let { data: usersList } = await sb.auth.admin.listUsers({ perPage: 500 })
let adminUser = usersList?.users?.find(u => u.email?.toLowerCase() === ADMIN_EMAIL)

let adminId
let tempPassword
if (adminUser) {
  adminId = adminUser.id
  console.log(`👤 Admin existente: ${adminUser.email} (${adminId})`)
} else {
  // Generar password aleatoria fuerte
  tempPassword =
    'Dante!' +
    Math.random().toString(36).slice(2, 8) +
    Math.random().toString(36).slice(2, 8).toUpperCase() +
    Math.floor(Math.random() * 1000)

  const { data: created, error } = await sb.auth.admin.createUser({
    email:         ADMIN_EMAIL,
    password:      tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: ADMIN_NAME,
      role_label: 'owner',
    },
  })

  if (error) {
    console.error('❌ Error creando admin:', error.message)
    process.exit(1)
  }
  adminId = created.user.id
  console.log(`👤 Admin creado: ${ADMIN_EMAIL}`)
  console.log(`   🔑 PASSWORD TEMPORAL: ${tempPassword}`)
}

// 3. Asignar admin como owner del restaurante
const { data: existingMember } = await sb
  .from('team_members')
  .select('id')
  .eq('restaurant_id', restId)
  .eq('user_id', adminId)
  .maybeSingle()

if (!existingMember) {
  const { error: memberErr } = await sb.from('team_members').insert({
    restaurant_id: restId,
    user_id:       adminId,
    invited_email: ADMIN_EMAIL,
    role:          'owner',
    roles:         ['owner', 'admin'],
    full_name:     ADMIN_NAME,
    status:        'active',
    active:        true,
  })
  if (memberErr) {
    // Fallback sin full_name si la columna no existe
    const { error: fb } = await sb.from('team_members').insert({
      restaurant_id: restId,
      user_id:       adminId,
      invited_email: ADMIN_EMAIL,
      role:          'owner',
      status:        'active',
      active:        true,
    })
    if (fb) console.error('⚠ team_members insert error:', fb.message)
  }
  console.log(`🤝 Admin asignado como owner`)
} else {
  console.log(`🤝 Admin ya estaba asignado`)
}

// Marcar también como owner_id en el restaurante
await sb.from('restaurants').update({ owner_id: adminId }).eq('id', restId)

// 4. Limpiar menu existente y cargar el nuevo
console.log('\n📋 Cargando carta...')
const { count: existingCount } = await sb
  .from('menu_items')
  .select('id', { count: 'exact', head: true })
  .eq('restaurant_id', restId)

if (existingCount && existingCount > 0) {
  console.log(`   Borrando ${existingCount} items existentes...`)
  await sb.from('menu_items').delete().eq('restaurant_id', restId)
}

// Insertar items por chunks
const rows = []
for (const cat of menuJson.categories) {
  for (const item of cat.items) {
    if (!item.name || !item.price || item.price <= 0) continue

    // Inferir destination desde categoría
    const lc = cat.name.toLowerCase()
    let destination = 'cocina'
    if (/bebid|trag|cocktail|cerveza|vino|whisk|gin|pisco|cafe|caf[eé]|t[eé]\b|jugo|agua|infus|gaseo|barra|cafeteria/.test(lc)) {
      destination = 'barra'
    }

    rows.push({
      restaurant_id: restId,
      name:          item.name.trim().slice(0, 200),
      description:   item.description ?? null,
      price:         Math.round(item.price),
      category:      cat.name.toLowerCase().trim().slice(0, 100),
      tags:          Array.isArray(item.tags) ? item.tags : [],
      ingredients:   Array.isArray(item.ingredients) ? item.ingredients : [],
      available:     true,
      destination,
    })
  }
}

let inserted = 0
for (let i = 0; i < rows.length; i += 50) {
  const chunk = rows.slice(i, i + 50)
  const { error } = await sb.from('menu_items').insert(chunk)
  if (error) {
    console.error(`❌ Chunk ${i / 50 + 1} error:`, error.message)
    // Fallback sin ingredients
    const { error: fb } = await sb.from('menu_items').insert(
      chunk.map(({ ingredients: _ig, ...r }) => { void _ig; return r })
    )
    if (fb) {
      console.error(`   También falló sin ingredients:`, fb.message)
      continue
    }
  }
  inserted += chunk.length
  process.stdout.write(`   ${inserted}/${rows.length} items insertados\r`)
}
console.log(`\n✅ Carta cargada: ${inserted} items en ${menuJson.categories.length} categorías`)

// 5. Crear unas mesas iniciales
console.log('\n🪑 Creando 6 mesas iniciales...')
const { count: existingTables } = await sb
  .from('tables')
  .select('id', { count: 'exact', head: true })
  .eq('restaurant_id', restId)

if (!existingTables || existingTables === 0) {
  const tables = [
    { label: 'Mesa 1', seats: 2, zone: 'interior', smoking: false },
    { label: 'Mesa 2', seats: 4, zone: 'interior', smoking: false },
    { label: 'Mesa 3', seats: 4, zone: 'interior', smoking: false },
    { label: 'Mesa 4', seats: 6, zone: 'interior', smoking: false },
    { label: 'Mesa 5', seats: 2, zone: 'terraza',  smoking: false },
    { label: 'Mesa 6', seats: 4, zone: 'terraza',  smoking: false },
  ].map(t => ({
    ...t,
    restaurant_id: restId,
    status:        'libre',
    qr_token:      `qr-${REST_SLUG}-${t.label.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 8)}`,
  }))

  const { error: tErr } = await sb.from('tables').insert(tables)
  if (tErr) console.error('⚠ tables insert error:', tErr.message)
  else console.log(`✅ ${tables.length} mesas creadas (4 Salón + 2 Terraza)`)
} else {
  console.log(`✅ Mesas existentes: ${existingTables} (no se tocaron)`)
}

// 6. Reporte final
console.log('\n=================================================')
console.log('🎉 PILOTO LISTO — El Dante Jorge Washington')
console.log('=================================================')
console.log(`📍 Restaurant ID: ${restId}`)
console.log(`🌐 Slug:         ${REST_SLUG}`)
console.log(`👤 Admin email:  ${ADMIN_EMAIL}`)
if (tempPassword) {
  console.log(`🔑 Password:     ${tempPassword}`)
  console.log(`   → COMPARTÍ ESTO con la administradora`)
  console.log(`   → Que lo cambie en /update-password al primer login`)
}
console.log('=================================================\n')
