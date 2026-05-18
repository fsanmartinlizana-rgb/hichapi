/**
 * Lógica de búsqueda Discovery — extraída para que sea testeable de forma
 * aislada (sin pasar por el LLM ni el rate-limit del endpoint).
 *
 * Contrato fidedigno: si el usuario pide cuisine X en zona Y, los resultados
 * deben SER X en Y. Vacío honesto > resultado mezclado con disclaimer.
 * Cuando vacío, devolvemos `alternatives_in_zone_count` para que el frontend
 * pueda ofrecer "¿quieres ver otras opciones en {zona}?" como opt-in del user.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { resolveZone } from '@/lib/landmarks'

// ── Tipos públicos ───────────────────────────────────────────────────────────

export type Intent = {
  budget_clp?:           number | null
  /** Zone canónica (legacy single-zone). Si zones[] tiene >0 items, eso
   *  manda; este queda por backward compat con clientes viejos. */
  zone?:                 string | null
  /** Múltiples zonas con semántica OR ("italiana en Providencia o Ñuñoa").
   *  Si tiene >=2 items, el motor hace OR del filtro de neighborhood.
   *  Si solo viene zone (legacy), se normaliza a zones=[zone]. */
  zones?:                string[] | null
  dietary_restrictions?: string[] | null
  cuisine_type?:         string | null
  /** Plato específico que el user quiere comer ("salmón", "ceviche", "pizza").
   *  Si presente, filtramos restaurants cuyo menú contenga este término en
   *  el nombre o descripción de algún item. Independiente de cuisine_type. */
  dish_keyword?:         string | null
  user_lat?:             number | null
  user_lng?:             number | null
}

export type ResultRestaurant = {
  restaurant: {
    id: string; name: string; slug: string
    address: string | null; neighborhood: string | null
    lat: number | null; lng: number | null
    photo_url: string | null
    cuisine_type: string | null
    price_range: string | null
    rating: number; review_count: number
    google_rating: number | null
    google_rating_count: number | null
    photo_source: 'google_places' | 'owner_upload' | 'placeholder' | null
    claimed: boolean | null
    owner_id: string | null
  }
  suggested_dish: MenuItem | null
  menu_items: MenuItem[]
  match_reason: string
  /** Distancia en metros desde user_lat/lng. Solo presente cuando el user
   *  compartió ubicación. Frontend lo usa para mostrar "X m" / "X km" y
   *  decidir el badge "Más cerca" del primero. */
  distance_m?: number
  active_promotions?: { name: string; label: string; description: string | null }[]
}

type MenuItem = {
  id: string; name: string; description?: string | null
  price: number; tags?: string[] | null
  photo_url?: string | null; available?: boolean | null
  category?: string | null
}

/** Razón canónica por la que una búsqueda devolvió 0 results. NULL = exitosa.
 *  El frontend usa este tag para mostrar el mensaje correcto al user, y el
 *  dashboard de analytics lo trackea para priorizar qué arreglar. */
export type FailureReason =
  | 'no_zone_coverage'    // zona sin restaurants en DB todavía
  | 'no_cuisine_match'    // hay restaurants en zona pero no de la cuisine pedida
  | 'no_dietary_match'    // hay cuisine match pero ningún menú satisface dietary
  | 'no_budget_match'     // hay cuisine match pero ningún menú entra en presupuesto
  | null

export type SearchOutput = {
  results: ResultRestaurant[]
  /** Cuando results=[] y falla la búsqueda, sugerencias de "te podría
   *  interesar" de la misma cuisine en otras zonas (o top rated si no
   *  hay cuisine pedida). Hasta 5 cards mini. NUNCA reemplaza a results
   *  — son visualmente distintos en el frontend. */
  suggestions: ResultRestaurant[]
  /** Hay zone (texto o coords) pero ningún restaurant matchea bajo el filtro
   *  estricto. NUNCA llenamos results con otra zona ni con otra cuisine. */
  no_results_in_zone: boolean
  /** Cuántos restaurants HAY en la zona ignorando cuisine. Solo se calcula
   *  cuando hay `zone` Y `cuisine_type` pedidos y results=0. Permite al
   *  frontend ofrecer "ver {N} alternativas en {zone}" como opt-in. */
  alternatives_in_zone_count: number
  /** Zone canónico tras resolveZone (útil para mostrar al usuario y enviar
   *  al agente de enriquecimiento). */
  resolved_zone: string | null
  /** Causa raíz del 0-result. Permite al frontend mostrar mensaje específico
   *  y al dashboard distinguir "enriquecer más zonas" vs "tagear menús". */
  failure_reason: FailureReason
}

