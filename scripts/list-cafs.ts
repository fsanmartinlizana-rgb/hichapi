/**
 * List all CAFs for a restaurant
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

  console.log('📋 CAFs for restaurant:', restaurantId)
  console.log()

  // Check dte_caf_files
  console.log('Checking dte_caf_files...')
  const { data: cafFiles, error: error1 } = await supabase
    .from('dte_caf_files')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('uploaded_at', { ascending: false })

  if (error1) {
    console.error('Error:', error1)
  } else if (!cafFiles || cafFiles.length === 0) {
    console.log('  ✓ No CAFs in dte_caf_files')
  } else {
    console.log(`  Found ${cafFiles.length} CAF(s) in dte_caf_files`)
    for (const caf of cafFiles) {
      console.log(`    - Type ${caf.document_type}: Folios ${caf.folio_start}-${caf.folio_end}`)
    }
  }

  console.log()

  // Check dte_cafs
  console.log('Checking dte_cafs...')
  const { data: cafs, error: error2 } = await supabase
    .from('dte_cafs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  if (error2) {
    console.error('Error:', error2)
  } else if (!cafs || cafs.length === 0) {
    console.log('  ✓ No CAFs in dte_cafs')
  } else {
    console.log(`  Found ${cafs.length} CAF(s) in dte_cafs\n`)
    for (const caf of cafs) {
      console.log(`  ID: ${caf.id}`)
      console.log(`    Type: ${caf.document_type}`)
      console.log(`    Folios: ${caf.folio_desde} - ${caf.folio_hasta}`)
      console.log(`    Current: ${caf.folio_actual}`)
      console.log(`    Status: ${caf.status}`)
      console.log(`    Created: ${caf.created_at}`)
      
      // Check if used
      const { data: emissions } = await supabase
        .from('dte_emissions')
        .select('id')
        .eq('caf_id', caf.id)
        .limit(1)
      
      if (emissions && emissions.length > 0) {
        console.log(`    ⚠️  USED (cannot delete)`)
      } else {
        console.log(`    ✓ Unused (can delete)`)
      }
      console.log()
    }
  }
}

main().catch(console.error)
