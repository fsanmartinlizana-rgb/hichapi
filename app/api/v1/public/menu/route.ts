import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { validateApiKey, hasScope, logApiRequest } from '@/lib/api-keys'

// ── /api/v1/public/menu ──────────────────────────────────────────────────────
// API pública versionada. Requiere Authorization: Bearer hc_live_…
// Scope requerido: menu:read
//
// Devuelve el menú del restaurant al que pertenece la key. Formato estable
// apto para integraciones externas (no expone columnas internas).

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  const auth = req.headers.get('authorization')

  const { key, error } = await validateApiKey(auth)
  if (!key) {
    return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 })
  }

  if (!key.withinLimit) {
    logApiRequest({
      apiKeyId:   key.record.id,
      method:     'GET',
      path:       '/api/v1/public/menu',
      statusCode: 429,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json(
      { error: 'Rate limit exceeded', retry_after_seconds: 60 },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  if (!hasScope(key.record, 'menu:read')) {
    logApiRequest({
      apiKeyId:   key.record.id,
      method:     'GET',
      path:       '/api/v1/public/menu',
      statusCode: 403,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json({ error: 'Missing scope: menu:read' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { data: items } = await supabase
    .from('menu_items')
    .select('id, name, description, price, category, photo_url, available, tags')
    .eq('restaurant_id', key.record.restaurant_id)
    .order('category')
    .order('name')

  interface MenuRow {
    id: string; name: string; description: string | null;
    price: number; category: string | null; photo_url: string | null;
    available: boolean | null; tags: string[] | null;
  }
  const rows = (items ?? []) as MenuRow[]
  const payload = {
    restaurant_id: key.record.restaurant_id,
    items: rows.map(i => ({
      id:          i.id,
      name:        i.name,
      description: i.description,
      price:       i.price,
      category:    i.category,
      photo_url:   i.photo_url,
      available:   i.available,
      tags:        i.tags ?? [],
    })),
    count: rows.length,
  }

  logApiRequest({
    apiKeyId:   key.record.id,
    method:     'GET',
    path:       '/api/v1/public/menu',
    statusCode: 200,
    durationMs: Date.now() - startedAt,
  })

  return NextResponse.json(payload, {
    headers: {
      'X-RateLimit-Limit':     String(key.record.rate_limit),
      'X-RateLimit-Remaining': String(Math.max(0, key.record.rate_limit - key.requestsInMin - 1)),
    },
  })
}
