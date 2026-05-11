/**
 * Placeholders por cuisine. Cuando un restaurant no tiene `photo_url`, el
 * frontend cae a estos.
 *
 * Estrategia:
 *   1. Si hay una imagen en el bucket `cuisine-placeholders` (subida por el
 *      founder), la URL pública del bucket sirve la imagen.
 *   2. Si la URL devuelve 404 (no se subió todavía), el componente
 *      <CuisinePlaceholder> renderiza un gradient + emoji estilizado.
 *
 * Por qué un bucket y no /public: cambiar/agregar placeholders sin redeploy,
 * sin bloat del repo, sirve CDN de Supabase.
 *
 * Naming: el nombre del archivo es `{cuisine_canonical}.jpg`.
 * Ej: italiana.jpg, japonesa.jpg, internacional.jpg (fallback final).
 */

/** Slugs canónicos soportados — coinciden con CUISINE_RESTAURANT_KEYWORDS
 *  en lib/discovery.ts. Si agregas una cuisine acá, también agregala allá. */
export const CUISINE_PLACEHOLDER_SLUGS = [
  'hamburgueseria', 'japonesa', 'italiana', 'peruana', 'mexicana', 'chilena',
  'vegana', 'vegetariana', 'tailandesa', 'parrilla', 'mariscos', 'cafeteria',
  'panaderia', 'heladeria', 'india', 'china', 'coreana', 'vietnamita', 'arabe',
  'americana', 'argentina', 'venezolana', 'colombiana', 'caribena', 'fusion',
  'mediterranea', 'griega', 'espanola', 'francesa', 'asiatica', 'sandwicheria',
  'cerveceria', 'saludable', 'internacional',
] as const

export type PlaceholderSlug = typeof CUISINE_PLACEHOLDER_SLUGS[number]

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Mapea cualquier cuisine_type a un slug canónico de placeholder. */
export function placeholderSlugFor(cuisine: string | null | undefined): PlaceholderSlug {
  if (!cuisine) return 'internacional'
  const norm = stripAccents(cuisine)
  if ((CUISINE_PLACEHOLDER_SLUGS as readonly string[]).includes(norm)) {
    return norm as PlaceholderSlug
  }
  return 'internacional'
}

/** URL pública del placeholder en Supabase Storage. Si el archivo no existe
 *  en el bucket, Next/Image / <img> dispara onError y el frontend renderiza
 *  <CuisinePlaceholder>. */
export function getCuisinePlaceholderUrl(cuisine: string | null | undefined): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? ''
  const slug = placeholderSlugFor(cuisine)
  return `${base}/storage/v1/object/public/cuisine-placeholders/${slug}.jpg`
}

/** Emoji representativo por cuisine. Usado por el componente CSS fallback. */
const CUISINE_EMOJI: Record<PlaceholderSlug, string> = {
  hamburgueseria:  '🍔',
  japonesa:        '🍣',
  italiana:        '🍝',
  peruana:         '🥘',
  mexicana:        '🌮',
  chilena:         '🇨🇱',
  vegana:          '🥗',
  vegetariana:     '🥗',
  tailandesa:      '🍜',
  parrilla:        '🥩',
  mariscos:        '🦐',
  cafeteria:       '☕',
  panaderia:       '🥐',
  heladeria:       '🍦',
  india:           '🍛',
  china:           '🥟',
  coreana:         '🍱',
  vietnamita:      '🍲',
  arabe:           '🥙',
  americana:       '🍔',
  argentina:       '🥩',
  venezolana:      '🫓',
  colombiana:      '🫓',
  caribena:        '🍤',
  fusion:          '🍽️',
  mediterranea:    '🥗',
  griega:          '🫒',
  espanola:        '🥘',
  francesa:        '🥖',
  asiatica:        '🍜',
  sandwicheria:    '🥪',
  cerveceria:      '🍺',
  saludable:       '🥗',
  internacional:   '🍽️',
}

export function getCuisineEmoji(cuisine: string | null | undefined): string {
  return CUISINE_EMOJI[placeholderSlugFor(cuisine)]
}

/** Gradient HSL determinístico por cuisine — colores cálidos para comida. */
const CUISINE_GRADIENT: Record<PlaceholderSlug, [string, string]> = {
  hamburgueseria:  ['#FFE4B5', '#FFB347'],
  japonesa:        ['#FFE4E1', '#FF6B6B'],
  italiana:        ['#FFEBC8', '#E94E1B'],
  peruana:         ['#FFE5CC', '#D2691E'],
  mexicana:        ['#FFEDD8', '#D35400'],
  chilena:         ['#FFE9E6', '#C0392B'],
  vegana:          ['#E8F5E9', '#66BB6A'],
  vegetariana:     ['#E8F5E9', '#66BB6A'],
  tailandesa:      ['#FFF3E0', '#FF8A65'],
  parrilla:        ['#FFE9DC', '#A0522D'],
  mariscos:        ['#E0F2F1', '#26A69A'],
  cafeteria:       ['#EFEBE9', '#8D6E63'],
  panaderia:       ['#FFF8E1', '#C19A6B'],
  heladeria:       ['#FCE4EC', '#F48FB1'],
  india:           ['#FFF3CD', '#E67E22'],
  china:           ['#FFEBEE', '#E53935'],
  coreana:         ['#FFEBE6', '#FF6F40'],
  vietnamita:      ['#FFF8E1', '#FBC02D'],
  arabe:           ['#FFF3E0', '#D4A574'],
  americana:       ['#FFEBEE', '#E53935'],
  argentina:       ['#FFE9DC', '#A0522D'],
  venezolana:      ['#FFE9C8', '#FFB347'],
  colombiana:      ['#FFE9C8', '#FFB347'],
  caribena:        ['#E0F7FA', '#00ACC1'],
  fusion:          ['#F3E5F5', '#AB47BC'],
  mediterranea:    ['#E8F5E9', '#7CB342'],
  griega:          ['#E3F2FD', '#1976D2'],
  espanola:        ['#FFE9DC', '#D35400'],
  francesa:        ['#F3E5F5', '#7B1FA2'],
  asiatica:        ['#FFEBEE', '#E91E63'],
  sandwicheria:    ['#FFF3E0', '#FF8A65'],
  cerveceria:      ['#FFF8E1', '#F9A825'],
  saludable:       ['#E8F5E9', '#66BB6A'],
  internacional:   ['#F5F5F5', '#9E9E9E'],
}

export function getCuisineGradient(cuisine: string | null | undefined): [string, string] {
  return CUISINE_GRADIENT[placeholderSlugFor(cuisine)]
}
