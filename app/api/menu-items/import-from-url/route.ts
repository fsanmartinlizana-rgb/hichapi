import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { chatCompletion, extractJson, AiUnavailableError } from '@/lib/ai/chat'
import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/menu-items/import-from-url
// Importa una carta completa desde una URL pública (queresto.com, MercadoLibre,
// Instagram, etc.) usando IA para parsear el HTML.
//
// Flujo:
//   1. Fetch HTML de la URL (server-side, evita CORS).
//   2. Extracto texto/markdown limpio.
//   3. AI (Claude/OpenAI/Gemini con fallback) → JSON estructurado.
//   4. Insert en menu_items + categorías.
//
// Auth: solo admin/owner del restaurant.
// ─────────────────────────────────────────────────────────────────────────────

const BodySchema = z.object({
  restaurant_id: z.string().uuid(),
  url:           z.string().url(),
  replace_all:   z.boolean().optional().default(false),  // si true, borra menu existente primero
})

interface ImportedItem {
  name:         string
  description?: string | null
  price:        number
  ingredients?: string[]
  tags?:        string[]
}

interface ImportedCategory {
  name:  string
  items: ImportedItem[]
}

interface ImportedMenu {
  restaurant_name?: string
  address?:         string | null
  phone?:           string | null
  categories:       ImportedCategory[]
}

const PARSE_PROMPT = `Eres un parser de cartas de restaurante. Recibís HTML/texto de una página web y extraés el menú completo en JSON.

Devolvé EXACTAMENTE este JSON (sin markdown, sin texto extra):
{
  "restaurant_name": "nombre del restaurante si aparece, o null",
  "address": "dirección si aparece, o null",
  "phone": "teléfono si aparece, o null",
  "categories": [
    {
      "name": "Categoría tal cual",
      "items": [
        {
          "name": "Nombre del plato",
          "description": "Descripción si la hay, sino null",
          "price": 12000,
          "ingredients": ["ingrediente1", "ingrediente2"],
          "tags": []
        }
      ]
    }
  ]
}

REGLAS:
- Precios: SIEMPRE en CLP (pesos chilenos). "$12.000" → 12000. "$12,5k" → 12500. Si está en USD/otra moneda, convertí aproximado a CLP.
- Si el precio no está claro, omití el item entero.
- Ingredients: extraé del nombre/descripción si son obvios (ej: "Hamburguesa con queso y bacon" → ["queso","bacon"]). Si no aparecen explícitos, dejá array vacío [].
- Tags: usá ["sin gluten","vegano","vegetariano","picante"] solo si están explícitos en el texto.
- Categorías: respetá el orden de la web. Si todo viene mezclado, agrupá por sentido común (entradas, principales, postres, bebidas).
- IMPORTANTE: NO inventes platos ni precios. Solo lo que está en el texto.`

