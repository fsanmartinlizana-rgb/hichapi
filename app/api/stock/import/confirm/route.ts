import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type ProductoPreview = {
  nombre: string
  unidad: string
  cantidad: number
  cantidad_minima: number
  costo_por_unidad: number
  categoria: string
  proveedor: string
}

type RecetaPreview = {
  nombre_preparacion: string
  nombre_producto: string
  cantidad_por_porcion: number
  unidad: string
}

type ConfirmError = {
  tipo: 'receta'
  nombre_preparacion: string
  nombre_producto: string
  razon: string
}

// POST /api/stock/import/confirm — confirm a pending import
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  let body: { import_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const { import_id } = body
  if (!import_id) {
    return NextResponse.json({ error: 'import_id requerido' }, { status: 400 })
  }

  // Fetch the import record
  const { data: importRecord, error: fetchErr } = await supabase
    .from('inventory_imports')
    .select('id, restaurant_id, raw_extraction, status')
    .eq('id', import_id)
    .single()

  if (fetchErr || !importRecord) {
    return NextResponse.json({ error: 'Importación no encontrada' }, { status: 404 })
  }

  const restaurant_id: string = importRecord.restaurant_id
  const raw = importRecord.raw_extraction as {
    productos_preview?: ProductoPreview[]
    recetas_preview?: RecetaPreview[]
  }

  const productos_preview: ProductoPreview[] = raw?.productos_preview ?? []
  const recetas_preview: RecetaPreview[] = raw?.recetas_preview ?? []

  let creados = 0
  let actualizados = 0
  let recetas_procesadas = 0
  const errores: ConfirmError[] = []

  // Process productos
  for (const producto of productos_preview) {
    const { data: existing } = await supabase
      .from('stock_items')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .ilike('name', producto.nombre)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('stock_items')
        .update({
          unit: producto.unidad,
          current_qty: producto.cantidad,
          min_qty: producto.cantidad_minima,
          cost_per_unit: producto.costo_por_unidad,
          category: producto.categoria || null,
          supplier: producto.proveedor || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      actualizados++
    } else {
      await supabase
        .from('stock_items')
        .insert({
          restaurant_id,
          name: producto.nombre,
          unit: producto.unidad,
          current_qty: producto.cantidad,
          min_qty: producto.cantidad_minima,
          cost_per_unit: producto.costo_por_unidad,
          category: producto.categoria || null,
          supplier: producto.proveedor || null,
          active: true,
        })
      creados++
    }
  }

  // Process recetas
  for (const receta of recetas_preview) {
    // Find menu_item by name
    const { data: menuItem } = await supabase
      .from('menu_items')
      .select('id, ingredients')
      .eq('restaurant_id', restaurant_id)
      .ilike('name', receta.nombre_preparacion)
      .maybeSingle()

    if (!menuItem) {
      errores.push({
        tipo: 'receta',
        nombre_preparacion: receta.nombre_preparacion,
        nombre_producto: receta.nombre_producto,
        razon: `Preparación "${receta.nombre_preparacion}" no encontrada en el menú`,
      })
      continue
    }

    // Find stock_item by name
    const { data: stockItem } = await supabase
      .from('stock_items')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .ilike('name', receta.nombre_producto)
      .maybeSingle()

    if (!stockItem) {
      errores.push({
        tipo: 'receta',
        nombre_preparacion: receta.nombre_preparacion,
        nombre_producto: receta.nombre_producto,
        razon: `Producto "${receta.nombre_producto}" no encontrado en el inventario`,
      })
      continue
    }

    // Upsert ingredient into menu_items.ingredients JSONB array
    const currentIngredients: { stock_item_id: string; qty: number }[] =
      Array.isArray(menuItem.ingredients) ? menuItem.ingredients : []

    const existingIdx = currentIngredients.findIndex(
      (ing) => ing.stock_item_id === stockItem.id,
    )

    if (existingIdx >= 0) {
      currentIngredients[existingIdx] = {
        stock_item_id: stockItem.id,
        qty: receta.cantidad_por_porcion,
      }
    } else {
      currentIngredients.push({
        stock_item_id: stockItem.id,
        qty: receta.cantidad_por_porcion,
      })
    }

    await supabase
      .from('menu_items')
      .update({ ingredients: currentIngredients })
      .eq('id', menuItem.id)

    recetas_procesadas++
  }

  // Update import record to completed
  await supabase
    .from('inventory_imports')
    .update({
      status: 'completed',
      raw_extraction: {
        ...raw,
        summary: { creados, actualizados, recetas_procesadas, errores },
      },
    })
    .eq('id', import_id)

  return NextResponse.json({ creados, actualizados, recetas_procesadas, errores })
}
