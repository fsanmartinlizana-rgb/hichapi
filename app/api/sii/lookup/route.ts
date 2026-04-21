import { NextRequest, NextResponse } from 'next/server'
import {
  ACTECO_CATALOG,
  searchActecoByCode,
  searchActecoByDescription,
  getActecoByCategory,
} from '@/lib/sii/acteco-catalog'

// ══════════════════════════════════════════════════════════════════════════════
//  GET /api/sii/lookup
//  Parámetros:
//    type=acteco  (requerido)
//    code=561010  → busca un código específico
//    category=restaurant|food_service|retail|other → filtra por categoría
//    query=texto  → búsqueda por descripción o código
//  Sin parámetros extra → devuelve todos los códigos de restaurante + food_service
// ══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const type     = searchParams.get('type')
  const code     = searchParams.get('code')
  const category = searchParams.get('category')
  const query    = searchParams.get('query')

  if (!type || type !== 'acteco') {
    return NextResponse.json({ error: 'Tipo requerido: acteco' }, { status: 400 })
  }

  // Búsqueda por código específico
  if (code) {
    const result = searchActecoByCode(code)
    if (result) return NextResponse.json({ acteco: result })
    return NextResponse.json({ error: 'Código ACTECO no encontrado' }, { status: 404 })
  }

  // Filtro por categoría
  if (category) {
    const valid = ['restaurant', 'food_service', 'retail', 'other']
    if (!valid.includes(category)) {
      return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 })
    }
    const results = getActecoByCategory(category as 'restaurant' | 'food_service' | 'retail' | 'other')
    return NextResponse.json({ actecos: results })
  }

  // Búsqueda por texto
  if (query) {
    const results = searchActecoByDescription(query)
    return NextResponse.json({ actecos: results })
  }

  // Sin filtros → todos los códigos relevantes para restaurantes
  const defaults = ACTECO_CATALOG.filter(
    item => item.category === 'restaurant' || item.category === 'food_service',
  )
  return NextResponse.json({
    actecos: defaults,
    message: 'Códigos ACTECO recomendados para restaurantes',
  })
}
