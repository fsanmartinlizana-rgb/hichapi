import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
async function main() {
  const lines = readFileSync('.env.local','utf8').split('\n')
  for (const l of lines) {
    const eq = l.indexOf('='); if (eq < 0) continue
    if (!process.env[l.slice(0,eq).trim()]) process.env[l.slice(0,eq).trim()] = l.slice(eq+1).trim()
  }
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await sb.from('restaurants').select('id, name, lat, lng, data_source, active').eq('active', true)
  const rows = data ?? []
  const withCoords = rows.filter(r => r.lat != null && r.lng != null)
  const withoutCoords = rows.filter(r => r.lat == null || r.lng == null)
  const bySource: Record<string, { total: number; missing: number }> = {}
  for (const r of rows) {
    const k = (r.data_source ?? 'unknown') as string
    if (!bySource[k]) bySource[k] = { total: 0, missing: 0 }
    bySource[k].total++
    if (r.lat == null || r.lng == null) bySource[k].missing++
  }
  console.log(`Total activos: ${rows.length}`)
  console.log(`Con coords:    ${withCoords.length}`)
  console.log(`Sin coords:    ${withoutCoords.length}`)
  console.log(`\nPor data_source:`)
  for (const [k, v] of Object.entries(bySource)) {
    console.log(`  ${k}: ${v.total} total, ${v.missing} sin coords`)
  }
  console.log(`\nSample sin coords:`)
  for (const r of withoutCoords.slice(0, 10)) {
    console.log(`  - ${r.name} (data_source=${r.data_source})`)
  }
}
main()
