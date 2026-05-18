/**
 * GET /api/delivery/marketplace — list restaurants available for delivery
 * Requires rider auth (Bearer token).
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRider } from '@/lib/supabase/auth-guard'
import { getMarketplaceListings } from '@/lib/delivery/marketplace.service'
import type { VehicleType } from '@/lib/delivery/types'

export async function GET(req: NextRequest) {
  const { rider, error } = await requireRider()
  if (error) return error

  const { searchParams } = req.nextUrl
  const latParam  = searchParams.get('lat')
  const lngParam  = searchParams.get('lng')
  const vehicleType = searchParams.get('vehicle_type') as VehicleType | null
  const minFeeParam = searchParams.get('min_fee')

  const lat = latParam  ? parseFloat(latParam)  : null
  const lng = lngParam  ? parseFloat(lngParam)  : null
  const minFee = minFeeParam ? parseInt(minFeeParam, 10) : undefined

  if (latParam && isNaN(lat!)) {
    return NextResponse.json({ error: 'lat debe ser un número válido' }, { status: 400 })
  }
  if (lngParam && isNaN(lng!)) {
    return NextResponse.json({ error: 'lng debe ser un número válido' }, { status: 400 })
  }

  try {
    const listings = await getMarketplaceListings(lat, lng, {
      vehicle_type: vehicleType ?? undefined,
      min_fee:      minFee,
    })
    return NextResponse.json(listings)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
