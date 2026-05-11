/**
 * Client-side tracking helper. Llama a /api/track con discriminator type.
 *
 * Diseño:
 *   - session_id pseudoanónimo en localStorage. Si no existe, se crea.
 *   - Todas las llamadas son fire-and-forget (no bloquean el render).
 *   - Errores silenciosos (analytics nunca debe romper la UX).
 *   - Privacy: el helper NO captura IP — eso lo hace el server desde headers
 *     Vercel. user_agent y referrer vienen del navegador y se sanitizan server-side.
 */

const SESSION_KEY = 'hichapi_session_id'

/** Devuelve el session_id (lo crea si no existe). */
export function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) return stored
    const id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
    return id
  } catch {
    return 'no-storage'
  }
}

interface BaseFields {
  user_id?: string | null
}

function commonFields(): { session_id: string; user_agent: string; referrer: string } {
  return {
    session_id: getSessionId(),
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    referrer:   typeof document !== 'undefined' ? document.referrer : '',
  }
}

async function send(body: Record<string, unknown>): Promise<unknown> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch('/api/track', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      // keepalive: true permite que el request sobreviva navegaciones
      keepalive: true,
    })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

// ── Page view ──────────────────────────────────────────────────────────────

export interface PageViewArgs extends BaseFields {
  path: string
  restaurant_id?: string | null
  duration_ms?: number
}

export function trackPageView(args: PageViewArgs): void {
  void send({ type: 'page_view', ...commonFields(), ...args })
}

// ── Search ─────────────────────────────────────────────────────────────────

export interface SearchArgs extends BaseFields {
  query_text:           string
  parsed_intent?:       Record<string, unknown> | null
  zone_detected?:       string | null
  zone_lat?:            number | null
  zone_lng?:            number | null
  results_count?:       number | null
  no_results_in_zone?: boolean
  triggered_enrichment?: boolean
  /** Razón canónica del 0-result (alimentación al dashboard). */
  failure_reason?: 'no_zone_coverage' | 'no_cuisine_match' | 'no_dietary_match' | 'no_budget_match' | 'enrichment_skipped' | null
}

export async function trackSearch(args: SearchArgs): Promise<string | null> {
  const r = await send({ type: 'search', ...commonFields(), ...args }) as
    | { search_event_id?: string }
    | null
  return r?.search_event_id ?? null
}

// ── Search results (1 row por resultado mostrado) ──────────────────────────

export interface SearchResultsArgs extends BaseFields {
  search_event_id: string
  results: Array<{ restaurant_id: string; position: number }>
}

export interface SearchResultEventOut {
  id: string; restaurant_id: string; position: number
}

export async function trackSearchResults(args: SearchResultsArgs): Promise<SearchResultEventOut[]> {
  const r = await send({ type: 'search_results', ...commonFields(), ...args }) as
    | { events?: SearchResultEventOut[] }
    | null
  return r?.events ?? []
}

// ── Result click ───────────────────────────────────────────────────────────

export function trackResultClick(search_event_id: string, restaurant_id: string): void {
  void send({
    type: 'result_click',
    ...commonFields(),
    search_event_id,
    restaurant_id,
  })
}
