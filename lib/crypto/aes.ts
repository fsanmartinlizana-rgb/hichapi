import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

// ══════════════════════════════════════════════════════════════════════════════
//  AES-256-GCM helpers for at-rest secrets (DTE certs, API keys, etc.)
//
//  Storage layout: every encrypted value is split into three base64 strings —
//  ciphertext, IV (12 bytes), and auth tag (16 bytes). They live in three
//  columns so we never accidentally rely on a delimiter.
//
//  Master key: read from `DTE_MASTER_KEY` env var. Any string is accepted; we
//  derive a 32-byte key via SHA-256 so the operator can supply a passphrase.
//  In production this should be a 256-bit base64 secret rotated via env.
// ══════════════════════════════════════════════════════════════════════════════

const ALGORITHM   = 'aes-256-gcm'
const IV_BYTES    = 12
const KEY_ENV_VAR = 'DTE_MASTER_KEY'

export interface EncryptedBlob {
  ciphertext: string  // base64
  iv:         string  // base64
  authTag:    string  // base64
}

function getKey(): Buffer {
  const raw = process.env[KEY_ENV_VAR]
  if (!raw) {
    throw new Error(`${KEY_ENV_VAR} no está configurada — no se puede cifrar/descifrar credenciales DTE`)
  }
  // Derive 32-byte key from any-length input
  return createHash('sha256').update(raw, 'utf8').digest()
}

/** Encrypts a Buffer (or string treated as utf8) and returns three base64 parts. */
export function encrypt(plaintext: string | Buffer): EncryptedBlob {
  const key    = getKey()
  const iv     = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const input = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext
  const ct    = Buffer.concat([cipher.update(input), cipher.final()])
  const tag   = cipher.getAuthTag()

  return {
    ciphertext: ct.toString('base64'),
    iv:         iv.toString('base64'),
    authTag:    tag.toString('base64'),
  }
}

/** Decrypts an EncryptedBlob back to a Buffer. Throws on tampering. */
export function decrypt(blob: EncryptedBlob): Buffer {
  const key       = getKey()
  const iv        = Buffer.from(blob.iv,         'base64')
  const ct        = Buffer.from(blob.ciphertext, 'base64')
  const authTag   = Buffer.from(blob.authTag,    'base64')
  const decipher  = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ct), decipher.final()])
}

/** Convenience: decrypt to utf8 string. */
export function decryptString(blob: EncryptedBlob): string {
  return decrypt(blob).toString('utf8')
}

/** True if DTE_MASTER_KEY is set — for graceful UI fallbacks. */
export function isCryptoConfigured(): boolean {
  return !!process.env[KEY_ENV_VAR]
}
