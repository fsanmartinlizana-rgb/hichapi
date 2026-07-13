'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Send, Loader2, MapPin } from 'lucide-react'
import { ChapiIntent, RestaurantResult } from '@/lib/types'
import { trackSearch, trackSearchResults } from '@/lib/tracking'

const QUICK_CHIPS = [
  'Sin gluten cerca de mí',
  'Vegano en Providencia',
  'Algo rico por menos de 15 lucas',
  'Japonés en Barrio Italia',
  'Para almorzar hoy',
]

const ZONE_CHIPS = [
  'Providencia',
  'Barrio Italia',
  'Bellavista',
  'Lastarria',
  'Las Condes',
  'Ñuñoa',
  'Santiago Centro',
  'Vitacura',
]

/** Cuando hay zone pedida, no hay matches con lo que el user pidió (cuisine
 *  o un plato específico) y SÍ hay otros restaurants en la zona, ofrecemos
 *  al user "ver {N} otras opciones en {zone}". Opt-in explícito — nunca
 *  mezclamos cuisines/platos silenciosamente. */
export interface NoCuisineMatchInfo {
  zone:                string
  /** Lo que el user pidió y NO encontramos. Puede ser una cuisine
   *  ("italiana") o un plato específico ("salmón"). El frontend usa
   *  `kind` para mostrar el copy correcto. */
  what:                string
  kind:                'cuisine' | 'dish'
  alternatives_count:  number
  query_original:      string
}

/** Tag de fail estructurado para que el frontend muestre el mensaje correcto. */
export type SearchFailureReason =
  | 'no_zone_coverage'
  | 'no_cuisine_match'
  | 'no_dietary_match'
  | 'no_budget_match'

export interface NoResultsDetail {
  reason:               SearchFailureReason
  zone:                 string | null
  cuisine:              string | null
  dietary_restrictions: string[]
  budget_clp:           number | null
  alternatives_count:   number  // restaurants en zona ignorando todos los filtros
}

interface ChatBoxProps {
  /** search_event_id se incluye para que ResultCard pueda track los clicks
   *  contra esa búsqueda específica. */
  onResults:               (results: RestaurantResult[], query: string, search_event_id: string | null) => void
  onStatusChange:          (status: string) => void
  onLoadingChange?:        (loading: boolean) => void
  /** Llamado cuando no hay nada en la zona ni siquiera tras enriquecer.
   *  `suggestions` son cards mini de "te podría interesar" calculadas
   *  server-side (top 5 de la misma cuisine en otras zonas). */
  onNoResults?:            (intent: ChapiIntent, suggestions: RestaurantResult[]) => void
  /** Llamado cuando hay zona y restaurants en la zona, pero ninguno de la
   *  cuisine pedida. El padre muestra un botón "ver alternativas". Al clic,
   *  el padre incrementa `pendingAlternativeNonce` para disparar la búsqueda
   *  con allow_alternatives=true. */
  onNoCuisineMatchInZone?: (info: NoCuisineMatchInfo) => void
  /** Callback con el detail estructurado del 0-result. Reemplaza a onNoResults
   *  cuando el banner contextual aplica (dietary/budget/coverage explícitos). */
  onNoResultsDetail?:      (detail: NoResultsDetail) => void
  /** Cuando este nonce cambia, ChatBox reenvía la última query del user con
   *  allow_alternatives=true. El padre lo incrementa al clicar el botón
   *  "ver alternativas en {zone}". null/0 = no acción. */
  pendingAlternativeNonce?: number
  /** Si el padre detecta una ciudad distinta por IP, la pasa acá para que
   * el chat sepa desde el inicio dónde buscar. */
  defaultZone?: string
  /** Texto inicial para pre-cargar el input (ej: viene de la mini-búsqueda
   *  del hero de la landing vía /buscar?q=…). Solo prefill — NO auto-envía:
   *  el user confirma con Enter/botón. Se aplica una única vez. */
  initialInput?: string
}

