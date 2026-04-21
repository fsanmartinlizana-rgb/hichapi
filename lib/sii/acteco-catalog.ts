// ══════════════════════════════════════════════════════════════════════════════
// Catálogo de códigos ACTECO para restaurantes y servicios de comida
// Basado en la clasificación CIIU Rev.4 adaptada por el SII de Chile
// ══════════════════════════════════════════════════════════════════════════════

export interface ActecoCode {
  code: string
  description: string
  category: 'restaurant' | 'food_service' | 'retail' | 'other'
}

export const ACTECO_CATALOG: ActecoCode[] = [
  // ── Restaurantes ──────────────────────────────────────────────────────────
  { code: '561010', description: 'Actividades de restaurantes y de servicio móvil de comidas',       category: 'restaurant'   },
  { code: '561011', description: 'Restaurantes de servicio completo',                                 category: 'restaurant'   },
  { code: '561012', description: 'Restaurantes de servicio limitado',                                 category: 'restaurant'   },
  { code: '561013', description: 'Cafeterías',                                                        category: 'restaurant'   },
  { code: '563000', description: 'Actividades de servicio de bebidas',                                category: 'restaurant'   },
  { code: '563001', description: 'Bares y cantinas',                                                  category: 'restaurant'   },
  { code: '563002', description: 'Discotecas y clubes nocturnos',                                     category: 'restaurant'   },
  { code: '563003', description: 'Otros establecimientos de bebidas',                                 category: 'restaurant'   },

  // ── Servicios de comida y catering ────────────────────────────────────────
  { code: '561020', description: 'Suministro de comidas por encargo',                                 category: 'food_service' },
  { code: '561021', description: 'Servicios de catering para eventos',                                category: 'food_service' },
  { code: '561022', description: 'Servicios de catering industrial',                                  category: 'food_service' },
  { code: '561030', description: 'Otras actividades de servicio de comidas',                          category: 'food_service' },
  { code: '561031', description: 'Servicios de comida rápida',                                        category: 'food_service' },
  { code: '561032', description: 'Puestos de comida móviles',                                         category: 'food_service' },
  { code: '463020', description: 'Venta al por menor de comidas preparadas en puestos de venta móviles', category: 'food_service' },
  { code: '108100', description: 'Elaboración de productos de panadería',                             category: 'food_service' },
  { code: '108200', description: 'Elaboración de cacao, chocolate y productos de confitería',         category: 'food_service' },
  { code: '105000', description: 'Elaboración de productos lácteos',                                  category: 'food_service' },
  { code: '107100', description: 'Elaboración de productos de molinería',                             category: 'food_service' },

  // ── Retail alimentario ────────────────────────────────────────────────────
  { code: '471120', description: 'Venta al por menor en tiendas no especializadas con predominio de alimentos, bebidas o tabaco', category: 'retail' },
  { code: '472100', description: 'Venta al por menor de alimentos en tiendas especializadas',         category: 'retail'       },
  { code: '472200', description: 'Venta al por menor de bebidas en tiendas especializadas',           category: 'retail'       },

  // ── Otros ─────────────────────────────────────────────────────────────────
  { code: '492100', description: 'Transporte de pasajeros urbano y suburbano por vía terrestre',      category: 'other'        },
  { code: '829900', description: 'Otras actividades de servicios de apoyo a las empresas n.c.p.',     category: 'other'        },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

export function searchActecoByCode(code: string): ActecoCode | undefined {
  return ACTECO_CATALOG.find(item => item.code === code)
}

export function searchActecoByDescription(query: string): ActecoCode[] {
  const q = query.toLowerCase().trim()
  return ACTECO_CATALOG.filter(item =>
    item.description.toLowerCase().includes(q) || item.code.includes(q),
  )
}

export function getActecoByCategory(category: ActecoCode['category']): ActecoCode[] {
  return ACTECO_CATALOG.filter(item => item.category === category)
}

export function getRestaurantActecos(): ActecoCode[] {
  return ACTECO_CATALOG.filter(item =>
    item.category === 'restaurant' || item.category === 'food_service',
  )
}

export const DEFAULT_RESTAURANT_ACTECO = '561010'
