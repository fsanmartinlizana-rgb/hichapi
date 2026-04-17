/**
 * Script to clean all DTE data for a restaurant
 * Run with: npx tsx scripts/clean-dte-data.ts <restaurant_id>
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanDteData(restaurantId: string) {
  console.log(`🧹 Cleaning DTE data for restaurant: ${restaurantId}\n`)

  // 1. Delete emissions
  console.log('Deleting emissions...')
  const { data: emissions, error: emissionsErr } = await supabase
    .from('dte_emissions')
    .delete()
    .eq('restaurant_id', restaurantId)
    .select('id')

  if (emissionsErr) {
    console.error('❌ Error deleting emissions:', emissionsErr)
  } else {
    console.log(`✅ Deleted ${emissions?.length ?? 0} emission(s)`)
  }

  // 2. Delete CAFs
  console.log('Deleting CAFs...')
  const { data: cafs, error: cafsErr } = await supabase
    .from('dte_cafs')
    .delete()
    .eq('restaurant_id', restaurantId)
    .select('id')

  if (cafsErr) {
    console.error('❌ Error deleting CAFs:', cafsErr)
  } else {
    console.log(`✅ Deleted ${cafs?.length ?? 0} CAF(s)`)
  }

  // 3. Delete credentials
  console.log('Deleting credentials...')
  const { data: creds, error: credsErr } = await supabase
    .from('dte_credentials')
    .delete()
    .eq('restaurant_id', restaurantId)
    .select('id')

  if (credsErr) {
    console.error('❌ Error deleting credentials:', credsErr)
  } else {
    console.log(`✅ Deleted ${creds?.length ?? 0} credential(s)`)
  }

  console.log('\n✨ Cleanup complete!')
  console.log('\nNext steps:')
  console.log('1. Upload your certificate (.pfx) from the DTE interface')
  console.log('2. Upload your CAF file (.xml) from the DTE interface')
  console.log('3. Try emitting a boleta')
}

// Get restaurant ID from command line
const restaurantId = process.argv[2]

if (!restaurantId) {
  console.error('❌ Usage: npx tsx scripts/clean-dte-data.ts <restaurant_id>')
  process.exit(1)
}

cleanDteData(restaurantId).catch(console.error)
