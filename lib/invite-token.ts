// ─────────────────────────────────────────────────────────────────────────────
// HiChapi · sistema de invite tokens stateless
//
// Bypass del flujo email→Supabase→redirect (que se rompe cuando Site URL
// apunta a un dominio sin DNS válido como hichapi.com parqueado en GoDaddy).
//
// Estrategia:
// 1. Server genera un token firmado con HMAC-SHA256 usando SUPABASE_SERVICE_ROLE_KEY.
// 2. Token contiene { email, restaurant_id, role, exp } en base64url.
// 3. Email lleva link a {OUR_APP}/aceptar-invitacion?t=TOKEN — apunta SIEMPRE
//    a nuestro dominio, no al Site URL de Supabase.
// 4. Endpoint /api/auth/accept-invite verifica el token y devuelve magic-link
//    real de Supabase para crear sesión.
//
// Ventajas:
// - No depende de la config de Supabase Auth (Site URL, Allow-List).
// - No dependemos del SMTP rate limit de Supabase (lo manda Resend).
// - Tokens duran 7 días (más generoso que el OTP de 1 hora de Supabase).
// - Verificable y revocable sin tabla extra.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto'

interface InvitePayload {
  email:         string
  restaurant_id: string
  role:          string
  full_name?:    string
  phone?:        string
  exp:           number  // Unix timestamp (segundos)
  iat:           number  // Issued at
  nonce:         string  // 8 random bytes hex (single-use deterrent)
}

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? process.env.HICHAPI_INVITE_SECRET
  ?? 'fallback-dev-secret-do-not-use-in-prod'

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Buffer {
  const pad = (4 - (str.length % 4)) % 4
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  return Buffer.from(padded, 'base64')
}

function sign(payload: string): string {
  return base64UrlEncode(
    crypto.createHmac('sha256', SECRET).update(payload).digest(),
  )
}

/**
 * Genera un token firmado para invitar a `email` a `restaurant_id` con `role`.
 * Vigencia por defecto: 7 días.
 */
export function createInviteToken(opts: {
  email:         string
  restaurant_id: string
  role:          string
  full_name?:    string
  phone?:        string
  ttlSeconds?:   number  // default 7 días
}): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: InvitePayload = {
    email:         opts.email.trim().toLowerCase(),
    restaurant_id: opts.restaurant_id,
    role:          opts.role,
    full_name:     opts.full_name,
    phone:         opts.phone,
    exp:           now + (opts.ttlSeconds ?? 7 * 24 * 3600),
    iat:           now,
    nonce:         crypto.randomBytes(8).toString('hex'),
  }
  const payloadStr = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = sign(payloadStr)
  return `${payloadStr}.${sig}`
}

export interface VerifiedInvite {
  email:         string
  restaurant_id: string
  role:          string
  full_name?:    string
  phone?:        string
  exp:           number
  iat:           number
}

/**
 * Verifica firma + expiración. Retorna el payload o un código de error.
 */
export function verifyInviteToken(token: string):
  | { ok: true; payload: VerifiedInvite }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' } {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, reason: 'malformed' }
  }
  const [payloadStr, sig] = token.split('.', 2)
  if (!payloadStr || !sig) return { ok: false, reason: 'malformed' }

  const expectedSig = sign(payloadStr)
  // timing-safe comparison
  if (sig.length !== expectedSig.length) return { ok: false, reason: 'bad_signature' }
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return { ok: false, reason: 'bad_signature' }
    }
  } catch {
    return { ok: false, reason: 'bad_signature' }
  }

  let payload: InvitePayload
  try {
    payload = JSON.parse(base64UrlDecode(payloadStr).toString('utf8')) as InvitePayload
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) return { ok: false, reason: 'expired' }

  return {
    ok: true,
    payload: {
      email:         payload.email,
      restaurant_id: payload.restaurant_id,
      role:          payload.role,
      full_name:     payload.full_name,
      phone:         payload.phone,
      exp:           payload.exp,
      iat:           payload.iat,
    },
  }
}