export type SearchOpts = {
  /** Cuando true, ignora cuisine_type en el filtro (mantiene zone). Solo se
   *  usa cuando el user clica explícitamente "ver alternativas en {zone}". */
  ignoreCuisine?: boolean
}

// ── Stripper de acentos / normalizer ─────────────────────────────────────────

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Distancia en metros entre dos coords (haversine). Usado para ordenar
 *  results por cercanía cuando el user dio su ubicación. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Diccionario de cuisines ──────────────────────────────────────────────────
//
// Tres usos:
//   1. CUISINE_ALIASES: aliases de input ("hindu" → "india", "ramen" →
//      "japonesa") que se aplican al `intent.cuisine_type` antes de comparar.
//   2. CUISINE_MENU_KEYWORDS: keywords que pueden aparecer en el nombre de un
//      menu item para que un restaurant con `cuisine_type` distinto sea match
//      por menú (ej. cafetería que vende hamburguesas).
//   3. CUISINE_RESTAURANT_KEYWORDS: keywords que pueden aparecer en el
//      `cuisine_type` del restaurant (más laxo que comparación literal).
//
// Cualquier cuisine que se agregue ACÁ debe estar también en el INFER_MAP
// del agente (app/api/enrich-zone/route.ts) para coherencia bidireccional.

export const CUISINE_ALIASES: Record<string, string> = {
  // Aliases del input del user → cuisine canónica
  hindu: 'india', indu: 'india', 'comida india': 'india',
  sushi: 'japonesa', ramen: 'japonesa', sashimi: 'japonesa', maki: 'japonesa',
  pizza: 'italiana', pasta: 'italiana', pizzeria: 'italiana',
  ceviche: 'peruana', 'lomo saltado': 'peruana',
  taco: 'mexicana', burrito: 'mexicana', quesadilla: 'mexicana',
  cazuela: 'chilena', empanada: 'chilena', 'pastel de choclo': 'chilena',
  burger: 'hamburgueseria', hamburguesa: 'hamburgueseria',
  thai: 'tailandesa',
  asado: 'parrilla', steak: 'parrilla', bbq: 'parrilla',
  mariscos: 'mariscos', pescado: 'mariscos',
  helado: 'heladeria', gelato: 'heladeria',
  cafe: 'cafeteria', brunch: 'cafeteria', desayuno: 'cafeteria',
  pan: 'panaderia', kuchen: 'panaderia',
  arepa: 'venezolana',
  paella: 'espanola', tapas: 'espanola',
  shawarma: 'arabe', falafel: 'arabe', kebab: 'arabe', hummus: 'arabe',
  // libanesa/turca/siria → árabe paraguas (la gente común no las distingue)
  libanesa: 'arabe', turca: 'arabe', siria: 'arabe',
  // china incluye dimsum y wok
  dimsum: 'china', wok: 'china',
  // coreana
  bibimbap: 'coreana', kimchi: 'coreana',
  // pub / cervecería
  pub: 'cerveceria', brewery: 'cerveceria',
}

/** Resuelve el cuisine_type del intent al canónico. Si no está en aliases,
 *  devuelve la versión sin acentos del original. */
export function canonicalCuisine(input: string | null | undefined): string | null {
  if (!input) return null
  const normalized = stripAccents(input)
  return CUISINE_ALIASES[normalized] ?? normalized
}

/** Para cada cuisine canónica: keywords que matcheamos contra
 *  `cuisine_type` del restaurant en DB. Acepta variaciones (ej. "japonesa"
 *  matchea "Japon", "japan", etc.). */
