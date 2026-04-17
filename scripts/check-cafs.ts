import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createAdminClient } from '@/lib/supabase/server'

async function checkCafs() {
  const restaurantId = process.argv[2] || '2c8864cd-84a8-4517-b4c1-920b5f6c25f1'
  const supabase = createAdminClient()

  console.log(`Verificando CAFs para restaurant_id: ${restaurantId}\n`)

  const { data, error } = await supabase
    .from('dte_cafs')
    .select('*')
    .eq('restaurant_id', restaurantId)

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  console.log(`Total CAFs encontrados: ${data?.length || 0}`)
  console.log(JSON.stringify(data, null, 2))
}

checkCafs()