// ── Typing dots animation ────────────────────────────────────────────────────
// 3 puntos naranja brand parpadeando con delay escalonado (animación blink
// CSS pura). Wrapper marcado aria-live=polite para anuncio del screen reader.
function TypingDots() {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label="Chapi está pensando"
      className="inline-flex items-center gap-1 px-1"
    >
      {[0, 1, 2].map(i => (
        <span
          key={i}
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]"
          style={{
            animation: 'chapi-blink 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes chapi-blink {
          0%, 80%, 100% { opacity: 0.2; }
          40%            { opacity: 1; }
        }
      `}</style>
    </span>
  )
}

export function ChatBox({
  onResults,
  onStatusChange,
  onLoadingChange,
  onNoResults,
  onNoCuisineMatchInZone,
  onNoResultsDetail,
  pendingAlternativeNonce,
  defaultZone,
  initialInput,
}: ChatBoxProps) {
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [waitingFirstToken, setWaiting] = useState(false)
  const [intent, setIntent]             = useState<ChapiIntent>({ zone: defaultZone })
  const [chapiMessage, setChapiMessage] = useState('')
  const [needsLocation, setNeedsLocation] = useState(false)
  const [askingForZone, setAskingForZone] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastQueryRef = useRef<string>('')
  const appliedInitialRef = useRef(false)

  // Prefill del input desde ?q= (mini-búsqueda del hero). Una sola vez, sin
  // auto-enviar — el user decide cuándo mandar. El prop puede llegar después
  // del mount (el padre lo lee en un useEffect), por eso se observa.
  useEffect(() => {
    if (appliedInitialRef.current || !initialInput) return
    appliedInitialRef.current = true
    setInput(initialInput)
    inputRef.current?.focus()
  }, [initialInput])

  // Cuando el padre incrementa pendingAlternativeNonce, reenviamos la última
  // query con allow_alternatives=true (opt-in del user al clic del banner).
  useEffect(() => {
    if (!pendingAlternativeNonce) return
    if (!lastQueryRef.current) return
    sendMessage(lastQueryRef.current, { allowAlternatives: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAlternativeNonce])

  // Actualizar intent.zone si defaultZone se resuelve asíncronamente en el padre
  useEffect(() => {
    if (defaultZone && !intent.zone) {
      setIntent(prev => ({ ...prev, zone: defaultZone }))
    }
  }, [defaultZone])

  async function requestLocation(): Promise<{ user_lat: number; user_lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ user_lat: pos.coords.latitude, user_lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 }
      )
    })
  }

  async function sendMessage(
    message: string,
    opts?: { isRetry?: boolean; allowAlternatives?: boolean },
  ) {
    if (!message.trim() || loading) return

    lastQueryRef.current = message
    setLoading(true)
    setWaiting(true)
    onLoadingChange?.(true)
    setInput('')
    onStatusChange('')
    if (!opts?.isRetry && !opts?.allowAlternatives) setChapiMessage('')
    setAskingForZone(false)

    let currentIntent = { ...intent }
    if (needsLocation && !currentIntent.user_lat) {
      const location = await requestLocation()
      if (location) {
        currentIntent = { ...currentIntent, ...location }
        setIntent(currentIntent)
      }
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          intent: currentIntent,
          allow_alternatives: !!opts?.allowAlternatives,
        }),
      })

      if (!res.ok) throw new Error('Error en la API')

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let event = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            event = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))

            if (event === 'token') {
              setWaiting(false)         // first token received → hide dots
              setChapiMessage(data.text)
              onStatusChange('')

            } else if (event === 'done') {
              setWaiting(false)
              if (data.intent) {
                setIntent(prev => {
                  const next = { ...prev }
                  for (const key of Object.keys(data.intent) as Array<keyof ChapiIntent>) {
                    if (data.intent[key] !== undefined) {
                      // @ts-ignore
                      next[key] = data.intent[key]
                    }
                  }
                  return next
                })
              }
              setChapiMessage(data.message)
              setNeedsLocation(data.needs_location)
              // Show zone chips when Chapi hasn't got a zone yet and isn't searching
              setAskingForZone(!data.ready_to_search || (!data.intent?.zone && !data.needs_location))

              // Si Claude todavía está clarificando (pidiendo presupuesto u
              // otra info), NO accionamos sobre la búsqueda — dejamos que el
              // user responda primero. Solo cuando claude_was_ready=true
              // entramos al flow de auto-enrich / banners.
              const claudeReady = data.claude_was_ready === true

              // Track de la búsqueda (Ley 19.628: sin IP cruda, retention 12m,
              // RLS super_admin). Solo cuando Claude ya buscó (no clarificando)
              // y no es un retry (evitamos doble track del mismo intent).
              const shouldTrack = claudeReady && !opts?.isRetry
              const trackingPromise: Promise<string | null> = shouldTrack
                ? trackSearch({
                    query_text:           message,
                    parsed_intent:        data.intent ?? null,
                    zone_detected:        data.intent?.zone ?? data.resolved_zone ?? null,
                    zone_lat:             data.intent?.user_lat ?? null,
                    zone_lng:             data.intent?.user_lng ?? null,
                    results_count:        data.results?.length ?? 0,
                    no_results_in_zone:   !!data.no_results_in_zone,
                    triggered_enrichment: false,  // se setea en true por el agente backend, no acá
                    // Tag canónico para distinguir las 4 causas raíz en el dashboard
                    failure_reason:       data.failure_reason ?? null,
                  })
                : Promise.resolve(null)

              if (data.results?.length > 0) {
                trackingPromise.then(searchEventId => {
                  if (searchEventId) {
                    void trackSearchResults({
                      search_event_id: searchEventId,
                      results: data.results.slice(0, 20).map((r: { restaurant: { id: string } }, i: number) => ({
                        restaurant_id: r.restaurant.id,
                        position:      i + 1,
                      })),
                    })
                  }
                  onResults(data.results, message, searchEventId)
                  onStatusChange('')
                }).catch(() => {
                  onResults(data.results, message, null)
                  onStatusChange('')
                })
              } else if (
                // dietary/budget no match: el agente NO va a ayudar porque
                // los placeholders del agente no tienen tags ricos. Mostrar
                // mensaje específico y NO disparar enrichment inútil.
                claudeReady &&
                (data.failure_reason === 'no_dietary_match' || data.failure_reason === 'no_budget_match')
              ) {
                onNoResultsDetail?.({
                  reason:               data.failure_reason,
                  zone:                 data.intent?.zone ?? data.resolved_zone ?? null,
                  cuisine:              data.intent?.cuisine_type ?? null,
                  dietary_restrictions: data.intent?.dietary_restrictions ?? [],
                  budget_clp:           data.intent?.budget_clp ?? null,
                  alternatives_count:   data.alternatives_in_zone_count ?? 0,
                })
              } else if (data.no_results_in_zone && claudeReady && !opts?.isRetry) {
                // ── Auto-enrich: zona conocida pero sin matches para lo que
                // el user pidió (cuisine o dish específico). Disparamos el
                // agente y reintentamos. Si tras el retry tampoco hay matches
                // pero la zona tiene OTROS restaurants, ofrecemos opt-in.
                const zoneLabel    = data.intent?.zone ?? data.resolved_zone ?? 'esa zona'
                const cuisineLabel = data.intent?.cuisine_type ?? null
                const dishLabel    = data.intent?.dish_keyword ?? null
                // El "what" prioriza dish específico sobre cuisine genérica:
                // si pidió salmón + japonesa, "no encontré salmón" es más útil.
                const whatLabel    = dishLabel ?? cuisineLabel
                setChapiMessage(
                  whatLabel
                    ? `No encontré ${whatLabel} en ${zoneLabel}. Estoy buscando más opciones para ti...`
                    : `No encontré restaurantes en ${zoneLabel}. Estoy buscando más opciones para ti...`
                )
                onLoadingChange?.(false)

                fetch('/api/enrich-zone', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    zone:           data.intent?.zone ?? data.resolved_zone ?? '',
                    cuisine_type:   cuisineLabel,
                    query_original: message,
                    lat:            data.intent?.user_lat ?? null,
                    lng:            data.intent?.user_lng ?? null,
                  }),
                })
                  .then(r => r.json())
                  .then((enrich: { inserted?: number }) => {
                    if ((enrich?.inserted ?? 0) > 0) {
                      // Pequeño delay para que el finally del SSE actual marque
                      // loading=false antes del retry.
                      setTimeout(() => sendMessage(message, { isRetry: true }), 120)
                    } else if ((dishLabel || cuisineLabel) && (data.alternatives_in_zone_count ?? 0) > 0) {
                      // Hay restaurants en zona pero ninguno satisface el
                      // plato/cocina pedido. Ofrecer opt-in para ver toda
                      // la oferta de la zona (ignora cuisine + dish).
                      onNoCuisineMatchInZone?.({
                        zone:               zoneLabel,
                        what:               (dishLabel ?? cuisineLabel)!,
                        kind:               dishLabel ? 'dish' : 'cuisine',
                        alternatives_count: data.alternatives_in_zone_count!,
                        query_original:     message,
                      })
                    } else {
                      onNoResults?.(data.intent ?? currentIntent, data.suggestions ?? [])
                    }
                  })
                  .catch(() => onNoResults?.(data.intent ?? currentIntent, data.suggestions ?? []))
              } else if (
                data.no_results_in_zone &&
                claudeReady &&
                opts?.isRetry &&
                (data.intent?.cuisine_type || data.intent?.dish_keyword) &&
                (data.alternatives_in_zone_count ?? 0) > 0
              ) {
                // Caso post-retry: tampoco hay matches específicos pero hay
                // alternativas en la zona. Ofrecer opt-in (dish > cuisine).
                const zoneLabel = data.intent?.zone ?? data.resolved_zone ?? 'esa zona'
                const dish = data.intent?.dish_keyword ?? null
                const cuisine = data.intent?.cuisine_type ?? null
                onNoCuisineMatchInZone?.({
                  zone:               zoneLabel,
                  what:               (dish ?? cuisine)!,
                  kind:               dish ? 'dish' : 'cuisine',
                  alternatives_count: data.alternatives_in_zone_count!,
                  query_original:     message,
                })
              } else if (data.searched_but_empty && claudeReady) {
                onNoResults?.(data.intent ?? currentIntent, data.suggestions ?? [])
              }

            } else if (event === 'error') {
              // Server emitió error explícito (Claude down, parse failure,
              // etc.). Mostramos mensaje del bot honesto en lugar de dejar
              // al user sin respuesta. Garantía: el chat NUNCA queda mudo.
              setWaiting(false)
              setChapiMessage(
                data?.message ??
                'Tuve un problema procesando tu pedido. ¿Podés decírmelo de otra forma? (Si pasa de nuevo, escribinos a hola@hichapi.cl)'
              )
              onStatusChange('')
            }
          }
        }
      }
    } catch (err) {
      // Network error, timeout, JSON parse de chunks, etc. Cualquier falla
      // que llegue acá igual le devuelve UNA respuesta al user para que
      // sepa qué pasó y cómo continuar.
      setWaiting(false)
      setChapiMessage(
        'Se cortó la conexión por un segundo. Intentá de nuevo en un ratito 🛠️'
      )
      onStatusChange('')
      console.error('[ChatBox] sendMessage failed:', err)
    } finally {
      setLoading(false)
      onLoadingChange?.(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  // Pills del intent capturado — feedback visual de "qué entendí". Solo
  // se muestran cuando hay AL MENOS un dato y Chapi ya respondió algo.
  const intentPills: { icon: string; text: string; captured: boolean }[] = (() => {
    const out: { icon: string; text: string; captured: boolean }[] = []
    const intentAny = intent as ChapiIntent & { dish_keyword?: string | null; zones?: string[] | null }

    // Dish específico (más específico que cuisine)
    const dish = intentAny.dish_keyword?.trim() || null
    if (dish) {
      out.push({ icon: '🥢', text: dish, captured: true })
    }
    // Cuisine general
    out.push({
      icon: '🍴',
      text: intent.cuisine_type ?? 'cocina',
      captured: !!intent.cuisine_type,
    })
    // Restricciones dietarias — pill por cada restricción capturada
    // (vegano, sin gluten, etc.). Importante para que el user verifique
    // que Chapi entendió bien "sin gluten + vegetariano" como dos cosas.
    for (const d of intent.dietary_restrictions ?? []) {
      out.push({ icon: '🌱', text: d, captured: true })
    }
    // Zona — multi-zona si hay >1
    const zonesArr = intentAny.zones && intentAny.zones.length > 0
      ? intentAny.zones
      : (intent.zone ? [intent.zone] : [])
    if (zonesArr.length > 1) {
      out.push({ icon: '📍', text: zonesArr.join(' o '), captured: true })
    } else {
      out.push({
        icon: '📍',
        text: zonesArr[0] ?? 'zona',
        captured: zonesArr.length > 0,
      })
    }
    out.push({
      icon: '💰',
      text: intent.budget_clp ? `${Math.round(intent.budget_clp / 1000)}k` : 'presupuesto',
      captured: !!intent.budget_clp,
    })
    return out
  })()
  const someIntentCaptured = intentPills.some(p => p.captured)

  return (
    <div className="w-full max-w-2xl mx-auto px-4">

      {/* Mensaje de Chapi — con dots mientras espera primer token */}
      <div className="mb-3 text-center min-h-[36px] flex items-center justify-center">
        {waitingFirstToken ? (
          <span
            className="text-sm text-neutral-500 bg-[var(--surface-sunken)] backdrop-blur-sm rounded-xl px-4 py-2 inline-flex items-center gap-1 border border-neutral-100"
          >
            <span className="font-medium text-[#E55A2B]">Chapi:</span>
            <TypingDots />
          </span>
        ) : chapiMessage ? (
          <p
            className="text-sm text-neutral-500 bg-[var(--surface-sunken)] backdrop-blur-sm rounded-xl px-4 py-2 inline-block border border-neutral-100"
          >
            <span className="font-medium text-[#E55A2B]">Chapi:</span>{' '}
            {chapiMessage}
          </p>
        ) : null}
      </div>

      {/* Pills del intent: "qué entendí, qué falta". Solo cuando hay
          conversación arrancada (chapiMessage) y al menos 1 dato capturado.
          Los capturados van fuertes; los faltantes en gris para señalar
          qué agregaría valor al pedirlo. */}
      {chapiMessage && someIntentCaptured && (
        <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
          <span className="text-[10px] text-[var(--text-muted)]">Chapi entendió:</span>
          {intentPills.map((p, i) => (
            <span
              key={i}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                p.captured
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-neutral-50 border-neutral-200 text-[var(--text-muted)]'
              }`}
              title={p.captured ? `${p.text} ✓` : `Falta: ${p.text}`}
            >
              {p.icon} {p.captured ? p.text : <span className="italic">{p.text}?</span>}
            </span>
          ))}
        </div>
      )}

      {/* Input box */}
      <div
        className="relative bg-white rounded-2xl shadow-lg border border-neutral-100 focus-within:border-[#FF6B35]/30 focus-within:shadow-xl transition-all duration-200"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="¿Qué quieres comer hoy? Cuéntale a Chapi..."
          rows={1}
          className="w-full resize-none bg-transparent px-5 pt-4 pb-3 pr-16 text-[#1A1A2E] placeholder:text-[var(--text-muted)] focus:outline-none text-base leading-relaxed"
          style={{ minHeight: '56px', maxHeight: '120px' }}
          onInput={e => {
            const t = e.target as HTMLTextAreaElement
            t.style.height = 'auto'
            t.style.height = Math.min(t.scrollHeight, 120) + 'px'
          }}
          autoFocus
        />

        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          className="absolute right-3 bottom-3 w-10 h-10 rounded-xl bg-[#FF6B35] hover:bg-[#e55a2b] disabled:bg-neutral-200 flex items-center justify-center transition-colors duration-150"
          aria-label="Enviar"
        >
          {loading
            ? <Loader2 size={18} className="text-[var(--text-strong)] animate-spin" />
            : <Send size={18} className="text-[var(--text-strong)]" />}
        </button>
      </div>

      {/* Chips */}
      {askingForZone ? (
        <div className="mt-3">
          <p className="text-[11px] text-[var(--text-muted)] text-center mb-2">¿En qué barrio?</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {(!defaultZone ? ZONE_CHIPS : ['Cerca de mí', `Centro de ${defaultZone}`]).map(zone => (
              <button
                key={zone}
                onClick={() => sendMessage(zone)}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-full bg-white border border-[#FF6B35]/30 text-[#E55A2B] font-medium hover:bg-[#FF6B35] hover:text-white disabled:opacity-50 transition-colors duration-150"
              >
                {zone}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mt-3 justify-center">
          {QUICK_CHIPS.map(chip => (
            <button
              key={chip}
              onClick={() => sendMessage(chip)}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-full bg-white border border-neutral-200 text-neutral-500 hover:border-[#FF6B35] hover:text-[#E55A2B] disabled:opacity-50 transition-colors duration-150"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Hint de ubicación */}
      {needsLocation && (
        <button
          onClick={() => sendMessage('usa mi ubicación actual')}
          className="mt-3 flex items-center gap-2 text-xs text-[#E55A2B] hover:underline mx-auto"
        >
          <MapPin size={12} />
          Usar mi ubicación actual
        </button>
      )}
    </div>
  )
}
