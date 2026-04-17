export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRestaurantRole } from '@/lib/supabase/auth-guard'
import { encrypt, isCryptoConfigured } from '@/lib/crypto/aes'
import * as forge from 'node-forge'

// ── Extract metadata from PFX buffer ─────────────────────────────────────────
function extractPfxMeta(pfxBuf: Buffer, password: string): {
  cert_subject:    string | null
  cert_issuer:     string | null
  cert_valid_from: string | null
  cert_valid_to:   string | null
  rut_envia:       string | null
  dte_environment: 'certification' | 'production' | null
} | { error: string } {
  try {
    const p12Der  = forge.util.createBuffer(pfxBuf.toString('binary'))
    const p12Asn1 = forge.asn1.fromDer(p12Der)
    const p12     = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const bags     = certBags[forge.pki.oids.certBag]
    if (!bags || bags.length === 0) {
      return { 
        cert_subject: null, 
        cert_issuer: null, 
        cert_valid_from: null, 
        cert_valid_to: null,
        rut_envia: null,
        dte_environment: null
      }
    }

    const cert = bags[0].cert!
    
    // Extract RUT from certificate (same logic as extractRutFromCert in signer.ts)
    const rutEnvia = extractRutFromCertificate(cert)
    
    // Detect environment from certificate issuer
    const dteEnvironment = detectEnvironmentFromCert(cert)
    
    return {
      cert_subject:    cert.subject.getField('CN')?.value ?? null,
      cert_issuer:     cert.issuer.getField('CN')?.value  ?? null,
      cert_valid_from: cert.validity.notBefore.toISOString(),
      cert_valid_to:   cert.validity.notAfter.toISOString(),
      rut_envia:       rutEnvia,
      dte_environment: dteEnvironment,
    }
  } catch (e: any) {
    // node-forge throws when password is wrong
    const msg: string = e?.message ?? ''
    if (msg.includes('Invalid password') || msg.includes('PKCS12') || msg.includes('mac verify')) {
      return { error: 'Contraseña incorrecta para este certificado' }
    }
    console.warn('PFX metadata extraction failed:', e)
    return { error: 'No se pudo leer el certificado. Verifica que sea un archivo .pfx/.p12 válido.' }
  }
}

// ── Extract RUT from certificate ─────────────────────────────────────────────
function extractRutFromCertificate(cert: forge.pki.Certificate): string | null {
  // Strategy 1: scan all subject fields for a RUT pattern
  try {
    for (const attr of cert.subject.attributes) {
      const val = String(attr.value ?? '')
      const m = /(\d{7,8}-[\dkK])/.exec(val)
      if (m) return m[1]
    }
  } catch { /* ignore */ }

  // Strategy 2: scan SAN altNames
  try {
    const sanExt = cert.getExtension('subjectAltName') as { altNames?: Array<{ type: number; value: string }> } | null
    if (sanExt?.altNames) {
      for (const alt of sanExt.altNames) {
        const val = String(alt.value ?? '')
        const m = /(\d{7,8}-[\dkK])/.exec(val)
        if (m) return m[1]
      }
    }
  } catch { /* ignore */ }

  // Strategy 3: convert cert to PEM and scan the decoded text for RUT pattern
  try {
    const der   = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).bytes()
    const b64   = forge.util.encode64(der)
    const raw   = Buffer.from(b64, 'base64').toString('latin1')
    const m     = /(\d{7,8}-[\dkK])/.exec(raw)
    if (m) return m[1]
  } catch { /* ignore */ }

  console.warn('extractRutFromCertificate: could not extract RUT')
  return null
}

