import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET /api/restaurants/by-slug?slug=xxx — Public restaurant lookup

export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'slug required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('id, name, slug, address, neighborhood, phone, photo_url, hours, reservations_enabled, reservation_max_party, reservation_advance_days')
    .eq('slug', slug)
    .single()

  if (error || !restaurant) {
    return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ restaurant })
}
