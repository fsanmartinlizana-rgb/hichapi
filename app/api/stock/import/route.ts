import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requireUser } from '@/lib/supabase/auth-guard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const VALID_EXTENSIONS = ['.xlsx', '.csv']
const VALID_UNITS = ['kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja', 'onza'] as const

type ImportError = {
  row: number
  field: string
  value: unknown
  reason: 'nombre_vacio' | 'cantidad_no_numerica' | 'unidad_no_reconocida' | 'producto_no_encontrado'
}

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

function parseProductosSheet(sheet: XLSX.WorkSheet): {
  productos: ProductoPreview[]
  errores: ImportError[]
} {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const productos: ProductoPreview[] = []
  const errores: ImportError[] = []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2 // 1-indexed, row 1 is header
    const nombre = String(row['nombre'] ?? '').trim()
    const unidad = String(row['unidad'] ?? '').trim().toLowerCase()
    const cantidadRaw = row['cantidad']
    const cantidad = Number(cantidadRaw)

    if (!nombre) {
      errores.push({ row: rowNum, field: 'nombre', value: row['nombre'], reason: 'nombre_vacio' })
      return
    }

    if (isNaN(cantidad) || cantidadRaw === '') {
      errores.push({ row: rowNum, field: 'cantidad', value: cantidadRaw, reason: 'cantidad_no_numerica' })
      return
    }

    if (!VALID_UNITS.includes(unidad as typeof VALID_UNITS[number])) {
      errores.push({ row: rowNum, field: 'unidad', value: row['unidad'], reason: 'unidad_no_reconocida' })
      return
    }

    productos.push({
      nombre,
      unidad,
      cantidad,
      cantidad_minima: Number(row['cantidad_minima'] ?? 0) || 0,
      costo_por_unidad: Number(row['costo_por_unidad'] ?? 0) || 0,
      categoria: String(row['categoria'] ?? '').trim(),
      proveedor: String(row['proveedor'] ?? '').trim(),
    })
  })

  return { productos, errores }
}

function parseRecetasSheet(sheet: XLSX.WorkSheet): {
  recetas: RecetaPreview[]
  errores: ImportError[]
} {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const recetas: RecetaPreview[] = []
  const errores: ImportError[] = []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2
    const nombre_preparacion = String(row['nombre_preparacion'] ?? '').trim()
    const nombre_producto = String(row['nombre_producto'] ?? '').trim()
    const cantidadRaw = row['cantidad_por_porcion']
    const cantidad_por_porcion = Number(cantidadRaw)

    if (!nombre_preparacion) {
      errores.push({ row: rowNum, field: 'nombre_preparacion', value: row['nombre_preparacion'], reason: 'nombre_vacio' })
      return
    }

    if (!nombre_producto) {
      errores.push({ row: rowNum, field: 'nombre_producto', value: row['nombre_producto'], reason: 'nombre_vacio' })
      return
    }

    if (isNaN(cantidad_por_porcion) || cantidadRaw === '') {
      errores.push({ row: rowNum, field: 'cantidad_por_porcion', value: cantidadRaw, reason: 'cantidad_no_numerica' })
      return
    }

    recetas.push({
      nombre_preparacion,
      nombre_producto,
      cantidad_por_porcion,
      unidad: String(row['unidad'] ?? '').trim(),
    })
  })

  return { recetas, errores }
}

// POST /api/stock/import — upload file and return preview
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const restaurant_id = formData.get('restaurant_id') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
  }

  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'El archivo supera el tamaño máximo de 10 MB' }, { status: 400 })
  }

  // Validate extension
  const fileName = file.name.toLowerCase()
  const hasValidExt = VALID_EXTENSIONS.some(ext => fileName.endsWith(ext))
  if (!hasValidExt) {
    return NextResponse.json({ error: 'Solo se aceptan archivos .xlsx o .csv' }, { status: 400 })
  }

  // Parse file
  const buffer = Buffer.from(await file.arrayBuffer())
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' })
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo' }, { status: 400 })
  }

  const sheetNames = workbook.SheetNames

  // Find Productos sheet (named "Productos" or first sheet)
  const productosSheetName = sheetNames.find(n => n.toLowerCase() === 'productos') ?? sheetNames[0]
  const productosSheet = workbook.Sheets[productosSheetName]

  // Find Recetas sheet (named "Recetas" or second sheet if exists)
  const recetasSheetName = sheetNames.find(n => n.toLowerCase() === 'recetas') ?? sheetNames[1]
  const recetasSheet = recetasSheetName ? workbook.Sheets[recetasSheetName] : null

  const { productos: productos_preview, errores: erroresProductos } = parseProductosSheet(productosSheet)

  let recetas_preview: RecetaPreview[] = []
  let erroresRecetas: ImportError[] = []
  if (recetasSheet) {
    const result = parseRecetasSheet(recetasSheet)
    recetas_preview = result.recetas
    erroresRecetas = result.errores
  }

  const errores: ImportError[] = [...erroresProductos, ...erroresRecetas]

  // Save import record with status = 'pending'
  const { data: importRecord, error: dbError } = await supabase
    .from('inventory_imports')
    .insert({
      restaurant_id,
      import_type: fileName.endsWith('.csv') ? 'csv' : 'excel',
      status: 'pending',
      raw_extraction: {
        productos_preview,
        recetas_preview,
        errores,
      },
      errors: errores.length > 0 ? errores : null,
      imported_items: productos_preview.length + recetas_preview.length,
    })
    .select('id')
    .single()

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({
    import_id: importRecord.id,
    productos_preview,
    recetas_preview,
    errores,
  })
}
