import dotenv from 'dotenv'
import path from 'path'
// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { calculateRoute } from '../lib/delivery/route-engine.service'
import type { VehicleType } from '../lib/delivery/types'

async function run() {
  console.log('NEXT_PUBLIC_MAPBOX_TOKEN exists:', !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN)
  const origin = { lat: -30.6011, lng: -71.2011 }
  const pickup = 'Avenida Circunvalacion 950 ovalle'
  const delivery = 'Rodolfo walter 668 mirador 2'
  const vehicleType: VehicleType = 'motorcycle'
  
  const result = await calculateRoute(origin, pickup, delivery, vehicleType)
  console.log('Result route polyline (truncated):', result.route?.polyline?.substring(0, 50))
  console.log('Result fallback status:', result.fallback)
  console.log('Result waypoints:', result.route?.waypoints)
}

run()
