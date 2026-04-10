import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { encrypt, isCryptoConfigured } from '@/lib/crypto/aes'

// ══════════════════════════════════════════════════════════════════════════════
//  POST /api/dte/credentials
//
//  Stores an SII certificate (PFX, base64-encoded by the caller) and its
//  password, both AES-256-GCM encrypted at rest. Only restaurant owners may
//  upload credentials. The plaintext PFX never touches disk and is never
//  written to logs — we accept it inline, encrypt, persist ciphertext, drop.
//
//  GET returns metadata only (subject, expiry) — never the cert itself.
// ══════════════════════════════════════════════════════════════════════════════

const PostSchema = z.object({
  restaurant_id:   z.string().uuid(),
  cert_base64:     z.string().min(20),    // PFX bytes, base64
  cert_password:   z.string().min(1).max(200),
  cert_subject:    z.string().max(200).optional(),
  cert_issuer:     z.string().max(200).optional(),
  cert_valid_from: z.string().datetime().optional(),
  cert_valid_to:   z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  if (!isCryptoConfigured()) {
    return NextResponse.json(
      { error: 'DTE_MASTER_KEY no configurada — contacta a soporte para habilitar DTE' },
      { status: 503 }
    )
  }

  let body: z.infer<typeof PostSchema>
  try {
    body = PostSchema.parse(await req.json())
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { user, error: authErr } = await requireRestaurantRole(body.restaurant_id, ['owner'])
  if (authErr || !user) return authErr ?? NextResponse.json({ error: 'No auth' }, { status: 401 })

  // Encrypt cert PFX and password
  const certBuf = Buffer.from(body.cert_base64, 'base64')
  if (certBuf.length === 0) {
    return NextResponse.json({ error: 'Certificado vacío o base64 inválido' }, { status: 400 })
  }
  const certBlob = encrypt(certBuf)
  const passBlob = encrypt(body.cert_password)

  const supabase = createAdminClient()

  // Upsert (one credential per restaurant)
  const { error: dbErr } = await supabase
    .from('dte_credentials')
    .upsert(
      {
        restaurant_id:   body.restaurant_id,
        cert_ciphertext: certBlob.ciphertext,
        cert_iv:         certBlob.iv,
        cert_auth_tag:   certBlob.authTag,
        pass_ciphertext: passBlob.ciphertext,
        pass_iv:         passBlob.iv,
        pass_auth_tag:   passBlob.authTag,
        cert_subject:    body.cert_subject ?? null,
        cert_issuer:     body.cert_issuer ?? null,
        cert_valid_from: body.cert_valid_from ?? null,
        cert_valid_to:   body.cert_valid_to ?? null,
        uploaded_by:     user.id,
        rotated_at:      new Date().toISOString(),
      },
      { onConflict: 'restaurant_id' }
    )

  if (dbErr) {
    console.error('dte/credentials upsert error:', dbErr)
    return NextResponse.json({ error: 'No se pudo guardar el certificado' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurant_id')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurant_id requerido' }, { status: 400 })
  }

  const { error: authErr } = await requireRestaurantRole(restaurantId, ['owner', 'admin'])
  if (authErr) return authErr

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('dte_credentials')
    .select('cert_subject, cert_issuer, cert_valid_from, cert_valid_to, uploaded_at, rotated_at')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  return NextResponse.json({ credential: data })
}
