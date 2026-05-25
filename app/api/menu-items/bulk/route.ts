import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ── POST /api/menu-items/bulk ───────────────────────────────────────────────
//
// Inserta múltiples menu_items en una sola llamada.
// Usado por el flujo de "Importar carta" (foto / Excel / PDF).

const ItemSchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(300).nullish(),
  price:       z.number().int().min(0),
  category:    z.string().max(60).default('principal'),
  tags:        z.array(z.string()).default([]),
  available:   z.boolean().default(true),
  photo_url:   z.string().url().nullish(),
  rawRecipe:   z.string().optional(),
})

const BodySchema = z.object({
  restaurant_id: z.string().uuid(),
  items:         z.array(ItemSchema).min(1).max(100),
})

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr
  try {
    const { restaurant_id, items } = BodySchema.parse(await req.json())

    const supabase = createAdminClient()

    // ── 1. Fetch existing stock items ──────────────────────────────────────────
    const { data: existingStock, error: stockErr } = await supabase
      .from('stock_items')
      .select('id, name')
      .eq('restaurant_id', restaurant_id)

    if (stockErr) throw new Error('Error fetching stock items')

    const stockMap = new Map<string, string>()
    for (const s of existingStock || []) {
      stockMap.set(s.name.trim().toLowerCase(), s.id)
    }

    // ── 2. Collect and parse ingredients ───────────────────────────────────────
    // format: Lomo vetado (kg): 0.2, Papas: 0.1
    const missingIngredients = new Map<string, string>()

    const parsedItems = items.map(i => {
      const ingredients: { name: string; qty: number; id?: string }[] = []
      if (i.rawRecipe && i.rawRecipe.trim().length > 0) {
        const parts = i.rawRecipe.split(/[,|]/)
        for (const p of parts) {
          if (!p.includes(':')) continue
          const [nRaw, qRaw] = p.split(':')
          let n = nRaw.trim()
          let unit = 'unidad'

          // Extract optional unit e.g. "Carne (kg)" or "Papas [g]"
          const unitMatch = n.match(/[\(\[]([a-zA-Z]+)[\)\]]$/)
          if (unitMatch) {
            const parsedUnit = unitMatch[1].toLowerCase()
            const validUnits = ['kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja']
            if (validUnits.includes(parsedUnit)) {
              unit = parsedUnit
            }
            n = n.replace(/[\(\[][a-zA-Z]+[\)\]]$/, '').trim()
          }

          const normalizedQ = qRaw.trim().replace(',', '.')
          const q = parseFloat(normalizedQ)
          if (n && !isNaN(q) && q > 0) {
            ingredients.push({ name: n, qty: q })
            if (!stockMap.has(n.toLowerCase())) {
              missingIngredients.set(n, unit)
            }
          }
        }
      }
      return { ...i, _parsedIngredients: ingredients }
    })

    // ── 3. Create missing stock items ──────────────────────────────────────────
    if (missingIngredients.size > 0) {
      const newStockRows = Array.from(missingIngredients.entries()).map(([name, unit]) => ({
        restaurant_id,
        name,
        unit,
        current_qty: 0,
        min_qty: 0,
        cost_per_unit: 0,
      }))
      const { data: insertedStock, error: insertStockErr } = await supabase
        .from('stock_items')
        .insert(newStockRows)
        .select('id, name')

      if (insertStockErr) throw new Error('Error creating missing stock items')
      for (const s of insertedStock || []) {
        stockMap.set(s.name.trim().toLowerCase(), s.id)
      }
    }

    // ── 4. Build final rows ────────────────────────────────────────────────────

    const rows = parsedItems.map(i => {
      const finalIngredients = i._parsedIngredients
        .map(ing => ({ stock_item_id: stockMap.get(ing.name.toLowerCase()), qty: ing.qty }))
        .filter(ing => ing.stock_item_id) // ensure no undefined

      return {
        restaurant_id,
        name:        i.name,
        description: i.description || null,
        price:       i.price,
        category:    i.category,
        tags:        i.tags,
        available:   i.available,
        photo_url:   i.photo_url || null,
        ingredients: finalIngredients,
      }
    })

    const { data, error } = await supabase
      .from('menu_items')
      .insert(rows)
      .select()

    if (error) {
      console.error('bulk insert error:', error)
      return NextResponse.json({ error: 'No se pudieron crear los platos' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, items: data ?? [], count: (data ?? []).length })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    console.error('bulk error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
