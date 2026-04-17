/**
 * Delete all CAFs for a restaurant
 * 
 * Usage:
 *   npx tsx scripts/delete-cafs.ts <restaurant_id>
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
} catch {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function main() {
  const restaurantId = process.argv[2] || '2c8864cd-84a8-4517-b4c1-920b5f6c25f1'

  console.log('🗑️  Deleting CAFs for restaurant:', restaurantId)
  console.log()

  // List all CAFs
  const { data: cafs } = await supabase
    .from('dte_caf_files')
    .select('id, document_type, folio_start, folio_end, uploaded_at')
    .eq('restaurant_id', restaurantId)
    .order('uploaded_at', { ascending: false })

  if (!cafs || cafs.length === 0) {
    console.log('No CAFs found')
    return
  }

  console.log(`Found ${cafs.length} CAF(s):`)
  cafs.forEach((caf, idx) => {
    console.log(`${idx + 1}. Type ${caf.document_type}: Folios ${caf.folio_start}-${caf.folio_end} (${caf.id})`)
  })
  console.log()

  // Check if any have been used
  for (const caf of cafs) {
    const { data: emissions } = await supabase
      .from('dte_emissions')
      .select('id')
      .eq('caf_id', caf.id)
      .limit(1)

    if (emissions && emissions.length > 0) {
      console.log(`⚠️  CAF ${caf.id} has been used and cannot be deleted`)
    } else {
      console.log(`✅ Deleting CAF ${caf.id}...`)
      const { error } = await supabase
        .from('dte_caf_files')
        .delete()
        .eq('id', caf.id)

      if (error) {
        console.error(`   ❌ Error:`, error.message)
      } else {
        console.log(`   ✓ Deleted`)
      }
    }
  }

  console.log()
  console.log('Done!')
}

main().catch(console.error)
