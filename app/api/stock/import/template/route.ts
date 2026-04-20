import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requireUser } from '@/lib/supabase/auth-guard'

export async function GET() {
  const { error: authErr } = await requireUser()
  if (authErr) return authErr

  const workbook = XLSX.utils.book_new()

  // Sheet "Productos"
  const productosData = [
    ['nombre', 'unidad', 'cantidad', 'cantidad_minima', 'costo_por_unidad', 'categoria', 'proveedor'],
    ['Lomo Liso', 'kg', 10, 2, 8500, 'Carnes', 'Proveedor A'],
    ['Pisco X', 'l', 5, 1, 12000, 'Bebidas', 'Proveedor B'],
    ['Bebida X', 'unidad', 24, 6, 800, 'Bebidas', 'Proveedor C'],
  ]
  const productosSheet = XLSX.utils.aoa_to_sheet(productosData)
  XLSX.utils.book_append_sheet(workbook, productosSheet, 'Productos')

  // Sheet "Recetas"
  const recetasData = [
    ['nombre_preparacion', 'nombre_producto', 'cantidad_por_porcion', 'unidad'],
    ['Lomo Saltado', 'Lomo Liso', 0.2, 'kg'],
    ['Piscola', 'Pisco X', 0.06, 'l'],
    ['Piscola', 'Bebida X', 1, 'unidad'],
  ]
  const recetasSheet = XLSX.utils.aoa_to_sheet(recetasData)
  XLSX.utils.book_append_sheet(workbook, recetasSheet, 'Recetas')

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-stock.xlsx"',
    },
  })
}