export const CUISINE_RESTAURANT_KEYWORDS: Record<string, string[]> = {
  hamburgueseria: ['hambur', 'burger'],
  japonesa:       ['japon', 'japan', 'sushi', 'ramen', 'nikkei'],
  italiana:       ['italian', 'pizz', 'past'],
  peruana:        ['peruan', 'peru', 'cevich', 'cebich', 'nikkei'],
  mexicana:       ['mexican', 'mexic'],
  chilena:        ['chilen', 'criol', 'patagon', 'picada'],
  vegana:         ['vegan', 'plant-based'],
  vegetariana:    ['vegetarian'],
  tailandesa:     ['tailand', 'thai'],
  parrilla:       ['parrilla', 'parrillad', 'asad', 'steak', 'bbq', 'churrasq'],
  mariscos:       ['marisc', 'pescad', 'seafood'],
  cafeteria:      ['cafeter', 'cafe', 'brunch', 'coffee'],
  panaderia:      ['panader', 'bakery'],
  heladeria:      ['heladeri', 'helader', 'ice cream', 'gelato'],
  india:          ['india', 'indi', 'curry', 'tandoor', 'naan'],
  china:          ['chin', 'chifa', 'wok', 'dimsum'],
  coreana:        ['corean', 'korea', 'bibimbap'],
  vietnamita:     ['vietnam', 'pho'],
  arabe:          ['arab', 'libanes', 'turc', 'siria', 'shawarma', 'kebab', 'falafel'],
  americana:      ['american', 'usa', 'tex-mex', 'tex mex', 'bbq'],
  argentina:      ['argentin', 'rioplaten'],
  venezolana:     ['venezol', 'arepa'],
  colombiana:     ['colombi', 'arepa'],
  caribena:       ['caribe', 'caribbean'],
  fusion:         ['fusion'],
  mediterranea:   ['mediterran'],
  griega:         ['grieg', 'greek'],
  espanola:       ['espan', 'spanish', 'tapas'],
  francesa:       ['frances', 'french'],
  asiatica:       ['asiat', 'asian'],
  sandwicheria:   ['sandwich', 'subway', 'sandwicheria'],
  cerveceria:     ['cervecer', 'pub', 'brewery', 'beer'],
  saludable:      ['saludable', 'healthy', 'fit'],
  internacional:  ['internacional', 'restaurante', 'restaurant'],
}

/** Para cada cuisine: keywords que pueden aparecer en el nombre/descripción
 *  de un menu item, permitiendo que un restaurant cuyo cuisine_type difiere
 *  pero que tiene este plato sea match. */