export async function POST(req: NextRequest) {
  try {
    const data = BodySchema.parse(await req.json())

    // Auth
    const { error: authErr } = await requireRestaurantRole(
      data.restaurant_id,
      ['owner', 'admin', 'super_admin'],
    )
    if (authErr) return authErr

    // 1. Fetch HTML
    let pageText = ''
    try {
      const res = await fetch(data.url, {
        headers: {
          'User-Agent': 'HiChapi-MenuImporter/1.0 (+https://hichapi.com)',
          'Accept':     'text/html,application/xhtml+xml',
        },
        // 30s timeout via AbortController
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) {
        return NextResponse.json(
          { error: `No pudimos cargar la URL (HTTP ${res.status}). Verificá que sea pública.` },
          { status: 400 },
        )
      }
      const html = await res.text()
      // Strip HTML tags y compactar para que AI procese mejor
      pageText = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 30_000) // cap input length
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json(
        { error: `No pudimos descargar la URL: ${msg}` },
        { status: 400 },
      )
    }

    if (pageText.length < 100) {
      return NextResponse.json(
        { error: 'La página no tiene contenido suficiente para extraer un menú.' },
        { status: 400 },
      )
    }

    // 2. AI parse con fallback
    let parsed: ImportedMenu | null = null
    try {
      const result = await chatCompletion({
        system:   PARSE_PROMPT,
        messages: [{ role: 'user', content: `URL: ${data.url}\n\nContenido:\n${pageText}` }],
        maxTokens: 8000,
        temperature: 0.1,
        jsonMode: true,
      })
      parsed = extractJson<ImportedMenu>(result.text)
      if (!parsed) {
        return NextResponse.json(
          { error: 'La IA no devolvió un JSON válido. Reintentá o subí los platos manualmente.' },
          { status: 500 },
        )
      }
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        return NextResponse.json(
          {
            error: 'Todos los proveedores de IA están fuera de servicio. Reintentá en unos minutos.',
            attempts: err.attempts,
          },
          { status: 503 },
        )
      }
      throw err
    }

    if (!parsed.categories || parsed.categories.length === 0) {
      return NextResponse.json(
        { error: 'No pudimos detectar ninguna categoría/plato en esa página.' },
        { status: 400 },
      )
    }

    const supabase = createAdminClient()

    // 3. Si replace_all: borrar menu existente
    if (data.replace_all) {
      await supabase
        .from('menu_items')
        .delete()
        .eq('restaurant_id', data.restaurant_id)
    }

    // 4. Insert items
    const rowsToInsert: Array<Record<string, unknown>> = []
    for (const cat of parsed.categories) {
      for (const item of cat.items ?? []) {
        if (!item.name || !item.price || item.price <= 0) continue
        rowsToInsert.push({
          restaurant_id: data.restaurant_id,
          name:          item.name.trim().slice(0, 200),
          description:   item.description ?? null,
          price:         Math.round(item.price),
          category:      cat.name.toLowerCase().trim().slice(0, 100),
          tags:          Array.isArray(item.tags) ? item.tags.slice(0, 10) : [],
          available:     true,
          ingredients:   Array.isArray(item.ingredients) ? item.ingredients.slice(0, 30) : [],
          destination:   inferDestination(cat.name),
        })
      }
    }

    if (rowsToInsert.length === 0) {
      return NextResponse.json(
        { error: 'Detectamos categorías pero ningún plato con precio válido.' },
        { status: 400 },
      )
    }

    // Insert in chunks of 50 to avoid hitting limits
    let inserted = 0
    for (let i = 0; i < rowsToInsert.length; i += 50) {
      const chunk = rowsToInsert.slice(i, i + 50)
      const { error: insErr } = await supabase.from('menu_items').insert(chunk)
      if (insErr) {
        // Fallback sin ingredients/destination si falla
        const fallbackChunk = chunk.map(r => {
          const { ingredients: _ing, destination: _dest, ...rest } = r
          void _ing; void _dest
          return rest
        })
        const { error: fbErr } = await supabase.from('menu_items').insert(fallbackChunk)
        if (fbErr) {
          return NextResponse.json(
            {
              error: `Error insertando items (chunk ${i / 50 + 1}): ${fbErr.message}`,
              inserted_so_far: inserted,
            },
            { status: 500 },
          )
        }
        inserted += fallbackChunk.length
      } else {
        inserted += chunk.length
      }
    }

    return NextResponse.json({
      ok:                true,
      inserted,
      categories:        parsed.categories.length,
      detected_name:     parsed.restaurant_name ?? null,
      detected_address:  parsed.address ?? null,
      detected_phone:    parsed.phone ?? null,
      replaced_existing: data.replace_all,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', issues: err.issues }, { status: 400 })
    }
    console.error('import-from-url error:', err)
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: `Error interno: ${msg}` }, { status: 500 })
  }
}

// Infiere destination (cocina/barra/sin_prep) desde la categoría
function inferDestination(categoryName: string): 'cocina' | 'barra' | 'sin_prep' {
  const lc = categoryName.toLowerCase()
  if (/bebid|trag|cocktail|cerveza|vino|whisk|gin|pisco|cafe|caf[eé]|t[eé]\b|jugo|agua|infus|gaseo|barra/.test(lc)) {
    return 'barra'
  }
  if (/postre|helado|torta|cheesecake|pastel|brownie/.test(lc)) {
    return 'cocina'
  }
  return 'cocina'
}
