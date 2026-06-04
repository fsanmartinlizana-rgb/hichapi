import { searchRestaurants } from './lib/discovery'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve('./hichapi-mobile-app/.env.local') })

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

async function run() {
  const result = await searchRestaurants({
    zone: 'Ovalle',
    cuisine_type: null,
    budget_clp: null,
    dietary_restrictions: []
  })
  console.log(JSON.stringify(result, null, 2))
}

run().catch(console.error)
