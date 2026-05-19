import postgres from 'postgres'
import { readFileSync } from 'fs'
import { join } from 'path'

const envPath = join(process.cwd(), '.env.local')
let dbUrl = ''
try {
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (key === 'DATABASE_URL') dbUrl = val
  }
} catch (e) {}

if (!dbUrl) {
  console.error('DATABASE_URL not found')
  process.exit(1)
}

const sql = postgres(dbUrl, { ssl: 'require', max: 1 })

async function run() {
  console.log('Querying all rows in public.rider_profiles...')
  const profiles = await sql`
    SELECT id, user_id, full_name, vehicle_type, status, document_status 
    FROM public.rider_profiles;
  `
  console.log('Total rows:', profiles.length)
  console.log(JSON.stringify(profiles, null, 2))
  await sql.end()
}

run().catch(console.error)
