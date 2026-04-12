import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DishSchema = z.object({
  name:        z.string().min(1).max(100),
  price:       z.union([z.string(), z.number()]),  // Accept string or number from form
  description: z.string().max(300).optional(),
  category:    z.string().max(60).optional(),
})

const SubmissionSchema = z.object({
  name:          z.string().min(2).max(100),
  address:       z.string().max(200),
  neighborhood:  z.string().max(80),
  cuisine_type:  z.string().min(2).max(60),
  price_range:   z.enum(['economico', 'medio', 'premium']),
  owner_name:    z.string().min(2).max(100),
  owner_email:   z.string().email(),
  owner_phone:   z.string().max(20).optional(),
  description:   z.string().max(500).optional(),
  instagram_url: z.string().max(200).optional(),
  plan:          z.enum(['free', 'discovery', 'starter', 'pro', 'enterprise']).default('free'),
  dishes:        z.array(DishSchema).default([]),
})

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = SubmissionSchema.parse(body)

    // Normalise Instagram
    let instagram_url = data.instagram_url?.trim() || null
    if (instagram_url && !instagram_url.startsWith('http')) {
      instagram_url = `https://instagram.com/${instagram_url.replace(/^@/, '')}`
    }

    const slug = toSlug(data.name)

    // ── 1. Create the restaurant directly (auto-publish) ──────────────────
    const { data: restaurant, error: restErr } = await supabase
      .from('restaurants')
      .insert({
        name:         data.name,
        slug,
        address:      data.address || 'Por completar',
        neighborhood: data.neighborhood || 'Por completar',
        cuisine_type: data.cuisine_type,
        price_range:  data.price_range,
        plan:         data.plan,
        active:       true,
        claimed:      true,  // Self-submitted = claimed
      })
      .select('id')
      .single()

    if (restErr) {
      // If slug already exists, try with suffix
      if (restErr.code === '23505') {
        const slugRetry = `${slug}-${Date.now().toString(36).slice(-4)}`
        const { data: retryData, error: retryErr } = await supabase
          .from('restaurants')
          .insert({
            name:         data.name,
            slug:         slugRetry,
            address:      data.address || 'Por completar',
            neighborhood: data.neighborhood || 'Por completar',
            cuisine_type: data.cuisine_type,
            price_range:  data.price_range,
            plan:         data.plan,
            active:       true,
            claimed:      true,
          })
          .select('id')
          .single()

        if (retryErr || !retryData) {
          console.error('Restaurant insert retry error:', retryErr)
          return NextResponse.json({ error: 'No pudimos crear tu restaurante.' }, { status: 500 })
        }

        // Use retry data
        const restaurantId = retryData.id
        await insertMenuItems(restaurantId, data.dishes)
        await createSubmissionRecord(data, slugRetry, instagram_url)
        return NextResponse.json({ success: true, slug: slugRetry, restaurant_id: restaurantId }, { status: 201 })
      }

      console.error('Restaurant insert error:', restErr)
      return NextResponse.json({ error: 'No pudimos crear tu restaurante.' }, { status: 500 })
    }

    const restaurantId = restaurant.id

    // ── 2. Insert menu items ──────────────────────────────────────────────
    await insertMenuItems(restaurantId, data.dishes)

    // ── 3. Also save to submissions for tracking ─────────────────────────
    await createSubmissionRecord(data, slug, instagram_url)

    return NextResponse.json({
      success: true,
      slug,
      restaurant_id: restaurantId,
      dishes_count: data.dishes.length,
    }, { status: 201 })

  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.issues.map((i: z.ZodIssue) => i.message).join(', ')
      return NextResponse.json({ error: 'Datos invalidos: ' + messages }, { status: 400 })
    }
    console.error('Submit restaurant error:', err)
    return NextResponse.json({ error: 'Error del servidor. Intenta de nuevo.' }, { status: 500 })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function insertMenuItems(
  restaurantId: string,
  dishes: { name: string; price: string | number; description?: string; category?: string }[]
) {
  if (dishes.length === 0) return

  const menuItems = dishes.map(dish => ({
    restaurant_id: restaurantId,
    name:          dish.name,
    price:         typeof dish.price === 'string' ? parseInt(dish.price) || 0 : dish.price,
    description:   dish.description || null,
    category:      dish.category || 'Principal',
    tags:          [],
    available:     true,
  }))

  const { error } = await supabase.from('menu_items').insert(menuItems)
  if (error) console.error('Menu items insert error:', error)
}

async function createSubmissionRecord(
  data: z.infer<typeof SubmissionSchema>,
  slug: string,
  instagram_url: string | null
) {
  const { error } = await supabase.from('restaurant_submissions').insert({
    name:           data.name,
    slug_proposed:  slug,
    address:        data.address || 'Por completar',
    neighborhood:   data.neighborhood || 'Por completar',
    cuisine_type:   data.cuisine_type,
    price_range:    data.price_range,
    owner_name:     data.owner_name,
    owner_email:    data.owner_email,
    owner_phone:    data.owner_phone || null,
    description:    `Plan: ${data.plan}. ${data.dishes.length} platos.`,
    instagram_url,
    status:         'approved',
  })
  if (error) console.error('Submission record error:', error)
}
