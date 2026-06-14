import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

// ── POST /api/menu-items/extract ───────────────────────────────────────────
//
// Recibe una imagen (base64) de una carta y devuelve una lista estructurada
// de platos detectados. No escribe en DB — el usuario puede revisar/editar y
// luego llamar al bulk insert.

// Sonnet con vision para cartas largas tarda 1-3 min. Default de Vercel (10s
// Hobby / 60s Pro) puede no alcanzar. Forzamos 60s explícito para no depender
// del plan.
export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// Hay 2 modos de entrada (xor):
//   - images:    array base64 (legacy). Bueno para fotos chicas; falla con 413
//                en Vercel si el conjunto supera ~4 MB.
//   - file_urls: array de URLs públicas de Supabase Storage (preferido).
//                Sin límite de Vercel, soporta PDFs grandes (27+ páginas).
const BodySchema = z.object({
  images:    z.array(z.string().min(1)).max(6).optional(),
  file_urls: z.array(z.string().url()).max(6).optional(),
  mime:      z.string().default('image/jpeg'),
}).refine(
  v => (v.images && v.images.length > 0) || (v.file_urls && v.file_urls.length > 0),
  { message: 'Se requiere al menos una imagen o file_url' },
)

/** Detecta si una URL apunta a un PDF por extensión. Pdf/jpg/png explícitos
 *  ganan; default = imagen jpeg. */
function inferMimeFromUrl(url: string, fallback: string): string {
  const lower = url.toLowerCase().split('?')[0]
  if (lower.endsWith('.pdf'))  return 'application/pdf'
  if (lower.endsWith('.png'))  return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif'))  return 'image/gif'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return fallback
}

/** Anthropic acepta image/* como vision, application/pdf como document.
 *  Construye el block según mime, eligiendo source URL si está disponible. */
function buildContentBlock(
  source: { kind: 'b64'; data: string } | { kind: 'url'; url: string },
  mime: string,
): Anthropic.ContentBlockParam {
  if (mime === 'application/pdf') {
    return {
      type:   'document',
      source: source.kind === 'url'
        ? { type: 'url', url: source.url }
        : { type: 'base64', media_type: 'application/pdf', data: source.data },
    }
  }
  // Imagen: normalizamos mime al subset que Vision acepta.
  const imageMime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' =
    mime === 'image/png'  ? 'image/png'
    : mime === 'image/webp' ? 'image/webp'
    : mime === 'image/gif'  ? 'image/gif'
    : 'image/jpeg'
  return {
    type:   'image',
    source: source.kind === 'url'
      ? { type: 'url', url: source.url }
      : { type: 'base64', media_type: imageMime, data: source.data },
  }
}

const EXTRACTION_PROMPT = `Eres un asistente experto que analiza cartas de restaurantes en Chile.

Tu tarea: extraer TODOS los platos / bebidas de la carta (imagen o PDF) y
devolverlos via la herramienta extract_menu.

Reglas:
- Procesa todas las páginas si es PDF multi-página.
- Si un ítem NO tiene precio claro visible, omítelo.
- Incluye combos y menú del día si aparecen.
- Usa los nombres tal como aparecen (respetando tildes).
- Para precios chilenos: convertí "$18.000" o "18.000" a 18000 (entero, sin separadores).
- Para ingredients: solo cuando la carta menciona EXPLÍCITAMENTE el gramaje
  o cantidad por ingrediente. Si no hay receta visible, omitir el array.`

