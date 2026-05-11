/**
 * POST /api/track
 *
 * Endpoint único de tracking client-side. Discriminator `type` decide qué
 * tabla recibe el insert.
 *
 * Privacy (Ley 19.628):
 *   - IP cruda nunca se guarda. Solo país/región derivados de headers Vercel.
 *   - referrer se sanitiza para no guardar query params (tokens UTM, etc.).
 *   - session_id es pseudoanónimo (localStorage UUID).
 *
 * Inserción usa Supabase service_role para bypassar RLS (las tablas tienen
 * "public_insert" pero el service_role nos da control total).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Schemas (uno por tipo) ─────────────────────────────────────────────────

const BaseSchema = z.object({
  session_id:  z.string().min(8).max(64),
  user_id:     z.string().uuid().optional().nullable(),
  user_agent:  z.string().max(500).optional().nullable(),
  referrer:    z.string().max(500).optional().nullable(),
})

const PageViewSchema = BaseSchema.extend({
  type:           z.literal('page_view'),
  path:           z.string().min(1).max(500),
  restaurant_id:  z.string().uuid().optional().nullable(),
  duration_ms:    z.number().int().nonnegative().max(86_400_000).optional().nullable(),
})

const SearchSchema = BaseSchema.extend({
  type:               z.literal('search'),
  query_text:         z.string().min(1).max(500),
  parsed_intent:      z.record(z.string(), z.unknown()).optional().nullable(),
  zone_detected:      z.string().max(80).optional().nullable(),
  zone_lat:           z.number().optional().nullable(),
  zone_lng:           z.number().optional().nullable(),
  results_count:      z.number().int().nonnegative().max(100).optional().nullable(),
  no_results_in_zone: z.boolean().optional(),
  triggered_enrichment: z.boolean().optional(),
})

const SearchResultsSchema = BaseSchema.extend({
  type:             z.literal('search_results'),
  search_event_id:  z.string().uuid(),
  results: z.array(z.object({
    restaurant_id: z.string().uuid(),
    position:      z.number().int().positive().max(50),
  })).max(20),
})

const ResultClickSchema = BaseSchema.extend({
  type:             z.literal('result_click'),
  search_event_id:  z.string().uuid(),
  restaurant_id:    z.string().uuid(),
})

const BodySchema = z.discriminatedUnion('type', [
  PageViewSchema,
  SearchSchema,
  SearchResultsSchema,
  ResultClickSchema,
])

// ── Helpers de privacidad ──────────────────────────────────────────────────

/** Sanitiza el referrer: deja origen + path, descarta query y fragment (UTM). */
function sanitizeReferrer(ref: string | null | undefined): string | null {
  if (!ref) return null
  try {
    const u = new URL(ref)
    return `${u.origin}${u.pathname}`.slice(0, 500)
  } catch {
    return null
  }
}

/** Trunca user_agent para no inflar storage. */
function sanitizeUA(ua: string | null | undefined): string | null {
  if (!ua) return null
  return ua.slice(0, 500)
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Privacy: enriquecemos con país/región desde headers Vercel.
  // NUNCA leemos x-forwarded-for ni guardamos IP.
  const ip_country = req.headers.get('x-vercel-ip-country') ?? null
  const ip_region  = req.headers.get('x-vercel-ip-country-region') ?? null
  const referrer   = sanitizeReferrer(body.referrer)
  const user_agent = sanitizeUA(body.user_agent)

  try {
    switch (body.type) {
      case 'page_view': {
        await supabase.from('page_views').insert({
          session_id:    body.session_id,
          user_id:       body.user_id ?? null,
          path:          body.path,
          restaurant_id: body.restaurant_id ?? null,
          duration_ms:   body.duration_ms ?? null,
          referrer, user_agent, ip_country, ip_region,
        })
        return NextResponse.json({ ok: true })
      }

      case 'search': {
        const { data, error } = await supabase.from('search_events').insert({
          session_id:           body.session_id,
          user_id:              body.user_id ?? null,
          query_text:           body.query_text,
          parsed_intent:        body.parsed_intent ?? null,
          zone_detected:        body.zone_detected ?? null,
          zone_lat:             body.zone_lat ?? null,
          zone_lng:             body.zone_lng ?? null,
          results_count:        body.results_count ?? null,
          no_results_in_zone:   body.no_results_in_zone ?? false,
          triggered_enrichment: body.triggered_enrichment ?? false,
          referrer, user_agent, ip_country, ip_region,
        }).select('id').single()

        if (error) {
          console.error('[track] search insert error:', error)
          return NextResponse.json({ ok: false }, { status: 500 })
        }
        return NextResponse.json({ ok: true, search_event_id: data.id })
      }

      case 'search_results': {
        const rows = body.results.map(r => ({
          search_event_id: body.search_event_id,
          restaurant_id:   r.restaurant_id,
          position:        r.position,
        }))
        const { data, error } = await supabase
          .from('search_result_events')
          .insert(rows)
          .select('id, restaurant_id, position')
        if (error) {
          console.error('[track] search_results insert error:', error)
          return NextResponse.json({ ok: false }, { status: 500 })
        }
        return NextResponse.json({ ok: true, events: data })
      }

      case 'result_click': {
        await supabase
          .from('search_result_events')
          .update({ clicked: true, clicked_at: new Date().toISOString() })
          .eq('search_event_id', body.search_event_id)
          .eq('restaurant_id',   body.restaurant_id)
        return NextResponse.json({ ok: true })
      }
    }
  } catch (err) {
    console.error('[track] handler error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
