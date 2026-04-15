// ─────────────────────────────────────────────────────────────────────────────
// HiChapi · Multi-provider AI chat abstraction with automatic fallback.
//
// Prioridad: Claude (Anthropic) → OpenAI → Gemini (Google) → error gracioso.
//
// Uso:
//   const res = await chatCompletion({
//     system:   'Eres Chapi...',
//     messages: [{ role: 'user', content: 'hola' }],
//     jsonMode: true,
//   })
//   // res.text, res.provider, res.fallback
//
// Cada provider se skippea silenciosamente si su API key no está configurada.
// Si todos los providers fallan → throw AiUnavailableError con detalles.
//
// Configuración:
//   ANTHROPIC_API_KEY     — Claude (primario)
//   OPENAI_API_KEY        — OpenAI (fallback 1)
//   GOOGLE_AI_API_KEY     — Gemini (fallback 2)
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'

export type AiRole = 'user' | 'assistant'

export interface AiMessage {
  role:    AiRole
  content: string
}

export interface ChatOptions {
  system:       string
  messages:     AiMessage[]
  maxTokens?:   number             // default 1024
  temperature?: number             // default 0.7
  jsonMode?:    boolean            // force JSON-mode when the provider supports it
}

export type AiProvider = 'claude' | 'openai' | 'gemini'

export interface ChatResult {
  text:       string               // Full text response
  provider:   AiProvider           // Which provider answered
  fallback:   boolean              // true if primary (Claude) failed and we fell back
  attempts:   Array<{ provider: AiProvider; error?: string }>  // Trace for diagnostics
}

export class AiUnavailableError extends Error {
  attempts: Array<{ provider: AiProvider; error: string }>
  constructor(attempts: Array<{ provider: AiProvider; error: string }>) {
    super(`Todos los proveedores de IA fallaron: ${attempts.map(a => `${a.provider}=${a.error}`).join('; ')}`)
    this.name = 'AiUnavailableError'
    this.attempts = attempts
  }
}

// ── Provider 1: Claude (Anthropic) ───────────────────────────────────────────

async function tryClaude(opts: ChatOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing')

  const client = new Anthropic({ apiKey })
  const res = await client.messages.create({
    model:       process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5-20250929',
    max_tokens:  opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    system:      opts.system,
    messages:    opts.messages.map(m => ({ role: m.role, content: m.content })),
  })

  const block = res.content.find(b => b.type === 'text') as { type: 'text'; text: string } | undefined
  if (!block) throw new Error('Claude returned no text block')
  return block.text
}

// ── Provider 2: OpenAI ───────────────────────────────────────────────────────

async function tryOpenAI(opts: ChatOptions): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY missing')

  const payload: Record<string, unknown> = {
    model:       process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    messages: [
      { role: 'system', content: opts.system },
      ...opts.messages.map(m => ({ role: m.role, content: m.content })),
    ],
    max_tokens:  opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
  }
  if (opts.jsonMode) payload.response_format = { type: 'json_object' }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }
  const body = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  const text = body.choices?.[0]?.message?.content
  if (!text) throw new Error('OpenAI returned empty content')
  return text
}

// ── Provider 3: Google Gemini ────────────────────────────────────────────────

async function tryGemini(opts: ChatOptions): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY missing')

  const model = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash-latest'

  // Gemini usa formato "contents" — convertimos
  const contents = opts.messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const payload: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents,
    generationConfig: {
      temperature:     opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens   ?? 1024,
      ...(opts.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }
  const body = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty content')
  return text
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

const PROVIDER_ORDER: Array<{ name: AiProvider; fn: (o: ChatOptions) => Promise<string> }> = [
  { name: 'claude', fn: tryClaude },
  { name: 'openai', fn: tryOpenAI },
  { name: 'gemini', fn: tryGemini },
]

/**
 * Ejecuta el chat con cadena de fallback. Si un provider falla, loguea y pasa
 * al siguiente. Siempre retorna un resultado o lanza AiUnavailableError si
 * todos los providers configurados fallaron.
 */
export async function chatCompletion(opts: ChatOptions): Promise<ChatResult> {
  const attempts: Array<{ provider: AiProvider; error?: string }> = []

  for (let i = 0; i < PROVIDER_ORDER.length; i++) {
    const { name, fn } = PROVIDER_ORDER[i]
    try {
      const text = await fn(opts)
      // Éxito — loguear si fue fallback
      if (i > 0) {
        console.warn(`[ai] Fallback success: provider=${name} after ${i} failure(s): ${attempts.map(a => `${a.provider}:${a.error}`).join(', ')}`)
      }
      attempts.push({ provider: name })
      return {
        text,
        provider: name,
        fallback: i > 0,
        attempts,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Si es simplemente "missing key", no es un fallo real — continuamos silenciosamente
      const isMissingKey = /missing$/i.test(msg)
      if (!isMissingKey) {
        console.error(`[ai] Provider ${name} failed: ${msg}`)
      }
      attempts.push({ provider: name, error: msg })
    }
  }

  throw new AiUnavailableError(
    attempts.filter((a): a is { provider: AiProvider; error: string } => !!a.error),
  )
}

/**
 * Diagnóstico: qué providers están configurados.
 */
export function aiProviderStatus(): Array<{ provider: AiProvider; configured: boolean }> {
  return [
    { provider: 'claude', configured: !!process.env.ANTHROPIC_API_KEY },
    { provider: 'openai', configured: !!process.env.OPENAI_API_KEY },
    { provider: 'gemini', configured: !!(process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY) },
  ]
}

/**
 * Extrae un JSON robusto de la respuesta del modelo: acepta markdown blocks,
 * texto previo o posterior, y retorna null si no encuentra JSON válido.
 */
export function extractJson<T = unknown>(raw: string): T | null {
  // 1. Remover markdown blocks
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  // 2. Buscar el primer { o [ y hacer match balanceado
  const firstBrace = Math.min(
    text.indexOf('{') === -1 ? Infinity : text.indexOf('{'),
    text.indexOf('[') === -1 ? Infinity : text.indexOf('['),
  )
  if (firstBrace === Infinity) return null

  const candidate = text.slice(firstBrace)
  try {
    return JSON.parse(candidate) as T
  } catch {
    // Intentar recortar al último cierre balanceado
    const open = candidate[0]
    const close = open === '{' ? '}' : ']'
    let depth = 0
    for (let i = 0; i < candidate.length; i++) {
      if (candidate[i] === open) depth++
      else if (candidate[i] === close) {
        depth--
        if (depth === 0) {
          try { return JSON.parse(candidate.slice(0, i + 1)) as T } catch { /* continue */ }
        }
      }
    }
    return null
  }
}
