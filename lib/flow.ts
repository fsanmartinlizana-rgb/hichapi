import crypto from 'crypto'

const FLOW_API_KEY    = process.env.FLOW_API_KEY || ''
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY || ''
const FLOW_BASE_URL   = process.env.FLOW_ENV === 'production' 
  ? 'https://www.flow.cl/api' 
  : 'https://sandbox.flow.cl/api'

/**
 * Genera la firma requerida por Flow.
 * Concatena llaves y valores ordenados alfabéticamente.
 */
export function signFlowParams(params: Record<string, string | number>): string {
  const sortedKeys = Object.keys(params).sort()
  let toSign = ''
  for (const key of sortedKeys) {
    toSign += String(key) + String(params[key])
  }
  return crypto.createHmac('sha256', FLOW_SECRET_KEY).update(toSign).digest('hex')
}

/**
 * Realiza una petición GET a la API de Flow (e.g. /payment/getStatus).
 * Los parámetros se envían como query string firmados con HMAC-SHA256.
 */
export async function flowGet<T>(endpoint: string, params: Record<string, string | number>): Promise<T> {
  if (!FLOW_API_KEY || !FLOW_SECRET_KEY) {
    throw new Error('Faltan variables de entorno FLOW_API_KEY o FLOW_SECRET_KEY')
  }

  const payload = { ...params, apiKey: FLOW_API_KEY }
  const signature = signFlowParams(payload)

  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(payload)) {
    qs.append(k, String(v))
  }
  qs.append('s', signature)

  const res = await fetch(`${FLOW_BASE_URL}${endpoint}?${qs.toString()}`, {
    method: 'GET',
  })

  const text = await res.text()

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Flow API Error: No valid JSON returned. Response: ${text}`)
  }

  if (data.code && data.message) {
    throw new Error(`Flow API Error (${data.code}): ${data.message}`)
  }

  return data as T
}

export async function flowRequest<T>(endpoint: string, params: Record<string, string | number>): Promise<T> {
  if (!FLOW_API_KEY || !FLOW_SECRET_KEY) {
    throw new Error('Faltan variables de entorno FLOW_API_KEY o FLOW_SECRET_KEY')
  }

  const payload = { ...params, apiKey: FLOW_API_KEY }
  const signature = signFlowParams(payload)
  
  const form = new URLSearchParams()
  for (const [k, v] of Object.entries(payload)) {
    form.append(k, String(v))
  }
  form.append('s', signature)

  const res = await fetch(`${FLOW_BASE_URL}${endpoint}`, {
    method: 'POST',
    body: form,
  })

  const text = await res.text()
  
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Flow API Error: No valid JSON returned. Response: ${text}`)
  }

  if (data.code && data.message) {
    throw new Error(`Flow API Error (${data.code}): ${data.message}`)
  }

  return data as T
}
