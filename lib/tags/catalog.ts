// ── HiChapi Tag Catalog ───────────────────────────────────────────────────────
//
// Catálogo centralizado de tags para restaurantes y platos.
// Organizado por categorías estilo Airbnb amenities, para que los LLMs
// (ChatGPT, Perplexity, etc.) puedan indexar y recomendar restaurantes con
// información rica y estructurada.
//
// Uso:
//   - Restaurante (landing pública): usa RESTAURANT_TAG_GROUPS
//   - Plato (carta): usa MENU_ITEM_TAG_GROUPS
//
// Cada tag incluye un `value` (slug que se guarda en DB), `label` (nombre
// amigable) y opcionalmente `icon` (emoji) y `description` (hint al usuario).

export interface TagOption {
  value: string
  label: string
  icon?: string
  description?: string
}

export interface TagGroup {
  key: string
  label: string
  description?: string
  options: TagOption[]
}

// ── Restaurant tags (airbnb-style amenities) ─────────────────────────────────

export const RESTAURANT_TAG_GROUPS: TagGroup[] = [
  {
    key: 'ambiente',
    label: 'Ambiente',
    description: 'Cómo se siente el lugar',
    options: [
      { value: 'acogedor',       label: 'Acogedor',        icon: '🛋️' },
      { value: 'romantico',      label: 'Romántico',       icon: '🌹' },
      { value: 'familiar',       label: 'Familiar',        icon: '👨‍👩‍👧' },
      { value: 'casual',         label: 'Casual',          icon: '👕' },
      { value: 'elegante',       label: 'Elegante',        icon: '🎩' },
      { value: 'trendy',         label: 'Trendy',          icon: '✨' },
      { value: 'bohemio',        label: 'Bohemio',         icon: '🎨' },
      { value: 'rustico',        label: 'Rústico',         icon: '🪵' },
      { value: 'moderno',        label: 'Moderno',         icon: '🏙️' },
      { value: 'tranquilo',      label: 'Tranquilo',       icon: '🌿' },
      { value: 'animado',        label: 'Animado',         icon: '🎉' },
      { value: 'vista-panoramica', label: 'Vista panorámica', icon: '🏞️' },
    ],
  },
  {
    key: 'servicios',
    label: 'Servicios',
    description: 'Lo que ofrece el restaurante',
    options: [
      { value: 'wifi',            label: 'WiFi gratis',        icon: '📶' },
      { value: 'estacionamiento', label: 'Estacionamiento',    icon: '🅿️' },
      { value: 'valet-parking',   label: 'Valet parking',      icon: '🚗' },
      { value: 'delivery',        label: 'Delivery propio',    icon: '🛵' },
      { value: 'para-llevar',     label: 'Para llevar',        icon: '🥡' },
      { value: 'reservas',        label: 'Acepta reservas',    icon: '📅' },
      { value: 'walk-in',         label: 'Walk-in friendly',   icon: '🚶' },
      { value: 'eventos-privados', label: 'Eventos privados',  icon: '🎊' },
      { value: 'catering',        label: 'Catering',           icon: '🍽️' },
      { value: 'bar-completo',    label: 'Bar completo',       icon: '🍹' },
      { value: 'cava-vinos',      label: 'Cava de vinos',      icon: '🍷' },
      { value: 'coctelería-autor', label: 'Coctelería de autor', icon: '🍸' },
    ],
  },
  {
    key: 'espacios',
    label: 'Espacios',
    description: 'Zonas disponibles',
    options: [
      { value: 'terraza',       label: 'Terraza',           icon: '🌿' },
      { value: 'patio',         label: 'Patio',             icon: '🌳' },
      { value: 'rooftop',       label: 'Rooftop',           icon: '🏙️' },
      { value: 'jardin',        label: 'Jardín',            icon: '🌸' },
      { value: 'area-fumadores', label: 'Área fumadores',   icon: '🚬' },
      { value: 'barra',         label: 'Barra',             icon: '🍺' },
      { value: 'salon-privado', label: 'Salón privado',     icon: '🚪' },
      { value: 'exterior-cubierto', label: 'Exterior cubierto', icon: '☂️' },
      { value: 'chimenea',      label: 'Chimenea',          icon: '🔥' },
      { value: 'aire-libre',    label: 'Al aire libre',     icon: '☀️' },
    ],
  },
  {
    key: 'accesibilidad',
    label: 'Accesibilidad e inclusión',
    description: 'Para que todos sean bienvenidos',
    options: [
      { value: 'pet-friendly',   label: 'Pet friendly',       icon: '🐕', description: 'Se puede ingresar con mascotas' },
      { value: 'kids-friendly',  label: 'Kids friendly',      icon: '👶' },
      { value: 'accesible-silla-ruedas', label: 'Accesible silla de ruedas', icon: '♿' },
      { value: 'menu-kids',      label: 'Menú infantil',      icon: '🧒' },
      { value: 'sillas-bebe',    label: 'Sillas para bebé',   icon: '🍼' },
      { value: 'cambiador',      label: 'Cambiador',          icon: '👶' },
      { value: 'lgbtq-friendly', label: 'LGBTQ+ friendly',    icon: '🏳️‍🌈' },
      { value: 'menu-braille',   label: 'Menú en braille',    icon: '⠿' },
      { value: 'ingles',         label: 'Staff habla inglés', icon: '🇬🇧' },
    ],
  },
  {
    key: 'horarios',
    label: 'Horarios y momentos',
    description: 'Cuándo visitar',
    options: [
      { value: 'abierto-tarde',   label: 'Abierto hasta tarde', icon: '🌙' },
      { value: 'abre-temprano',   label: 'Abre temprano',       icon: '🌅' },
      { value: 'desayuno',        label: 'Desayuno',            icon: '🥐' },
      { value: 'brunch',          label: 'Brunch',              icon: '🥓' },
      { value: 'almuerzo',        label: 'Almuerzo',            icon: '🍝' },
      { value: 'once',            label: 'Once',                icon: '🫖' },
      { value: 'cena',            label: 'Cena',                icon: '🕯️' },
      { value: 'after-office',    label: 'After office',        icon: '🍻' },
      { value: 'abierto-lunes',   label: 'Abre lunes',          icon: '📅' },
      { value: 'abierto-domingo', label: 'Abre domingo',        icon: '📅' },
    ],
  },
  {
    key: 'especialidades',
    label: 'Especialidades de cocina',
    description: 'Lo que te distingue',
    options: [
      { value: 'parrilla',        label: 'Parrilla',           icon: '🔥' },
      { value: 'mariscos',        label: 'Mariscos',           icon: '🦐' },
      { value: 'pescados',        label: 'Pescados',           icon: '🐟' },
      { value: 'sushi',           label: 'Sushi',              icon: '🍣' },
      { value: 'pizza-horno-barro', label: 'Pizza horno de barro', icon: '🍕' },
      { value: 'pastas-caseras',  label: 'Pastas caseras',     icon: '🍝' },
      { value: 'cafe-especialidad', label: 'Café de especialidad', icon: '☕' },
      { value: 'panaderia-propia', label: 'Panadería propia',  icon: '🥖' },
      { value: 'carnes-premium',  label: 'Carnes premium',     icon: '🥩' },
      { value: 'fusion',          label: 'Fusión',             icon: '🌍' },
      { value: 'comida-callejera', label: 'Comida callejera',  icon: '🌮' },
      { value: 'autor',           label: 'Cocina de autor',    icon: '⭐' },
    ],
  },
  {
    key: 'dietetico',
    label: 'Opciones dietéticas',
    description: 'Para restricciones alimenticias',
    options: [
      { value: 'opciones-veganas',       label: 'Opciones veganas',       icon: '🌱' },
      { value: 'opciones-vegetarianas',  label: 'Opciones vegetarianas',  icon: '🥗' },
      { value: 'opciones-sin-gluten',    label: 'Opciones sin gluten',    icon: '🌾' },
      { value: 'opciones-sin-lactosa',   label: 'Opciones sin lactosa',   icon: '🥛' },
      { value: 'opciones-keto',          label: 'Opciones keto',          icon: '🥑' },
      { value: 'opciones-kosher',        label: 'Kosher',                 icon: '✡️' },
      { value: 'opciones-halal',         label: 'Halal',                  icon: '☪️' },
      { value: 'organico',               label: 'Orgánico',               icon: '🌿' },
      { value: 'km-cero',                label: 'Km cero',                icon: '📍' },
    ],
  },
  {
    key: 'pago',
    label: 'Medios de pago',
    description: 'Cómo se puede pagar',
    options: [
      { value: 'efectivo',        label: 'Efectivo',            icon: '💵' },
      { value: 'tarjetas',        label: 'Tarjetas',            icon: '💳' },
      { value: 'transferencia',   label: 'Transferencia',       icon: '🏦' },
      { value: 'mercadopago',     label: 'MercadoPago',         icon: '📱' },
      { value: 'contactless',     label: 'Pago contactless',    icon: '📶' },
      { value: 'cuenta-corriente', label: 'Cuenta corriente',   icon: '🧾' },
      { value: 'dividir-cuenta',  label: 'Dividir la cuenta',   icon: '➗' },
    ],
  },
]

