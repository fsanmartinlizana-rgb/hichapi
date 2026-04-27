import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

// ── POST /api/menu-items/extract ───────────────────────────────────────────
//
// Recibe una imagen (base64) de una carta y devuelve una lista estructurada
// de platos detectados. No escribe en DB — el usuario puede revisar/editar y
// luego llamar al bulk insert.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const BodySchema = z.object({
  // Cada archivo en base64 (sin el prefijo "data:..."). Acepta imágenes o PDF.
  images: z.array(z.string().min(1)).min(1).max(6),
  mime: z.string().default('image/jpeg'),
})

/** Anthropic acepta image/* como vision, application/pdf como document.
 * Convierte el mime del browser al formato del block correcto. */
function buildContentBlock(b64: string, mime: string): Anthropic.ContentBlockParam {
  if (mime === 'application/pdf') {
    return {
      type: 'document',
      source: {
        type:       'base64',
        media_type: 'application/pdf',
        data:       b64,
      },
    }
  }
  // Default: imagen. Normalizar mime a uno soportado por Vision.
  const imageMime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' =
    mime === 'image/png'  ? 'image/png'
    : mime === 'image/webp' ? 'image/webp'
    : mime === 'image/gif'  ? 'image/gif'
    : 'image/jpeg'
  return {
    type: 'image',
    source: { type: 'base64', media_type: imageMime, data: b64 },
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

    // Build content blocks — image vs document según el mime
    const content: Anthropic.ContentBlockParam[] = [
      { type: 'text', text: EXTRACTION_PROMPT },
      ...body.images.map(b64 => buildContentBlock(b64, body.mime)),
    ]

    // Forzamos tool_use para que la respuesta sea SIEMPRE JSON válido
    // (sin riesgo de markdown, comillas mal escapadas o truncado en medio
    // de un string como pasaba con max_tokens=3000 + carta larga).
    const response = await anthropic.messages.create({
      model:       'claude-sonnet-4-5-20250929',
      max_tokens:  8000,            // Subir tope para cartas largas (PDFs)
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