export const CUISINE_MENU_KEYWORDS: Record<string, string[]> = {
  hamburgueseria: ['hambur', 'burger', 'cheeseburger'],
  japonesa:       ['sushi', 'ramen', 'maki', 'nigiri', 'udon', 'tempura', 'gyoza'],
  italiana:       ['pizza', 'pasta', 'lasagna', 'noqui', 'ñoqui', 'risotto', 'spaghetti', 'fettucc'],
  peruana:        ['ceviche', 'lomo saltado', 'aji de gallina', 'anticucho'],
  mexicana:       ['taco', 'burrito', 'quesadilla', 'nacho', 'enchilad'],
  chilena:        ['cazuela', 'empanada', 'pastel de choclo', 'chorrillana', 'completo'],
  vegana:         ['vegan', 'plant-based'],
  vegetariana:    ['vegetarian', 'verdura'],
  tailandesa:     ['pad thai', 'curry tailand', 'tom yum'],
  parrilla:       ['parrilla', 'parrillad', 'asado', 'churrasco', 'bife', 'chorizo', 'lomo'],
  mariscos:       ['marisco', 'pescado', 'salmon', 'congrio', 'locos', 'camaron', 'machas', 'ostion'],
  cafeteria:      ['cafe', 'desayuno', 'brunch', 'sandwich', 'tostad', 'croissant'],
  panaderia:      ['empanada', 'kuchen', 'cupcake'],
  heladeria:      ['helado', 'gelato', 'sundae'],
  india:          ['curry', 'tandoor', 'naan', 'biryani', 'tikka', 'masala', 'samosa'],
  china:          ['chow mein', 'kung pao', 'arroz chaufa', 'wonton', 'dumpling'],
  coreana:        ['bibimbap', 'kimchi', 'bulgogi', 'galbi'],
  vietnamita:     ['pho', 'banh mi'],
  arabe:          ['shawarma', 'falafel', 'kebab', 'hummus', 'tabule', 'kibbeh'],
  americana:      ['hot dog', 'bbq', 'wings', 'mac and cheese'],
  argentina:      ['choripan', 'milanesa', 'provoleta', 'matambre'],
  venezolana:     ['arepa', 'pabellon', 'cachapa'],
  colombiana:     ['bandeja paisa', 'arepa colombian'],
  caribena:       ['mofongo', 'tostones'],
  mediterranea:   ['hummus', 'falafel', 'baba ganoush'],
  griega:         ['gyro', 'souvlaki', 'tzatziki', 'moussaka'],
  espanola:       ['paella', 'tapas', 'tortilla espanola', 'jamon'],
  francesa:       ['croissant', 'baguette', 'ratatouille', 'crepe'],
  asiatica:       ['wok', 'curry', 'sushi', 'ramen', 'pad thai', 'kebab'],
  sandwicheria:   ['sandwich', 'subway', 'sub'],
  cerveceria:     ['cerveza', 'pinta', 'pint', 'ipa', 'lager', 'stout'],
  saludable:      ['ensalada', 'bowl', 'wrap saludable', 'green'],
  internacional:  [],
}

/** ¿El cuisine_type del restaurant matchea el cuisine pedido? */
export function restaurantCuisineMatches(
  requestedCuisine: string,
  restaurantCuisine: string | null | undefined,
): boolean {
  if (!restaurantCuisine) return false
  const c = stripAccents(restaurantCuisine)
  const keywords = CUISINE_RESTAURANT_KEYWORDS[requestedCuisine] ?? [requestedCuisine]
  return keywords.some(k => c.includes(k))
}

/** ¿Algún ítem del menú matchea la cuisine pedida? */
export function menuMatchesCuisine(
  requestedCuisine: string,
  menuItems: MenuItem[],
): boolean {
  const keywords = CUISINE_MENU_KEYWORDS[requestedCuisine] ?? []
  if (keywords.length === 0) return false
  return menuItems.some(item => {
    const hay = stripAccents(`${item.name ?? ''} ${item.description ?? ''} ${item.category ?? ''}`)
    return keywords.some(k => hay.includes(k))
  })
}

// ── Cliente Supabase (server-only) ───────────────────────────────────────────

let _client: SupabaseClient | null = null
function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _client
}

// ── Filtros sobre los rows crudos ────────────────────────────────────────────

type RawRow = {
  id: string; name: string; slug: string; address: string | null
  neighborhood: string | null; lat: number | null; lng: number | null
  photo_url: string | null; cuisine_type: string | null
  price_range: string | null; rating: number; review_count: number
  google_rating: number | null; google_rating_count: number | null
  photo_source: 'google_places' | 'owner_upload' | 'placeholder' | null
  claimed: boolean | null
  owner_id: string | null
  menu_items: MenuItem[] | null
}

type FetchOpts = {
  withZone:    boolean
  withCuisine: boolean
  /** Si presente y hay user_lat/lng, primero filtra por ST_DWithin via RPC. */
  radius_m?:   number
}

