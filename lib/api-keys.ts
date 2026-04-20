// ── API key helpers ─────────────────────────────────────────────────────────
// Sprint 5 (2026-04-19).
//
// Formato de key: "hc_{live|test}_{16 random chars}". El prefix (hc_live_XXXXXXXX,
// 16 chars incluido el _) se muestra al user para identificar la key; el resto
// nunca se guarda en claro, solo el SHA-256 del string completo.

import { createHash, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'

export interface ApiKeyRecord {
  id:            string
  restaurant_id: string
  name:          string
  prefix:        string
  scopes:        string[]
  rate_limit:    number
  expires_at:    string | null
  revoked_at:    string | null
}

const KEY_PREFIX = 'hc_live_'
const SECRET_LEN = 32 // chars después del prefix

export function generateKey(): { secret: string; prefix: string; secretHash: string } {
  const bytes = randomBytes(SECRET_LEN)
  const body  = bytes.toString('base64url').slice(0, SECRET_LEN)
  const secret = `${KEY_PREFIX}${body}`
  const prefix = secret.slice(0, 16) // hc_live_XXXXXXXX
  const secretHash = createHash('sha256').update(secret).digest('hex')
  return { secret, prefix, secretHash }
}

export function hashKey(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

export interface ValidatedKey {
  record:        ApiKeyRecord
  withinLimit:   boolean
  requestsInMin: number
}

/**
 * Valida una key contra la DB. Chequea:
 *   1. formato "hc_live_…"
 *   2. prefix matchea + secret hash matchea
 *   3. no está revocada y no expiró
 *   4. rate_limit no excedido en últimos 60s
 * Si todo OK, también actualiza last_used_at (best-effort).
 */
export async function validateApiKey(
  authHeader: string | null,
): Promise<{ key: ValidatedKey | null; error?: string }> {
  if (!authHeader) return { key: null, error: 'Missing Authorization header' }

  const secret = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : authHeader.trim()
  if (!secret.startsWith(KEY_PREFIX)) return { key: null, error: 'Invalid key format' }

  const prefix = secret.slice(0, 16)
  const hash   = hashKey(secret)
  const supabase = createAdminClient()

  const { data: row } = await supabase
    .from('api_keys')
    .select('id, restaurant_id, name, prefix, secret_hash, scopes, rate_limit, expires_at, revoked_at')
    .eq('prefix', prefix)
    .maybeSingle()

  const record = row as (ApiKeyRecord & { secret_hash: string }) | null
  if (!record)                                return { key: null, error: 'Key not found' }
  if (record.secret_hash !== hash)            return { key: null, error: 'Invalid key' }
  if (record.revoked_at)                      return { key: null, error: 'Key revoked' }
  if (record.expires_at && new Date(record.expires_at).getTime() < Date.now()) {
    return { key: null, error: 'Key expired' }
  }

  // Rate limit: count requests in last 60s
  const since = new Date(Date.now() - 60_000).toISOString()
  const { count } = await supabase
    .from('api_request_log')
    .select('id', { count: 'exact', head: true })
    .eq('api_key_id', record.id)
    .gte('created_at', since)

  const requestsInMin = count ?? 0
  const withinLimit = requestsInMin < record.rate_limit

  // Best-effort update last_used_at (no await para no bloquear la request)
  void supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', record.id)

  return {
    key: { record, withinLimit, requestsInMin },
  }
}

/** Log de request (audit + rate limit). Fire-and-forget. */
export function logApiRequest(params: {
  apiKeyId:   string
  method:     string
  path:       string
  statusCode: number
  durationMs: number
  ip?:        string
}) {
  const supabase = createAdminClient()
  void supabase
    .from('api_request_log')
    .insert({
      api_key_id:  params.apiKeyId,
      method:      params.method,
      path:        params.path,
      status_code: params.statusCode,
      duration_ms: params.durationMs,
      ip:          params.ip ?? null,
    })
}

export function hasScope(key: ApiKeyRecord, scope: string): boolean {
  return key.scopes.includes(scope) || key.scopes.includes('*')
}
