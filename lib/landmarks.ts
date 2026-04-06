/**
 * Resuelve nombres de metro, calles y landmarks de Santiago al barrio canónico
 * que usamos en la base de datos. Evita llamadas fallidas a Supabase cuando
 * el usuario escribe "metro moneda" o "plaza italia" en vez del barrio.
 *
 * Orden de evaluación: exact match → partial match → original value.
 */

const LANDMARK_MAP: Record<string, string> = {
  // ── Línea 1 (Alameda / Providencia / Apoquindo) ───────────────────────────
  'la moneda':              'Santiago Centro',
  'metro moneda':           'Santiago Centro',
  'estacion moneda':        'Santiago Centro',
  'universidad de chile':   'Santiago Centro',
  'metro u de chile':       'Santiago Centro',
  'metro uch':              'Santiago Centro',
  'los heroes':             'Santiago Centro',
  'metro los heroes':       'Santiago Centro',
  'republica':              'Santiago Centro',
  'metro republica':        'Santiago Centro',
  'union latinoamericana':  'Santiago Centro',
  'estacion central':       'Santiago Centro',
  'universidad de santiago':'Santiago Centro',
  'usach':                  'Santiago Centro',
  'alameda':                'Santiago Centro',
  'centro':                 'Santiago Centro',
  'downtown':               'Santiago Centro',
  'plaza de armas':         'Santiago Centro',
  'barrio civico':          'Santiago Centro',

  'baquedano':              'Barrio Italia',
  'metro baquedano':        'Barrio Italia',
  'plaza italia':           'Barrio Italia',
  'italia':                 'Barrio Italia',
  'condell':                'Barrio Italia',
  'av italia':              'Barrio Italia',

  'bellas artes':           'Bellavista',
  'metro bellas artes':     'Bellavista',
  'patio bellavista':       'Bellavista',
  'pio nono':               'Bellavista',
  'constitución':           'Bellavista',
  'loreto':                 'Bellavista',

  'parque forestal':        'Lastarria',
  'lastarria':              'Lastarria',
  'santa lucia':            'Lastarria',
  'metro santa lucia':      'Lastarria',
  'barrio lastarria':       'Lastarria',

  'salvador':               'Providencia',
  'metro salvador':         'Providencia',
  'manuel montt':           'Providencia',
  'metro manuel montt':     'Providencia',
  'pedro de valdivia':      'Providencia',
  'metro pedro de valdivia':'Providencia',
  'los leones':             'Providencia',
  'metro los leones':       'Providencia',
  'metro bilbao':           'Providencia',
  'bilbao':                 'Providencia',
  'nueva de lyon':          'Providencia',
  'el bosque':              'Providencia',
  'av providencia':         'Providencia',
  'barrio el golf':         'Providencia',

  'tobalaba':               'Las Condes',
  'metro tobalaba':         'Las Condes',
  'el golf':                'Las Condes',
  'metro el golf':          'Las Condes',
  'alcantara':              'Las Condes',
  'metro alcantara':        'Las Condes',
  'escuela militar':        'Las Condes',
  'metro escuela militar':  'Las Condes',
  'manquehue':              'Las Condes',
  'metro manquehue':        'Las Condes',
  'sanhattan':              'Las Condes',
  'isidora goyenechea':     'Las Condes',
  'apoquindo':              'Las Condes',
  'av apoquindo':           'Las Condes',
  'costanera center':       'Las Condes',

  // ── Línea 1 extensión Vitacura/Lo Barnechea ───────────────────────────────
  'hernando de magallanes': 'Vitacura',
  'metro las condes':       'Las Condes',
  'nueva costanera':        'Vitacura',
  'alonso de cordova':      'Vitacura',
  'av vitacura':            'Vitacura',

  // ── Línea 2 / 3 ───────────────────────────────────────────────────────────
  'irarrazaval':            'Ñuñoa',
  'metro irarrazaval':      'Ñuñoa',
  'metro nunoa':            'Ñuñoa',
  'metro ñuñoa':            'Ñuñoa',
  'av ossa':                'Ñuñoa',
  'plaza nunoa':            'Ñuñoa',
  'plaza ñuñoa':            'Ñuñoa',

  'miraflores':             'Miraflores',
  'metro miraflores':       'Miraflores',

  // ── Aliases de barrios ya canónicos ──────────────────────────────────────
  'barrio italia':          'Barrio Italia',
  'providencia':            'Providencia',
  'bellavista':             'Bellavista',
  'santiago centro':        'Santiago Centro',
  'las condes':             'Las Condes',
  'vitacura':               'Vitacura',
  'nunoa':                  'Ñuñoa',
  'ñuñoa':                  'Ñuñoa',
}

/**
 * Normaliza un string para comparación (sin tildes, minúsculas, sin puntuación extra).
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quita tildes
    .replace(/[^a-z0-9 ]/g, ' ')       // quita puntuación
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Dado un zone extraído por Claude (puede ser "metro moneda", "sanhattan",
 * "baquedano", etc.), retorna el nombre canónico del barrio para la DB.
 * Si no encuentra match, retorna el valor original (para que el fallback
 * de búsqueda sin zona pueda actuar).
 */
export function resolveZone(zone: string | null | undefined): string | null {
  if (!zone) return null

  const key = normalize(zone)

  // 1. Exact match
  if (LANDMARK_MAP[key]) return LANDMARK_MAP[key]

  // 2. Partial match: alguna clave del mapa está contenida en el input
  //    Ej: "cerca del metro baquedano" → match "metro baquedano"
  for (const [landmark, neighborhood] of Object.entries(LANDMARK_MAP)) {
    if (key.includes(landmark)) return neighborhood
  }

  // 3. Input está contenido en alguna clave
  //    Ej: "moneda" → match "la moneda"
  for (const [landmark, neighborhood] of Object.entries(LANDMARK_MAP)) {
    if (landmark.includes(key) && key.length >= 4) return neighborhood
  }

  // 4. Sin match: retorna el original (el ilike en Supabase intentará igual)
  return zone
}
