import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Ingredient = {
  stock_item_id: string
  qty: number
}

// GET /api/stock/recipes?menu_item_id=xxx — obtiene receta de una preparación con costo estimado
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const menu_item_id = req.nextUrl.searchParams.get('menu_item_id')
  if (!menu_item_id) {
    return NextResponse.json({ error: 'menu_item_id requerido' }, { status: 400 })
  }

  // Fetch the menu item
  const { data: menuItem, error: menuErr } = await supabase
    .from('menu_items')
    .select('id, name, ingredients')
    .eq('id', menu_item_id)
    .single()

  if (menuErr || !menuItem) {
    return NextResponse.json({ error: 'Preparación no encontrada' }, { status: 404 })
  }

  const rawIngredients: Ingredient[] = Array.isArray(menuItem.ingredients)
    ? menuItem.ingredients
    : []

  if (rawIngredients.length === 0) {
    return NextResponse.json({ menu_item_id, ingredients: [], costo_estimado: 0 })
  }

  // Fetch all referenced stock items in one query
  const stockItemIds = rawIngredients.map((i) => i.stock_item_id)
  const { data: stockItems, error: stockErr } = await supabase
    .from('stock_items')
    .select('id, name, unit, cost_per_unit')
    .in('id', stockItemIds)

  if (stockErr) {
    return NextResponse.json({ error: stockErr.message }, { status: 400 })
  }

  const stockMap = new Map((stockItems ?? []).map((s) => [s.id, s]))

  let costo_estimado = 0
  const ingredients = rawIngredients.map((ing) => {
    const stock_item = stockMap.get(ing.stock_item_id) ?? null
    if (stock_item) {
      costo_estimado += ing.qty * stock_item.cost_per_unit
    }
    return { stock_item_id: ing.stock_item_id, qty: ing.qty, stock_item }
  })

  return NextResponse.json({ menu_item_id, ingredients, costo_estimado })
}

const putSchema = z.object({
  menu_item_id: z.string().uuid(),
  restaurant_id: z.string().uuid(),
  ingredients: z.array(
    z.object({
      stock_item_id: z.string().uuid(),
      qty: z.number().positive(),
    }),
  ).min(1),
})

// PUT /api/stock/recipes — crea o reemplaza receta completa de una preparación
export async function PUT(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const body = await req.json()
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { menu_item_id, restaurant_id, ingredients } = parsed.data

  // Validate each stock_item exists and is active for this restaurant
  for (const ing of ingredients) {
    const { data: stockItem, error: stockErr } = await supabase
      .from('stock_items')
      .select('id, active')
      .eq('id', ing.stock_item_id)
      .eq('restaurant_id', restaurant_id)
      .single()

    if (stockErr || !stockItem || !stockItem.active) {
      return NextResponse.json(
        { error: 'Producto no encontrado en inventario', missing_product_id: ing.stock_item_id },
        { status: 422 },
      )
    }
  }

  // Replace ingredients completely
  const { error: updateErr } = await supabase
    .from('menu_items')
    .update({ ingredients })
    .eq('id', menu_item_id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, menu_item_id, ingredients })
}

// DELETE /api/stock/recipes?menu_item_id=xxx — elimina receta (vacía ingredients) sin afectar movimientos históricos
export async function DELETE(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const menu_item_id = req.nextUrl.searchParams.get('menu_item_id')
  if (!menu_item_id) {
    return NextResponse.json({ error: 'menu_item_id requerido' }, { status: 400 })
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(menu_item_id)) {
    return NextResponse.json({ error: 'menu_item_id debe ser un UUID válido' }, { status: 400 })
  }

  const { error: updateErr } = await supabase
    .from('menu_items')
    .update({ ingredients: [] })
    .eq('id', menu_item_id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, menu_item_id })
}
