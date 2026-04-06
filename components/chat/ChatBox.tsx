'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { Send, Loader2, MapPin } from 'lucide-react'
import { ChapiIntent, RestaurantResult } from '@/lib/types'

const QUICK_CHIPS = [
  'Sin gluten cerca de mí',
  'Vegano en Providencia',
  'Algo rico por menos de 15 lucas',
  'Japonés en Barrio Italia',
  'Para almorzar hoy',
]

interface ChatBoxProps {
  onResults: (results: RestaurantResult[], query: string) => void
  onStatusChange: (status: string) => void
  onLoadingChange?: (loading: boolean) => void
  onNoResults?: (intent: ChapiIntent) => void
}

// ── Typing dots animation ────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]"
          style={{
            animation: 'chapi-bounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes chapi-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </span>
  )
}

export function ChatBox({ onResults, onStatusChange, onLoadingChange, onNoResults }: ChatBoxProps) {
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [waitingFirstToken, setWaiting] = useState(false)  // #1 — loading indicator
  const [intent, setIntent]             = useState<ChapiIntent>({})
  const [chapiMessage, setChapiMessage] = useState('')
  const [needsLocation, setNeedsLocation] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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

  async function sendMessage(message: string) {
    if (!message.trim() || loading) return

    setLoading(true)
    setWaiting(true)       // show dots immediately
    onLoadingChange?.(true)
    setInput('')
    onStatusChange('')
    setChapiMessage('')

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
        body: JSON.stringify({ message, intent: currentIntent }),
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

              if (data.results?.length > 0) {
                onResults(data.results, message)
                onStatusChange('')
              } else if (data.searched_but_empty) {
                // #3 — searched but found nothing → notify parent
                onNoResults?.(data.intent ?? currentIntent)
              }

            } else if (event === 'error') {
              setWaiting(false)
              onStatusChange(data.message)
            }
          }
        }
      }
    } catch {
      setWaiting(false)
      onStatusChange('Algo salió mal. Intenta de nuevo.')
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

  return (
    <div className="w-full max-w-2xl mx-auto px-4">

      {/* Mensaje de Chapi — con dots mientras espera primer token */}
      <div className="mb-3 text-center min-h-[36px] flex items-center justify-center">
        {waitingFirstToken ? (
          <span
            className="text-sm text-neutral-500 bg-white/60 backdrop-blur-sm
                       rounded-xl px-4 py-2 inline-flex items-center gap-1
                       border border-neutral-100"
          >
            <span className="font-medium text-[#FF6B35]">Chapi</span>
            <TypingDots />
          </span>
        ) : chapiMessage ? (
          <p
            className="text-sm text-neutral-500 bg-white/60 backdrop-blur-sm
                       rounded-xl px-4 py-2 inline-block border border-neutral-100"
          >
            <span className="font-medium text-[#FF6B35]">Chapi:</span>{' '}
            {chapiMessage}
          </p>
        ) : null}
      </div>

      {/* Input box */}
      <div
        className="relative bg-white rounded-2xl shadow-lg border border-neutral-100
                   focus-within:border-[#FF6B35]/30 focus-within:shadow-xl
                   transition-all duration-200"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="¿Qué quieres comer hoy? Cuéntale a Chapi..."
          rows={1}
          className="w-full resize-none bg-transparent px-5 pt-4 pb-3 pr-16
                     text-[#1A1A2E] placeholder:text-neutral-300
                     focus:outline-none text-base leading-relaxed"
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
          className="absolute right-3 bottom-3 w-10 h-10 rounded-xl
                     bg-[#FF6B35] hover:bg-[#e55a2b] disabled:bg-neutral-200
                     flex items-center justify-center transition-colors duration-150"
          aria-label="Enviar"
        >
          {loading
            ? <Loader2 size={18} className="text-white animate-spin" />
            : <Send size={18} className="text-white" />}
        </button>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {QUICK_CHIPS.map(chip => (
          <button
            key={chip}
            onClick={() => sendMessage(chip)}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-full bg-white border border-neutral-200
                       text-neutral-500 hover:border-[#FF6B35] hover:text-[#FF6B35]
                       disabled:opacity-50 transition-colors duration-150"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Hint de ubicación */}
      {needsLocation && (
        <button
          onClick={() => sendMessage('usa mi ubicación actual')}
          className="mt-3 flex items-center gap-2 text-xs text-[#FF6B35] hover:underline mx-auto"
        >
          <MapPin size={12} />
          Usar mi ubicación actual
        </button>
      )}
    </div>
  )
}
