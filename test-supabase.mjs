import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve('./hichapi-mobile-app/.env.local') })

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
)

async function run() {
  const allZones = ['Ovalle']
  const orConditions = allZones.map(z => `neighborhood.ilike.%${z}%`).join(',')
  
  const { data, error } = await supabase
    .from('restaurants')
    .select(`id, name, slug, address, neighborhood, lat, lng, photo_url, cuisine_type, price_range, rating, review_count, google_rating, google_rating_count, photo_source, claimed, owner_id, menu_items (id, name, description, price, tags, photo_url, available, category)`)
    .eq('active', true)
    .or(orConditions)
    .limit(500)
    
  if (error) {
    console.error('Error:', error)
  }
  
  console.log(`Results from DB (length: ${data?.length}):`)
  if (data?.length > 0) {
    console.log(data.map(r => r.name))
  }
}

run()
