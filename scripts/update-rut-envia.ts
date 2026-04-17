/**
 * Script to update rut_envia for a restaurant
 * Run with: npx tsx scripts/update-rut-envia.ts <restaurant_id> <rut_envia>
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

async function updateRutEnvia(restaurantId: string, rutEnvia: string) {
  console.log(`Updating rut_envia for restaurant: ${restaurantId}`)
  console.log(`New rut_envia: ${rutEnvia}\n`)

  const { error } = await supabase
    .from('dte_credentials')
    .update({
      rut_envia: rutEnvia,
      fecha_resolucion: '2021-07-09',  // Default from config.php
      numero_resolucion: 99,            // Default from config.php
    })
    .eq('restaurant_id', restaurantId)

  if (error) {
    console.error('❌ Error updating:', error)
    process.exit(1)
  }

  console.log('✅ Updated successfully!')
  console.log('\nYou can now try emitting a boleta again.')
}

const restaurantId = process.argv[2]
const rutEnvia = process.argv[3]

if (!restaurantId || !rutEnvia) {
  console.error('❌ Usage: npx tsx scripts/update-rut-envia.ts <restaurant_id> <rut_envia>')
  console.error('\nExample: npx tsx scripts/update-rut-envia.ts 2c8864cd-84a8-4517-b4c1-920b5f6c25f1 10089092-5')
  process.exit(1)
}

updateRutEnvia(restaurantId, rutEnvia).catch(console.error)
