/**
 * Caché en memoria para reducir llamadas a Claude y Supabase.
 *
 * En Vercel Serverless las instancias lambda se mantienen calientes
 * entre requests, así que el módulo persiste mientras la instancia vive.
 * Para caché cross-instancia se necesitaría Vercel KV / Redis.
 *
 * Dos cachés separados:
 *  - queryCache: resultados de Supabase por intent hash (TTL 30 min)
 *  - claudeCache: respuestas de Claude por message hash (TTL 60 min)
 */

type CacheEntry<T> = { data: T; expires: number }

class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>()
  private readonly ttlMs: number
  private readonly maxSize: number

  constructor(ttlMs: number, maxSize = 200) {
    this.ttlMs   = ttlMs
    this.maxSize = maxSize
  }

  get(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expires) {
      this.store.delete(key)
      return null
    }
    return entry.data
  }

  set(key: string, data: T): void {
    // Evict oldest entries if at capacity
    if (this.store.size >= this.maxSize) {
      const oldest = [...this.store.entries()]
        .sort((a, b) => a[1].expires - b[1].expires)[0]
      if (oldest) this.store.delete(oldest[0])
    }
    this.store.set(key, { data, expires: Date.now() + this.ttlMs })
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  get size() { return this.store.size }
}

// ── Instancias exportadas ─────────────────────────────────────────────────────

/** Resultados de restaurantes: 30 minutos */
export const queryCache = new TTLCache<any[]>(30 * 60 * 1000)

/** Respuestas de Claude: 60 minutos */
export const claudeCache = new TTLCache<{
  message: string
  intent: Record<string, any>
  ready_to_search: boolean
  needs_location: boolean
}>(60 * 60 * 1000)

// ── Helpers de clave ──────────────────────────────────────────────────────────

type Intent = {
  budget_clp?: number | null
  zone?: string | null
  dietary_restrictions?: string[] | null
  cuisine_type?: string | null
}

/**
 * Clave determinista para resultados de Supabase.
 * Normaliza todos los campos para que "Providencia" y "providencia" den la misma clave.
 */
export function intentCacheKey(intent: Intent): string {
  return JSON.stringify({
    z: intent.zone?.toLowerCase().trim() || null,
    c: intent.cuisine_type?.toLowerCase().trim() || null,
    b: intent.budget_clp ? Math.floor(intent.budget_clp / 1000) * 1000 : null, // bucketing de ±1000 CLP
    d: [...(intent.dietary_restrictions || [])].map(r => r.toLowerCase()).sort(),
  })
}

/**
 * Clave para caché de Claude: normaliza el mensaje + intent previo.
 * Mensajes muy similares pueden tener la misma clave de caché.
 */
export function claudeCacheKey(message: string, intent?: Intent | null): string {
  const normalMsg = message.toLowerCase().trim().replace(/\s+/g, ' ')
  return JSON.stringify({
    m: normalMsg,
    z: intent?.zone?.toLowerCase().trim() || null,
    c: intent?.cuisine_type?.toLowerCase().trim() || null,
  })
}
