import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/menu-features?restaurant_slug=xxx
// Returns all menu items for the restaurant with featured flag
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('restaurant_slug')

  let query = supabase
    .from('menu_items')
    .select('id, name, price, category, tags, available')
    .eq('available', true)
    .order('category')

  if (slug) {
    const { data: rest } = await supabase.from('restaurants').select('id').eq('slug', slug).single()
    if (rest?.id) query = query.eq('restaurant_id', rest.id) as typeof query
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ items: data })
}

// POST /api/menu-features
// Body: { item_ids: string[] }  — sets these items as featured, removes from others
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const { item_ids } = z.object({ item_ids: z.array(z.string()) }).parse(await req.json())

    // Fetch all menu items to know which ones to update
    const { data: all } = await supabase.from('menu_items').select('id, tags')
    if (!all) return NextResponse.json({ error: 'No items' }, { status: 400 })

    const updates = all.map(item => {
      const currentTags: string[] = item.tags ?? []
      const shouldBeFeatured = item_ids.includes(item.id)
      const hasFeatured = currentTags.includes('promovido')

      if (shouldBeFeatured && !hasFeatured) {
        return supabase.from('menu_items').update({ tags: [...currentTags, 'promovido'] }).eq('id', item.id)
      }
      if (!shouldBeFeatured && hasFeatured) {
        return supabase.from('menu_items').update({ tags: currentTags.filter(t => t !== 'promovido') }).eq('id', item.id)
      }
      return null
    }).filter(Boolean)

    await Promise.all(updates)
    return NextResponse.json({ ok: true, featured_count: item_ids.length })
  } catch (err) {
    console.error('POST /api/menu-features error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