async function fetchAndFilter(
  intent: Intent,
  opts: FetchOpts,
): Promise<ResultRestaurant[]> {
  const sb = getSupabase()
  const { withZone, withCuisine, radius_m } = opts

  let baseSelect = sb
    .from('restaurants')
    .select(`id, name, slug, address, neighborhood, lat, lng, photo_url, cuisine_type, price_range, rating, review_count, google_rating, google_rating_count, photo_source, claimed, owner_id,
             menu_items (id, name, description, price, tags, photo_url, available, category)`)
    .eq('active', true)

  if (radius_m && intent.user_lat != null && intent.user_lng != null) {
    const { data: nearby, error: rpcErr } = await sb.rpc('restaurants_in_radius', {
      lat: intent.user_lat, lng: intent.user_lng, radius_m,
    })
    if (rpcErr || !nearby || (nearby as { id: string }[]).length === 0) return []
    const ids = (nearby as { id: string }[]).map(r => r.id)
    baseSelect = baseSelect.in('id', ids)
  }

  const { data, error } = await baseSelect.limit(300)
  if (error || !data) return []
  const restaurants = data as unknown as RawRow[]

  let filtered = restaurants
  if (withZone) {
    // Multi-zona OR: si intent.zones tiene >0 items, matchea cualquiera.
    // Si solo viene zone (legacy), trata como zones=[zone].
    const allZones = (intent.zones && intent.zones.length > 0)
      ? intent.zones
      : (intent.zone ? [intent.zone] : [])
    if (allZones.length > 0) {
      const normZones = allZones.map(z => stripAccents(z)).filter(Boolean)
      filtered = filtered.filter(r => {
        if (!r.neighborhood) return false
        const rn = stripAccents(r.neighborhood)
        return normZones.some(z => rn.includes(z))
      })
    }
  }

  const reqCuisine = withCuisine ? canonicalCuisine(intent.cuisine_type) : null
  if (reqCuisine) {
    filtered = filtered.filter(r => {
      if (restaurantCuisineMatches(reqCuisine, r.cuisine_type)) return true
      if (menuMatchesCuisine(reqCuisine, r.menu_items ?? [])) return true
      return false
    })
  }

  // ── Dish keyword: "quiero salmón en Providencia" ─────────────────────────
  // Filtramos restaurants cuyo menú contenga el término en name/description.
  // Si el restaurant NO tiene menú cargado (agent_enriched sin scrape),
  // lo INCLUIMOS (mismo principio que budget: mejor mostrar con caveat que
  // descartar al ciego — el cuisine_type matchea, podría tener el plato).
  const dish = intent.dish_keyword?.trim()
  if (dish && dish.length >= 2) {
    const d = stripAccents(dish)
    filtered = filtered.filter(r => {
      const items = r.menu_items ?? []
      if (items.length === 0) return true  // sin menu: incluir; user decide
      return items.some(i => {
        const hay = stripAccents(`${i.name ?? ''} ${i.description ?? ''}`)
        return hay.includes(d)
      })
    })
  }

  // Sort priorizado:
  // - Si hay user_lat/lng: por distancia ascendente (más cerca primero).
  //   El primer result se marca como "más cerca" en el frontend con badge.
  // - Sin coords: por rating DESC (como antes — los mejor valorados arriba).
  const hasUserCoords = intent.user_lat != null && intent.user_lng != null
  const sorted = [...filtered].sort((a, b) => {
    if (hasUserCoords && a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
      const dA = haversineMeters(intent.user_lat!, intent.user_lng!, a.lat, a.lng)
      const dB = haversineMeters(intent.user_lat!, intent.user_lng!, b.lat, b.lng)
      return dA - dB
    }
    return (b.rating ?? 0) - (a.rating ?? 0)
  })

  return sorted
    .map((restaurant): ResultRestaurant | null => {
      const items = restaurant.menu_items ?? []
      const distance_m = (hasUserCoords && restaurant.lat != null && restaurant.lng != null)
        ? Math.round(haversineMeters(intent.user_lat!, intent.user_lng!, restaurant.lat, restaurant.lng))
        : undefined
      let candidateItems = items.filter(item => item.available !== false)

      const hasBudget  = intent.budget_clp != null
      const hasDietary = (intent.dietary_restrictions?.length ?? 0) > 0
      const hasMenuInDb = items.length > 0  // ¿el restaurant tiene carta cargada?

      if (hasBudget) {
        candidateItems = candidateItems.filter(item => item.price <= intent.budget_clp!)
      }
      if (hasDietary) {
        candidateItems = candidateItems.filter(item =>
          intent.dietary_restrictions!.some(r =>
            item.tags?.some(tag => tag.toLowerCase().includes(r.toLowerCase()))
          )
        )
      }

      // Reglas de descarte:
      // - Sin menú en DB + budget pedido → INCLUIR. No podemos saber si
      //   entra en budget, pero la honestidad correcta es mostrar el lugar
      //   con caveat "Carta pendiente" en lugar de descartar al ciego.
      //   El user puede llamar para confirmar precios.
      // - Sin menú en DB + dietary pedido → DESCARTAR. No podemos garantizar
      //   que tengan opciones sin gluten/veganas si no conocemos su carta.
      //   Mostrar sería deshonesto y pondría en riesgo a celíacos.
      // - Con menú en DB + ningún item satisface filtros → DESCARTAR
      //   (sabemos que su carta no aplica).
      if (hasMenuInDb && (hasBudget || hasDietary) && candidateItems.length === 0) return null
      if (!hasMenuInDb && hasDietary) return null

      // Sort de candidateItems: si user pidió dish_keyword, los items que
      // lo contengan van primero (suggested_dish va a ser uno relevante).
      // Después por precio descendente como antes.
      const dishNorm = dish ? stripAccents(dish) : null
      const sortedItems = [...candidateItems].sort((a, b) => {
        if (dishNorm) {
          const aMatch = stripAccents(`${a.name ?? ''} ${a.description ?? ''}`).includes(dishNorm)
          const bMatch = stripAccents(`${b.name ?? ''} ${b.description ?? ''}`).includes(dishNorm)
          if (aMatch && !bMatch) return -1
          if (!aMatch && bMatch) return 1
        }
        return b.price - a.price
      })
      const bestDish: MenuItem | null = sortedItems[0] ?? null
      const menuItems = sortedItems.slice(0, 3)

      // matchReason — siempre fidedigno: indicamos POR QUÉ lo recomendamos.
      let matchReason: string
      const dishMatchedItem = dishNorm && bestDish &&
        stripAccents(`${bestDish.name ?? ''} ${bestDish.description ?? ''}`).includes(dishNorm)

      if (dishMatchedItem && bestDish) {
        // Caso priority: el user pidió un plato específico Y lo encontramos.
        matchReason = `Tienen ${bestDish.name} en ${restaurant.neighborhood ?? ''}`.trim()
      } else if (dish && !hasMenuInDb) {
        // User pidió dish específico pero el restaurant no tiene menu en DB.
        // Honesto: decimos que el lugar coincide con la zona/cuisine pero no
        // podemos confirmar el plato.
        matchReason = `${restaurant.cuisine_type ?? 'Restaurante'} en ${restaurant.neighborhood ?? ''} (carta sin cargar — confirmá si tienen ${dish})`.trim()
      } else if (reqCuisine && !restaurantCuisineMatches(reqCuisine, restaurant.cuisine_type) && bestDish) {
        // El restaurant no es de la cuisine pedida pero su menú sí matchea.
        matchReason = `Tienen ${bestDish.name} en ${restaurant.neighborhood ?? ''}`.trim()
      } else {
        matchReason = `Cocina ${restaurant.cuisine_type ?? 'internacional'} en ${restaurant.neighborhood ?? ''}`.trim()
      }

      return {
        restaurant: {
          id: restaurant.id, name: restaurant.name, slug: restaurant.slug,
          address: restaurant.address, neighborhood: restaurant.neighborhood,
          lat: restaurant.lat, lng: restaurant.lng, photo_url: restaurant.photo_url,
          cuisine_type: restaurant.cuisine_type, price_range: restaurant.price_range,
          rating: restaurant.rating, review_count: restaurant.review_count,
          google_rating: restaurant.google_rating ?? null,
          google_rating_count: restaurant.google_rating_count ?? null,
          photo_source: restaurant.photo_source ?? null,
          claimed: restaurant.claimed ?? null,
          owner_id: restaurant.owner_id ?? null,
        },
        suggested_dish: bestDish,
        menu_items: menuItems,
        match_reason: matchReason,
        distance_m,
      }
    })
    .filter((r): r is ResultRestaurant => r !== null)
    // Cap superior: hasta 30 results. El frontend pagina mostrando 12 por
    // pulsación del botón "Ver más". Subir el cap acá sin paginar inunda al
    // user; bajarlo limita lo que puede explorar.
    .slice(0, 30)
}

