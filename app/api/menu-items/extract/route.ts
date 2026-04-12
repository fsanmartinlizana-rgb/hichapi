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
  // Cada imagen en base64 (sin el prefijo "data:image/…;base64,")
  images: z.array(z.string().min(1)).min(1).max(6),
  mime: z.string().default('image/jpeg'),
})

const EXTRACTION_PROMPT = `Eres un asistente experto que analiza cartas de restaurantes.

Tu tarea: extraer todos los platos / bebidas de la imagen de la carta.

Para cada ítem devuelve:
- name: nombre del plato
- description: descripción corta (si existe en la carta). Si no hay, omite el campo.
- price: precio en pesos chilenos como número entero (sin $, sin puntos, sin comas). Ejemplo: 18000. Si la carta dice "18.000" o "$18.000", tú devuelves 18000.
- category: una de ["entrada", "principal", "postre", "bebida", "para compartir"]. Infiere por contexto.
- tags: array de tags relevantes del catálogo: ["vegano", "vegetariano", "sin gluten", "sin lactosa", "picante", "popular", "nuevo", "especialidad", "para compartir"]. Solo incluye los que apliquen.

REGLAS:
- Devuelve SOLO JSON válido (sin markdown, sin prefacio).
- Formato exacto: { "items": [ ... ] }
- Si un ítem no tiene precio claro, omítelo.
- Si ves sugerencias tipo "combos" o "menú del día", también inclúyelos.
- Usa nombres tal como aparecen en la carta (respetando tildes).`

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  try {
    const body = BodySchema.parse(await req.json())

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'IA no configurada' }, { status: 503 })
    }

    // Build content blocks — one image per block
    const content: Anthropic.ContentBlockParam[] = [
      { type: 'text', text: EXTRACTION_PROMPT },
      ...body.images.map((b64): Anthropic.ContentBlockParam => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: (body.mime === 'image/png' ? 'image/png'
                     : body.mime === 'image/webp' ? 'image/webp'
                     : 'image/jpeg') as 'image/png' | 'image/jpeg' | 'image/webp',
          data: b64,
        },
      })),
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

    let parsed: { items?: Array<{
      name: string
      description?: string
      price: number
      category: string
      tags?: string[]
    }> }
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
      }))

    return NextResponse.json({ ok: true, items, count: items.length })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('extract error:', err)
    return NextResponse.json({ error: 'Error al analizar la imagen' }, { status: 500 })
  }
}