// ── Menu item tags (categorized) ─────────────────────────────────────────────

export const MENU_ITEM_TAG_GROUPS: TagGroup[] = [
  {
    key: 'dietetico',
    label: 'Dietético',
    description: 'Restricciones y preferencias',
    options: [
      { value: 'vegano',         label: 'Vegano',        icon: '🌱' },
      { value: 'vegetariano',    label: 'Vegetariano',   icon: '🥗' },
      { value: 'sin gluten',     label: 'Sin gluten',    icon: '🌾' },
      { value: 'sin lactosa',    label: 'Sin lactosa',   icon: '🥛' },
      { value: 'sin frutos secos', label: 'Sin frutos secos', icon: '🥜' },
      { value: 'keto',           label: 'Keto',          icon: '🥑' },
      { value: 'bajo en calorias', label: 'Bajo calorías', icon: '⚖️' },
      { value: 'alto en proteinas', label: 'Alto proteínas', icon: '💪' },
    ],
  },
  {
    key: 'sabor',
    label: 'Sabor',
    description: 'Perfil de sabor',
    options: [
      { value: 'picante',        label: 'Picante',       icon: '🌶️' },
      { value: 'muy picante',    label: 'Muy picante',   icon: '🔥' },
      { value: 'dulce',          label: 'Dulce',         icon: '🍭' },
      { value: 'acido',          label: 'Ácido',         icon: '🍋' },
      { value: 'umami',          label: 'Umami',         icon: '🍄' },
      { value: 'ahumado',        label: 'Ahumado',       icon: '💨' },
    ],
  },
  {
    key: 'destacado',
    label: 'Destacado',
    description: 'Para recomendar a clientes',
    options: [
      { value: 'popular',        label: 'Popular',       icon: '⭐' },
      { value: 'nuevo',          label: 'Nuevo',         icon: '🆕' },
      { value: 'especialidad',   label: 'Especialidad de la casa', icon: '👨‍🍳' },
      { value: 'para compartir', label: 'Para compartir', icon: '🤝' },
      { value: 'promovido',      label: 'Promovido hoy', icon: '📣' },
      { value: 'temporada',      label: 'De temporada',  icon: '🍂' },
    ],
  },
  {
    key: 'preparacion',
    label: 'Preparación',
    description: 'Cómo se hace',
    options: [
      { value: 'parrilla',       label: 'A la parrilla', icon: '🔥' },
      { value: 'horno',          label: 'Al horno',      icon: '🔥' },
      { value: 'frito',          label: 'Frito',         icon: '🍟' },
      { value: 'al vapor',       label: 'Al vapor',      icon: '♨️' },
      { value: 'crudo',          label: 'Crudo',         icon: '🍣' },
      { value: 'marinado',       label: 'Marinado',      icon: '🧂' },
      { value: 'casero',         label: 'Casero',        icon: '🏠' },
    ],
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

export function flattenTags(groups: TagGroup[]): TagOption[] {
  return groups.flatMap(g => g.options)
}

export function findTag(groups: TagGroup[], value: string): TagOption | undefined {
  for (const g of groups) {
    const m = g.options.find(o => o.value === value)
    if (m) return m
  }
  return undefined
}

export const ALL_RESTAURANT_TAGS = flattenTags(RESTAURANT_TAG_GROUPS)
export const ALL_MENU_ITEM_TAGS  = flattenTags(MENU_ITEM_TAG_GROUPS)
