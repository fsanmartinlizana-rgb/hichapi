import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── Schema ───────────────────────────────────────────────────────────────────

const SeedRestaurantSchema = z.object({
  name:          z.string().min(2).max(100),
  address:       z.string().max(200).default('Por completar'),
  neighborhood:  z.string().max(80).default('Por completar'),
  cuisine_type:  z.string().min(2).max(60),
  price_range:   z.enum(['economico', 'medio', 'premium']),
  instagram_url: z.string().max(200).optional(),
  phone:         z.string().max(20).optional(),
  photo_url:     z.string().url().optional(),
  latitude:      z.number().optional(),
  longitude:     z.number().optional(),
})

const BulkSeedSchema = z.object({
  restaurants: z.array(SeedRestaurantSchema).min(1).max(50),
  admin_key:   z.string(), // Simple API key protection
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── POST /api/restaurants/seed ───────────────────────────────────────────────
// Bulk-seed restaurants (unclaimed, no menu) for discovery

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { restaurants, admin_key } = BulkSeedSchema.parse(body)

    // Simple admin key check
    if (admin_key !== (process.env.ADMIN_SEED_KEY || process.env.ADMIN_SECRET)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const results: { name: string; slug: string; status: 'created' | 'exists' | 'error' }[] = []

    for (const r of restaurants) {
      const slug = toSlug(r.name)

      // Normalize Instagram
      let instagram_url = r.instagram_url?.trim() || null
      if (instagram_url && !instagram_url.startsWith('http')) {
        instagram_url = `https://instagram.com/${instagram_url.replace(/^@/, '')}`
      }

      // Build insert payload — only include columns that exist in schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = {
        name:          r.name,
        slug,
        address:       r.address,
        neighborhood:  r.neighborhood,
        cuisine_type:  r.cuisine_type,
        price_range:   r.price_range,
        plan:          'free',
        active:        true,
        claimed:       false,  // Seeded = unclaimed
      }
      if (instagram_url) payload.instagram_url = instagram_url
      if (r.phone) payload.phone = r.phone
      if (r.photo_url) payload.photo_url = r.photo_url

      const { error } = await supabase
        .from('restaurants')
        .insert(payload)

      if (error) {
        if (error.code === '23505') {
          results.push({ name: r.name, slug, status: 'exists' })
        } else {
          console.error(`Seed error for ${r.name}:`, error)
          results.push({ name: r.name, slug, status: 'error' as const })
        }
      } else {
        results.push({ name: r.name, slug, status: 'created' })
      }
    }

    const created = results.filter(r => r.status === 'created').length
    const existing = results.filter(r => r.status === 'exists').length
    const errors = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      summary: { created, existing, errors, total: restaurants.length },
      results,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: err.issues },
        { status: 400 }
      )
    }
    console.error('Seed route error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
