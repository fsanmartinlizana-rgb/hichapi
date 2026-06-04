import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve('./hichapi-mobile-app/.env.local') })

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
)

async function run() {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, neighborhood, active')
    
  if (error) {
    console.error('Error:', error)
  }
  
  const ovalle = data?.filter(r => 
    r.neighborhood?.toLowerCase().includes('ovalle') ||
    r.name?.toLowerCase().includes('ovalle')
  )
  
  console.log('All restaurants count:', data?.length)
  console.log('Ovalle restaurants:', ovalle)
}

run()
