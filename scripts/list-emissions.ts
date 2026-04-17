/**
 * List recent DTE emissions
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
try {
  const envPath = resolve(process.cwd(), '.env.local')
  const envFile = readFileSync(envPath, 'utf8')
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      process.env[key] = value
    }
  })
} catch (err) {
  console.error('⚠️  Could not load .env.local file')
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function main() {
  const restaurantId = process.argv[2] || '2c8864cd-84a8-4517-b4c1-920b5f6c25f1'

  console.log('📋 Recent DTE emissions for restaurant:', restaurantId)
  console.log()

  const { data: emissions } = await supabase
    .from('dte_emissions')
    .select('id, document_type, folio, status, error_detail, emitted_at, sii_track_id')
    .eq('restaurant_id', restaurantId)
    .order('emitted_at', { ascending: false })
    .limit(10)

  if (!emissions || emissions.length === 0) {
    console.log('No emissions found')
    return
  }

  emissions.forEach((em, idx) => {
    console.log(`${idx + 1}. ${em.id}`)
    console.log(`   Type: ${em.document_type}, Folio: ${em.folio}`)
    console.log(`   Status: ${em.status}`)
    console.log(`   Track ID: ${em.sii_track_id || 'N/A'}`)
    if (em.error_detail) {
      console.log(`   Error: ${em.error_detail}`)
    }
    console.log(`   Date: ${em.emitted_at}`)
    console.log()
  })

  console.log('To inspect an emission, run:')
  console.log(`npx tsx scripts/inspect-dte-xml.ts "<emission_id>"`)
}

main().catch(console.error)
