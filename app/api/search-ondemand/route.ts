/**
 * POST /api/search-ondemand
 * Uses OpenStreetMap Overpass API (100% free, no key needed) to find
 * restaurants in a given zone and inserts new ones into Supabase.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { resolveZone } from '@/lib/landmarks'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bounding boxes per neighborhood (lat_min, lon_min, lat_max, lon_max)
const BBOX: Record<string, [number, number, number, number]> = {
  'Providencia':      [-33.445, -70.650, -33.420, -70.610],
  'Barrio Italia':    [-33.458, -70.625, -33.440, -70.595],
  'Bellavista':       [-33.440, -70.660, -33.425, -70.635],
  'Lastarria':        [-33.445, -70.650, -33.430, -70.630],
  'Santiago Centro':  [-33.460, -70.680, -33.430, -70.640],
  'Las Condes':       [-33.420, -70.600, -33.395, -70.555],
  'Vitacura':         [-33.405, -70.610, -33.380, -70.565],
  'Ñuñoa':            [-33.470, -70.615, -33.445, -70.580],
  'Nunoa':            [-33.470, -70.615, -33.445, -70.580],
  'Miraflores':       [-33.448, -70.658, -33.432, -70.638],
  'Recoleta':         [-33.428, -70.660, -33.408, -70.635],
  'San Miguel':       [-33.510, -70.660, -33.485, -70.630],
}

function toSlug(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60)
}

function guessCuisine(tags: Record<string, string>): string {
  const c = (tags.cuisine ?? '').toLowerCase()
  if (c.includes('japan') || c.includes('sushi') || c.includes('ramen')) return 'japonesa'
  if (c.includes('ital') || c.includes('pizza') || c.includes('pasta')) return 'italiana'
  if (c.includes('peru') || c.includes('ceviche')) return 'peruana'
  if (c.includes('mexic') || c.includes('taco')) return 'mexicana'
  if (c.includes('vegan') || c.includes('vegetar')) return 'vegana'
  if (c.includes('burger') || c.includes('hambur')) return 'hamburgueseria'
  if (c.includes('thai') || c.includes('asian') || c.includes('chine')) return 'asiatica'
  if (c.includes('chil') || c.includes('crioll')) return 'chilena'
  if (c.includes('seafood') || c.includes('maris')) return 'mariscos'
  if (c.includes('french') || c.includes('franc')) return 'francesa'
  if (c.includes('mediter')) return 'mediterranea'
  return tags.cuisine ?? 'internacional'
}

function guessPriceRange(tags: Record<string, string>): 'economico' | 'medio' | 'premium' {
  const p = (tags['price_range'] ?? tags['price'] ?? '').toLowerCase()
  if (p.includes('expensive') || p === '$$$$' || p === '$$$') return 'premium'
  if (p.includes('cheap') || p === '$') return 'economico'
  return 'medio'
}

export async function POST(req: NextRequest) {
  // Allow requests from our own domain (public Chapi on landing page)
  const origin  = req.headers.get('origin') ?? ''
  const referer = req.headers.get('referer') ?? ''
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const isOwn   = origin.startsWith(siteUrl) || referer.startsWith(siteUrl) ||
                  origin === '' // server-side calls
  if (!isOwn) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    const { intent } = await req.json()

    // Resolve zone
    const rawZone = intent?.zone ?? null
    const zone    = resolveZone(rawZone) ?? rawZone ?? 'Santiago Centro'
    const bbox    = BBOX[zone] ?? BBOX['Santiago Centro']

    // ── Query Overpass API ────────────────────────────────────────────────────
    const overpassQuery = `
      [out:json][timeout:20];
      (
        node["amenity"="restaurant"](${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]});
        node["amenity"="cafe"](${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]});
        node["amenity"="bar"]["food"="yes"](${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]});
      );
      out body 30;
    `.trim()

    const osmRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:   `data=${encodeURIComponent(overpassQuery)}`,
      signal: AbortSignal.timeout(25000),
    })

    if (!osmRes.ok) {
      return NextResponse.json({ inserted: 0, error: 'Overpass API error' }, { status: 200 })
    }

    const osmData = await osmRes.json()
    const elements: any[] = osmData.elements ?? []

    if (elements.length === 0) {
      return NextResponse.json({ inserted: 0 })
    }

    // ── Get existing slugs to avoid duplicates ────────────────────────────────
    const { data: existing } = await supabase
      .from('restaurants')
      .select('slug')
      .eq('active', true)

    const existingSlugs = new Set((existing ?? []).map((r: any) => r.slug))

    // ── Map OSM nodes → restaurant rows ──────────────────────────────────────
    const toInsert = elements
      .filter(el => el.tags?.name && el.lat && el.lon)
      .map(el => {
        const tags  = el.tags ?? {}
        const slug  = toSlug(tags.name)
        return {
          name:         tags.name,
          slug:         slug,
          address:      [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || tags.address || null,
          neighborhood: zone,
          lat:          el.lat,
          lng:          el.lon,
          cuisine_type: guessCuisine(tags),
          price_range:  guessPriceRange(tags),
          rating:       4.0,
          review_count: 0,
          active:       true,
          plan:         'free',
          photo_url:    null,
        }
      })
      .filter(r => !existingSlugs.has(r.slug))
      .slice(0, 15) // cap at 15 new per request

    if (toInsert.length === 0) {
      return NextResponse.json({ inserted: 0 })
    }

    // ── Insert into Supabase ──────────────────────────────────────────────────
    const { data: inserted, error } = await supabase
      .from('restaurants')
      .insert(toInsert)
      .select('id, name')

    if (error) {
      console.error('OSM insert error:', error)
      return NextResponse.json({ inserted: 0, error: error.message }, { status: 200 })
    }

    // ── Auto-create a generic menu item per new restaurant so search works ───
    const menuItems = (inserted ?? []).map((r: any) => ({
      restaurant_id: r.id,
      name:         'Plato del día',
      description:  'Consultar al restaurante para la carta del día',
      price:        9900,
      category:     'platos principales',
      tags:         ['internacional'],
      available:    true,
    }))

    if (menuItems.length > 0) {
      await supabase.from('menu_items').insert(menuItems)
    }

    return NextResponse.json({ inserted: inserted?.length ?? 0 })
  } catch (err) {
    console.error('search-ondemand error:', err)
    return NextResponse.json({ inserted: 0 }, { status: 200 })
  }
}
