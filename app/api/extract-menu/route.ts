/**
 * POST /api/extract-menu
 *
 * Extrae platos reales del website del restaurant (cuando Google Places nos
 * dio uno) usando Claude Haiku como parser de HTML semi-estructurado.
 *
 * Flujo:
 *   1. Lee restaurants.config_chapi.{website, menu_extracted}.
 *   2. Si menu_extracted=true → skip (idempotente).
 *   3. Fetch del HTML del website con User-Agent identificable + timeout 10s.
 *   4. Pasa el HTML (truncado a 50k chars) a Claude Haiku con instrucción
 *      estricta: extraer 5-10 platos reales con nombre + precio CLP + tags.
 *   5. Insert en menu_items.
 *   6. UPDATE config_chapi.menu_extracted = true + extracted_at.
 *
 * Costo: 1 call a Claude Haiku por restaurant (~$0.001). Idempotente.
 *
 * Si no hay website o el HTML no tiene menú → marcar menu_extracted=true
 * con metadata.reason para NO reintentar automático.
 *
 * Endpoint admin-only (mismo patrón que /api/admin/*): protegido con
 * x-admin-secret porque dispara llamada a LLM con costo.
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function isAuthorized(req: NextRequest) {
  const s = process.env.ADMIN_SECRET
  if (!s || s.length < 20) return false
  return req.headers.get('x-admin-secret') === s
}

const BodySchema = z.object({
  restaurant_id: z.string().uuid(),
  force:         z.boolean().optional(),  // ignorar menu_extracted=true
})

const SYSTEM_PROMPT = `Sos un parser de menús de restaurantes. Recibís HTML
(parcialmente convertido a texto) y devolvés HASTA 8 platos reales en JSON.

REGLAS:
1. Solo platos comestibles con precio identificable en CLP. NO devuelvas
   bebidas estándar (agua, bebidas), promociones marketing ("2x1"), ni
   secciones genéricas ("entradas").
2. Si el HTML no contiene un menú claro, devolvé { "items": [] }.
3. Nombres: limpios, capitalizados, máximo 50 chars.
4. Precios: enteros en CLP. Convertí "$" sin moneda → asumí CLP. "USD" o
   "$$$" → omití el plato.
5. Categorías canónicas: "Entrada" | "Principal" | "Postre" | "Bebida" |
   "Acompañamiento". Si no podés inferir, usá "Principal".
6. Tags: array de strings cortos. Acepta: "sin gluten", "vegano",
   "vegetariano", "sin lactosa", "picante", "kids", "popular". Solo si
   están EXPLÍCITOS en el HTML.

RESPONDÉ SIEMPRE EN ESTE JSON (sin markdown):
{
  "items": [
    { "name": "...", "price": 12000, "category": "Principal", "tags": ["sin gluten"], "description": "..." }
  ],
  "source_quality": "high" | "medium" | "low" | "empty"
}`

interface ExtractedItem {
  name: string; price: number; category?: string;
  tags?: string[]; description?: string;
}
interface ExtractResponse { items: ExtractedItem[]; source_quality: string }

/** Convierte HTML a texto plano "razonable" para el LLM. No queremos pasar
 *  todo el bundle JS/CSS al prompt. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: z.infer<typeof BodySchema>
  try { body = BodySchema.parse(await req.json()) }
  catch { return NextResponse.json({ error: 'Bad payload' }, { status: 400 }) }

  // 1. Leer restaurant
  const { data: r, error } = await supabase
    .from('restaurants')
    .select('id, name, slug, config_chapi')
    .eq('id', body.restaurant_id)
    .single()
  if (error || !r) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }
  const cfg = (r.config_chapi ?? {}) as Record<string, unknown>
  const website = cfg.website as string | null | undefined

  // 2. Idempotencia
  if (cfg.menu_extracted === true && !body.force) {
    return NextResponse.json({ skipped: true, reason: 'already_extracted' })
  }
  if (!website) {
    // Marcar como procesado para no reintentar — sin website no hay nada
    // que scrapear. Owner deberá subir su menú manualmente.
    await supabase.from('restaurants')
      .update({
        config_chapi: { ...cfg, menu_extracted: true, extract_reason: 'no_website', extracted_at: new Date().toISOString() }
      })
      .eq('id', r.id)
      .neq('photo_source', 'owner_upload')
    return NextResponse.json({ skipped: true, reason: 'no_website' })
  }

  // 3. Fetch HTML del website
  let html = ''
  try {
    const res = await fetch(website, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'HiChapi-MenuBot/1.0 (+https://hichapi.com)' },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = await res.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'fetch failed'
    await supabase.from('restaurants')
      .update({
        config_chapi: { ...cfg, menu_extracted: true, extract_reason: `fetch_failed:${msg.slice(0, 50)}`, extracted_at: new Date().toISOString() }
      })
      .eq('id', r.id)
    return NextResponse.json({ skipped: true, reason: 'fetch_failed', detail: msg })
  }

  // 4. Pasar a Claude
  const text = htmlToText(html).slice(0, 50_000)
  if (text.length < 200) {
    await supabase.from('restaurants')
      .update({
        config_chapi: { ...cfg, menu_extracted: true, extract_reason: 'empty_html', extracted_at: new Date().toISOString() }
      })
      .eq('id', r.id)
    return NextResponse.json({ skipped: true, reason: 'empty_html' })
  }

  let parsed: ExtractResponse
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Restaurant: ${r.name}\nWebsite: ${website}\n\nHTML (texto):\n${text}`,
      }],
    })
    const raw = (resp.content[0] as { text?: string })?.text ?? ''
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    parsed = JSON.parse(cleaned) as ExtractResponse
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'llm_failed'
    return NextResponse.json({ error: 'LLM extract failed', detail: msg }, { status: 500 })
  }

  // 5. Insert menu_items
  const validItems = (parsed.items ?? [])
    .filter(i => i.name && Number.isFinite(i.price) && i.price > 0 && i.price < 1_000_000)
    .slice(0, 8)
    .map(i => ({
      restaurant_id: r.id,
      name:          i.name.slice(0, 80),
      description:   (i.description ?? '').slice(0, 280) || null,
      price:         Math.round(i.price),
      category:      (i.category ?? 'Principal').slice(0, 40),
      tags:          (Array.isArray(i.tags) ? i.tags.slice(0, 5) : []),
      available:     true,
    }))

  if (validItems.length > 0) {
    await supabase.from('menu_items').insert(validItems)
  }

  // 6. Marcar como procesado
  await supabase.from('restaurants')
    .update({
      config_chapi: {
        ...cfg,
        menu_extracted:    true,
        extract_reason:    validItems.length > 0 ? 'ok' : 'no_items_found',
        extracted_at:      new Date().toISOString(),
        extracted_count:   validItems.length,
        extracted_quality: parsed.source_quality,
      },
    })
    .eq('id', r.id)

  return NextResponse.json({
    ok:        true,
    inserted:  validItems.length,
    quality:   parsed.source_quality,
  })
}