/** Cuenta restaurants en una o múltiples zonas (OR) ignorando cuisine.
 *  Usado para decidir si ofrecer al user "ver alternativas". */
async function countInZones(zones: string[]): Promise<number> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('restaurants')
    .select('neighborhood')
    .eq('active', true)
    .limit(500)
  if (error || !data || zones.length === 0) return 0
  const normZones = zones.map(z => stripAccents(z))
  return (data as { neighborhood: string | null }[])
    .filter(r => {
      if (!r.neighborhood) return false
      const rn = stripAccents(r.neighborhood)
      return normZones.some(z => rn.includes(z))
    }).length
}

// ── searchRestaurants — el contrato público ──────────────────────────────────

export async function searchRestaurants(
  intent: Intent,
  opts: SearchOpts = {},
): Promise<SearchOutput> {
  // Normalizar zones: si solo viene zone (legacy), promoverlo a zones=[zone].
  // Cada zona se resuelve por landmarks (metro Tobalaba → Providencia, etc.).
  const rawZones = (intent.zones && intent.zones.length > 0)
    ? intent.zones
    : (intent.zone ? [intent.zone] : [])
  const resolvedZones = rawZones
    .map(z => resolveZone(z))
    .filter((z): z is string => !!z)
  const resolvedZone = resolvedZones[0] ?? null  // legacy single

  const resolvedIntent: Intent = {
    ...intent,
    zone:  resolvedZone,
    zones: resolvedZones.length > 0 ? resolvedZones : null,
    cuisine_type: opts.ignoreCuisine ? null : intent.cuisine_type,
  }

  let results: ResultRestaurant[] = []
  let no_results_in_zone = false

  const hasCoords = resolvedIntent.user_lat != null && resolvedIntent.user_lng != null

  if (hasCoords) {
    // Path coords: PostGIS WHERE estricto. 3km → 5km → vacío. NUNCA mostramos
    // resultados fuera del radio sin avisar.
    results = await fetchAndFilter(resolvedIntent, { withZone: false, withCuisine: true, radius_m: 3000 })
    if (results.length === 0) {
      results = await fetchAndFilter(resolvedIntent, { withZone: false, withCuisine: true, radius_m: 5000 })
    }
    if (results.length === 0) no_results_in_zone = true
  } else if ((resolvedIntent.zones && resolvedIntent.zones.length > 0) || resolvedIntent.zone) {
    // Path con zona(s) texto: estricto zones+cuisine. Si vacío, vacío con
    // flag. Para multi-zona, OR entre zonas. NO relajamos cuisine acá — el
    // user pedirá explícitamente alternativas si lo desea (frontend opt-in).
    results = await fetchAndFilter(resolvedIntent, { withZone: true, withCuisine: true })
    if (results.length === 0) no_results_in_zone = true
  } else {
    // Sin zone ni coords: aquí sí podemos relajar cuisine porque el user no
    // ancló la búsqueda a una zona.
    results = await fetchAndFilter(resolvedIntent, { withZone: false, withCuisine: true })
    if (results.length === 0 && resolvedIntent.cuisine_type) {
      results = await fetchAndFilter(resolvedIntent, { withZone: false, withCuisine: false })
    }
  }

  // ── alternatives_in_zone_count + failure_reason ────────────────────────
  // Cuando results=0 con zona pedida, hacemos 1-2 queries adicionales para
  // (a) saber cuántos restaurants HAY en la(s) zona(s) (ignorando filtros)
  // y (b) clasificar la causa raíz del fail. Esto SOLO en cold path.
  let alternatives_in_zone_count = 0
  let failure_reason: FailureReason = null
  const allZonesForFail = resolvedIntent.zones && resolvedIntent.zones.length > 0
    ? resolvedIntent.zones
    : (resolvedIntent.zone ? [resolvedIntent.zone] : [])
  if (no_results_in_zone && allZonesForFail.length > 0 && !opts.ignoreCuisine) {
    alternatives_in_zone_count = await countInZones(allZonesForFail)
    const altCount = alternatives_in_zone_count

    if (altCount === 0) {
      failure_reason = 'no_zone_coverage'
    } else if (resolvedIntent.cuisine_type) {
      // Hay restaurants en la zona; sabemos que el filtro de cuisine los
      // descartó. Pero el motor también aplica dietary + budget en la misma
      // pasada — para distinguir dietary vs cuisine, re-fetch con cuisine
      // pero sin dietary/budget.
      const hasDietary = (resolvedIntent.dietary_restrictions?.length ?? 0) > 0
      const hasBudget  = resolvedIntent.budget_clp != null
      if (hasDietary || hasBudget) {
        // Re-fetch: cuisine sí, dietary/budget no — si encuentra → la causa
        // fue dietary o budget, no cuisine.
        const cuisineOnly = await fetchAndFilter(
          { ...resolvedIntent, dietary_restrictions: [], budget_clp: null },
          { withZone: true, withCuisine: true },
        )
        if (cuisineOnly.length > 0) {
          // Hubo match de cuisine. Distinguir dietary vs budget.
          if (hasDietary) failure_reason = 'no_dietary_match'
          else            failure_reason = 'no_budget_match'
        } else {
          failure_reason = 'no_cuisine_match'
        }
      } else {
        failure_reason = 'no_cuisine_match'
      }
    } else {
      // Sin cuisine pedida pero results=0 (pasó al dietary/budget)
      const hasDietary = (resolvedIntent.dietary_restrictions?.length ?? 0) > 0
      if (hasDietary) failure_reason = 'no_dietary_match'
      else            failure_reason = 'no_budget_match'
    }
  }

  // ── Enriquecer con promociones activas ───────────────────────────────
  if (results.length > 0) {
    const sb = getSupabase()
    const restIds = results.map(r => r.restaurant.id)
    const { data: promoRows } = await sb
      .from('promotions')
      .select('id, restaurant_id, name, description, kind, value, time_start, time_end, days_of_week, valid_from, valid_until, channel_mesa, channel_espera, channel_chapi, menu_item_ids, active')
      .in('restaurant_id', restIds)
      .eq('active', true)
      .eq('channel_chapi', true)

    const { isPromoActiveNow, promoValueLabel } = await import('@/lib/promotions')
    type Promo = import('@/lib/promotions').PromotionRow & { restaurant_id: string }
    const byRest = new Map<string, { name: string; label: string; description: string | null }[]>()
    for (const p of ((promoRows ?? []) as Promo[])) {
      if (!isPromoActiveNow(p)) continue
      const arr = byRest.get(p.restaurant_id) ?? []
      arr.push({ name: p.name, label: promoValueLabel(p), description: p.description })
      byRest.set(p.restaurant_id, arr)
    }
    for (const r of results) {
      r.active_promotions = byRest.get(r.restaurant.id) ?? []
    }
  }

  // ── Suggestions cuando results=[] ─────────────────────────────────────
  // Mejora UX del banner "no encontramos nada": en lugar de un dead-end,
  // mostramos hasta 5 sugerencias relacionadas. Heurística:
  //   - Si hay cuisine pedida → top 5 de esa cuisine en cualquier zona
  //   - Si no hay cuisine     → top 5 por rating en cualquier zona
  // Ordenadas por rating DESC. NUNCA reemplazan los results estrictos —
  // son "te podría interesar" visualmente separadas.
  let suggestions: ResultRestaurant[] = []
  if (results.length === 0 && !opts.ignoreCuisine) {
    suggestions = await fetchAndFilter(
      // Sin zone ni budget ni dietary — solo cuisine si hay. Esto maximiza
      // resultados y respeta lo que más le importa al user.
      { cuisine_type: resolvedIntent.cuisine_type ?? null },
      { withZone: false, withCuisine: !!resolvedIntent.cuisine_type },
    )
    suggestions = suggestions.slice(0, 5)
  }

  return {
    results,
    suggestions,
    no_results_in_zone,
    alternatives_in_zone_count,
    resolved_zone: resolvedZone,
    failure_reason,
  }
}
