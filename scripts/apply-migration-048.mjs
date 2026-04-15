/**
 * Apply migration 048: multi_location_stations
 *
 * Uso:
 *   set -a && source .env.local && set +a
 *   node scripts/apply-migration-048.mjs
 *
 * Se conecta vía postgres directo usando la service role.
 * Corre la migración SQL como un único statement (DO $$ + funciones + tablas).
 */

import postgres from 'postgres'
import fs from 'fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const dbUrl = process.env.SUPABASE_DB_URL

if (!dbUrl) {
  console.error('❌ Falta SUPABASE_DB_URL en .env.local')
  console.error('   Formato: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres')
  console.error('   Encontralo en Supabase dashboard → Project Settings → Database → Connection string')
  process.exit(1)
}

const sql = postgres(dbUrl, { ssl: 'require', prepare: false, max: 1 })

const migration = fs.readFileSync(
  './supabase/migrations/20260415_048_multi_location_stations.sql',
  'utf8',
)

console.log('🚀 Aplicando migration 048_multi_location_stations...')
console.log(`   SQL size: ${(migration.length / 1024).toFixed(1)} KB`)

try {
  await sql.unsafe(migration)
  console.log('✅ Migration aplicada correctamente')

  // Verificar backfill
  const [{ count: brandCount }] = await sql`SELECT COUNT(*)::int AS count FROM brands`
  const [{ count: locCount   }] = await sql`SELECT COUNT(*)::int AS count FROM locations`
  const [{ count: stCount    }] = await sql`SELECT COUNT(*)::int AS count FROM stations`
  console.log(`📊 Estado post-backfill:`)
  console.log(`   brands:    ${brandCount}`)
  console.log(`   locations: ${locCount}`)
  console.log(`   stations:  ${stCount}`)
} catch (err) {
  console.error('❌ Error aplicando migration:', err.message)
  console.error(err)
  process.exit(1)
} finally {
  await sql.end()
}