// ── Detect environment from certificate ──────────────────────────────────────
function detectEnvironmentFromCert(cert: forge.pki.Certificate): 'certification' | 'production' | null {
  try {
    // Check issuer CN for certification keywords
    const issuerCN = cert.issuer.getField('CN')?.value?.toString().toLowerCase() ?? ''
    const issuerO  = cert.issuer.getField('O')?.value?.toString().toLowerCase() ?? ''
    const issuerOU = cert.issuer.getField('OU')?.value?.toString().toLowerCase() ?? ''
    
    const issuerText = `${issuerCN} ${issuerO} ${issuerOU}`
    
    // Certification environment indicators
    if (issuerText.includes('certificacion') || 
        issuerText.includes('certification') ||
        issuerText.includes('test') ||
        issuerText.includes('prueba') ||
        issuerText.includes('demo')) {
      return 'certification'
    }
    
    // Production environment indicators
    if (issuerText.includes('produccion') || 
        issuerText.includes('production') ||
        issuerText.includes('e-sign') ||
        issuerText.includes('esign')) {
      return 'production'
    }
    
    // Check subject for environment hints
    const subjectCN = cert.subject.getField('CN')?.value?.toString().toLowerCase() ?? ''
    if (subjectCN.includes('certificacion') || subjectCN.includes('test')) {
      return 'certification'
    }
    
    // Default to production if no certification indicators found
    return 'production'
  } catch (e) {
    console.warn('detectEnvironmentFromCert: could not detect environment:', e)
    return null
  }
}

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
  restaurant_id:     z.string().uuid(),
  cert_base64:       z.string().min(20),    // PFX bytes, base64
  cert_password:     z.string().min(1).max(200),
  cert_subject:      z.string().max(200).optional(),
  cert_issuer:       z.string().max(200).optional(),
  cert_valid_from:   z.string().datetime().optional(),
  cert_valid_to:     z.string().datetime().optional(),
  rut_envia:         z.string().max(20).optional(),
  fecha_resolucion:  z.string().optional(),  // ISO date string
  numero_resolucion: z.number().int().optional(),
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

  // Extract and validate metadata from PFX — fails fast if password is wrong
  const meta = extractPfxMeta(certBuf, body.cert_password)
  if ('error' in meta) {
    return NextResponse.json({ error: meta.error }, { status: 400 })
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
        // Use extracted metadata, fall back to manually provided values
        cert_subject:    meta.cert_subject    ?? body.cert_subject    ?? null,
        cert_issuer:     meta.cert_issuer     ?? body.cert_issuer     ?? null,
        cert_valid_from: meta.cert_valid_from ?? body.cert_valid_from ?? null,
        cert_valid_to:   meta.cert_valid_to   ?? body.cert_valid_to   ?? null,
        // Auto-extracted fields from certificate
        rut_envia:       meta.rut_envia       ?? body.rut_envia       ?? null,
        dte_environment: meta.dte_environment ?? null,
        // PHP bridge fields (stored in plain text for PHP LibreDTE)
        cert_base64:     body.cert_base64,
        cert_password:   body.cert_password,
        fecha_resolucion: body.fecha_resolucion ?? null,
        numero_resolucion: body.numero_resolucion ?? null,
        uploaded_by:     user.id,
        rotated_at:      new Date().toISOString(),
      },
      { onConflict: 'restaurant_id' }
    )

  if (dbErr) {
    console.error('dte/credentials upsert error:', dbErr)
    return NextResponse.json({ error: 'No se pudo guardar el certificado' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, meta })
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
    .select('cert_subject, cert_issuer, cert_valid_from, cert_valid_to, rut_envia, dte_environment, uploaded_at, rotated_at')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  // Optionally include dte_environment from the restaurant record (used by the DTE panel header badge)
  const includeEnv = req.nextUrl.searchParams.get('include_env') === '1'
  let restaurant_dte_environment: string | null = null
  if (includeEnv) {
    const { data: rest } = await supabase
      .from('restaurants')
      .select('dte_environment')
      .eq('id', restaurantId)
      .maybeSingle()
    restaurant_dte_environment = rest?.dte_environment ?? null
  }

  return NextResponse.json({
    credential: data,
    ...(includeEnv ? { restaurant_dte_environment } : {}),
  })
}
