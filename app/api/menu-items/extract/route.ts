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

Tu tarea: extraer todos los platos / bebidas de la carta (imagen o PDF).

Para cada ítem devuelve:
- name: nombre del plato
- description: descripción corta (si existe en la carta). Si no hay, omite el campo.
- price: precio en pesos chilenos como número entero (sin $, sin puntos, sin comas). Ejemplo: 18000. Si la carta dice "18.000" o "$18.000", tú devuelves 18000.
- category: una de ["entrada", "principal", "postre", "bebida", "para compartir"]. Infiere por contexto.
- tags: array de tags relevantes del catálogo: ["vegano", "vegetariano", "sin gluten", "sin lactosa", "picante", "popular", "nuevo", "especialidad", "para compartir"]. Solo incluye los que apliquen.
- ingredients: array OPCIONAL de { name, qty, unit } cuando la carta menciona explícitamente el gramaje o los ingredientes con cantidad. Ejemplo: si la carta dice "Lomo vetado 250g con papas rústicas 150g", devuelve:
  ingredients: [{"name": "Lomo vetado", "qty": 250, "unit": "g"}, {"name": "Papas rústicas", "qty": 150, "unit": "g"}].
  Unidades válidas: kg, g, l, ml, unidad, porcion, caja.
  Si la carta NO menciona cantidades por ingrediente, omite el campo.

REGLAS:
- Devuelve SOLO JSON válido (sin markdown, sin prefacio).
- Formato exacto: { "items": [ ... ] }
- Si un ítem no tiene precio claro, omítelo.
- Si ves sugerencias tipo "combos" o "menú del día", también inclúyelos.
- Usa nombres tal como aparecen en la carta (respetando tildes).
- Si es un PDF de varias páginas, procesa todas las páginas.`

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

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,
      messages: [{ role: 'user', content }],
    })

    const raw = response.content
      .filter(c => c.type === 'text')
      .map(c => (c as { text: string }).text)
      .join('\n')

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    type ExtractedIngredient = { name: string; qty: number; unit: string }
    type ExtractedItem = {
      name:         string
      description?: string
      price:        number
      category:     string
      tags?:        string[]
      ingredients?: ExtractedIngredient[]
    }
    let parsed: { items?: ExtractedItem[] }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Try to find a JSON object in the text
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (!match) {
        return NextResponse.json({ error: 'No se pudo analizar la carta', raw: cleaned.slice(0, 400) }, { status: 422 })
      }
      parsed = JSON.parse(match[0])
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

    return NextResponse.json({ ok: true, items, count: items.length })
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
