/**
 * Script to fix fecha_resolucion for certification environment
 * Updates all dte_credentials to use the correct SII certification date: 2021-01-04
 * 
 * Run with: npx tsx scripts/fix-fecha-resolucion.ts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixFechaResolucion() {
  console.log('🔧 Fixing fecha_resolucion for certification environment...\n')

  // Get all credentials with numero_resolucion = 0 or 99 (certification)
  const { data: creds, error: fetchErr } = await supabase
    .from('dte_credentials')
    .select('id, restaurant_id, fecha_resolucion, numero_resolucion')
    .or('numero_resolucion.eq.0,numero_resolucion.eq.99')

  if (fetchErr) {
    console.error('❌ Error fetching credentials:', fetchErr)
    process.exit(1)
  }

  if (!creds || creds.length === 0) {
    console.log('ℹ️  No credentials found with numero_resolucion = 0 or 99')
    console.log('   Checking all credentials...\n')
    
    // Show all credentials
    const { data: allCreds, error: allErr } = await supabase
      .from('dte_credentials')
      .select('id, restaurant_id, fecha_resolucion, numero_resolucion')

    if (allErr) {
      console.error('❌ Error fetching all credentials:', allErr)
      process.exit(1)
    }

    console.table(allCreds)
    console.log('\n💡 If you need to update specific credentials, modify this script.')
    return
  }

  console.log(`Found ${creds.length} credential(s) to update:\n`)
  console.table(creds)

  // Update all to correct certification values (fecha: 2026-04-23, numero: 0)
  const { error: updateErr } = await supabase
    .from('dte_credentials')
    .update({
      fecha_resolucion: '2026-04-23',
      numero_resolucion: 0,
    })
    .or('numero_resolucion.eq.0,numero_resolucion.eq.99')

  if (updateErr) {
    console.error('❌ Error updating:', updateErr)
    process.exit(1)
  }

  console.log('\n✅ Updated successfully!')
  console.log('   All certification credentials now use:')
  console.log('   - fecha_resolucion: 2026-04-23')
  console.log('   - numero_resolucion: 0')
  console.log('   These are your SII certification values\n')
}

fixFechaResolucion().catch(console.error)
