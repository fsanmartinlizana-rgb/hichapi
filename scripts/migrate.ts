/**
 * scripts/migrate.ts
 * Aplica todas las migraciones SQL de supabase/migrations/ en orden.
 * Lee DATABASE_URL directamente desde .env.local sin dependencias extra.
 */
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// Leer .env.local manualmente
const envPath = join(process.cwd(), '.env.local')
try {
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch { /* .env.local opcional */ }

import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('❌ DATABASE_URL no configurada en .env.local')
  console.error('   Obtenerla en: https://supabase.com/dashboard/project/rtdryqujuywwaetzjxdo/settings/database')
  process.exit(1)
}

const sql = postgres(connectionString, { ssl: 'require', max: 1 })

async function run() {
  await sql`
    create table if not exists _migrations (
      name       text primary key,
      applied_at timestamptz default now()
    )
  `

  const applied = await sql`select name from _migrations`
  const appliedSet = new Set(applied.map(r => (r as { name: string }).name))

  const migrationsDir = join(process.cwd(), 'supabase/migrations')
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  let count = 0
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ✓ skip    ${file}`)
      continue
    }
    const content = readFileSync(join(migrationsDir, file), 'utf8')
    try {
      await sql.unsafe(content)
      await sql`insert into _migrations (name) values (${file})`
      console.log(`  ✅ applied ${file}`)
      count++
    } catch (err: any) {
      console.error(`  ❌ failed  ${file}: ${err.message}`)
      process.exit(1)
    }
  }

  if (count === 0) console.log('  ✓ All migrations already applied')
  await sql.end()
}

run().catch(err => {
  console.error('Migration error:', err)
  process.exit(1)
})