// Tool schema — Anthropic garantiza que la respuesta cumple este schema,
// evitando los problemas de JSON malformado con cartas largas.
const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'extract_menu',
  description: 'Devuelve la lista estructurada de platos detectados en la carta.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Array de platos extraídos.',
        items: {
          type: 'object',
          properties: {
            name:        { type: 'string', description: 'Nombre del plato' },
            description: { type: 'string', description: 'Descripción corta. Vacío si no hay.' },
            price:       { type: 'number', description: 'Precio en CLP entero, sin separadores.' },
            category:    {
              type: 'string',
              enum: ['entrada', 'principal', 'postre', 'bebida', 'para compartir'],
              description: 'Categoría inferida por contexto.',
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['vegano', 'vegetariano', 'sin gluten', 'sin lactosa', 'picante', 'popular', 'nuevo', 'especialidad', 'para compartir'],
              },
              description: 'Tags relevantes.',
            },
            ingredients: {
              type: 'array',
              description: 'Receta cuando la carta indica gramaje. Omitir si no hay receta visible.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Nombre del ingrediente' },
                  qty:  { type: 'number', description: 'Cantidad numérica' },
                  unit: {
                    type: 'string',
                    enum: ['kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja'],
                  },
                },
                required: ['name', 'qty', 'unit'],
              },
            },
          },
          required: ['name', 'price', 'category'],
        },
      },
    },
    required: ['items'],
  },
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  try {
    const body = BodySchema.parse(await req.json())

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'IA no configurada' }, { status: 503 })
    }

    // Build content blocks — preferimos URLs (Storage) si vinieron; sino base64.
    const useUrls = !!(body.file_urls && body.file_urls.length > 0)
    const content: Anthropic.ContentBlockParam[] = [
      { type: 'text', text: EXTRACTION_PROMPT },
      ...(useUrls
        ? body.file_urls!.map(url => buildContentBlock(
            { kind: 'url', url },
            inferMimeFromUrl(url, body.mime),
          ))
        : body.images!.map(b64 => buildContentBlock(
            { kind: 'b64', data: b64 },
            body.mime,
          ))
      ),
    ]

    // Forzamos tool_use para que la respuesta sea SIEMPRE JSON válido
    // (sin riesgo de markdown, comillas mal escapadas o truncado en medio
    // de un string como pasaba con max_tokens=3000 + carta larga).
    const response = await anthropic.messages.create({
      model:       'claude-sonnet-4-5-20250929',
      // 16384 = máx output de Sonnet 4.5. Antes era 8000 → con cartas de 40+
      // platos, el tool_use se truncaba a mitad de JSON y items quedaba vacío.
      // El frontend mostraba "foto poco nítida" cuando en realidad la carta
      // era buena pero muy larga. Diagnóstico real en JUN 06 prod (request
      // zzxz8-1780801343949-a4aeedc1cfd7). Doblar tokens cubre cartas grandes.
      max_tokens:  16384,
      tools:       [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: EXTRACT_TOOL.name },
      messages:    [{ role: 'user', content }],
    })

    type ExtractedIngredient = { name: string; qty: number; unit: string }
    type ExtractedItem = {
      name:         string
      description?: string
      price:        number
      category:     string
      tags?:        string[]
      ingredients?: ExtractedIngredient[]
    }

    // Buscar el tool_use block en la respuesta
    const toolUse = response.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use' && c.name === EXTRACT_TOOL.name,
    )

    if (!toolUse) {
      // Fallback raro: el modelo no usó la tool (puede pasar si stop_reason es algo distinto)
      console.error('[menu-items/extract] modelo no devolvió tool_use', {
        stop_reason: response.stop_reason,
        content:     response.content.map(c => c.type),
      })
      return NextResponse.json(
        { error: 'No se pudo extraer la carta. Probá de nuevo o usa una imagen más clara.' },
        { status: 422 },
      )
    }

    const parsed = (toolUse.input ?? {}) as { items?: ExtractedItem[] }

    if (response.stop_reason === 'max_tokens') {
      console.warn('[menu-items/extract] respuesta truncada por max_tokens — algunos items pueden faltar')
    }

    const VALID_UNITS = new Set(['kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja'])

    const items = (parsed.items ?? [])
      .filter(i => i.name && typeof i.price === 'number' && i.price > 0)
      .map(i => ({
        name:        i.name.trim().slice(0, 100),
        description: (i.description ?? '').trim().slice(0, 300) || null,
        price:       Math.round(i.price),
        category:    ['entrada', 'principal', 'postre', 'bebida', 'para compartir'].includes((i.category ?? '').toLowerCase())
                      ? i.category.toLowerCase()
                      : 'principal',
        tags:        Array.isArray(i.tags) ? i.tags.slice(0, 8) : [],
        available:   true,
        // Ingredientes detectados — el frontend los puede asociar a stock_items
        // por nombre approx (no los persistimos directo porque el restaurant
        // probablemente todavia no tiene esos productos en stock).
        ingredients_hint: Array.isArray(i.ingredients)
          ? i.ingredients
              .filter(ing => ing && ing.name && typeof ing.qty === 'number' && ing.qty > 0)
              .map(ing => ({
                name: ing.name.trim().slice(0, 100),
                qty:  ing.qty,
                unit: VALID_UNITS.has((ing.unit ?? '').toLowerCase()) ? ing.unit.toLowerCase() : 'unidad',
              }))
              .slice(0, 20)
          : [],
      }))

    return NextResponse.json({
      ok:        true,
      items,
      count:     items.length,
      truncated: response.stop_reason === 'max_tokens',
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    // Log más útil para debugging — incluye el mensaje del error
    const message = err instanceof Error ? err.message : String(err)
    console.error('[menu-items/extract] error:', message, err)
    return NextResponse.json(
      { error: `Error al analizar el archivo: ${message}` },
      { status: 500 },
    )
  }
}
