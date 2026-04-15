import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/supabase/auth-guard'
import { z } from 'zod'

// ── POST /api/upload/signed ─────────────────────────────────────────────────
// Creates a *signed upload URL* so the client can PUT the file directly to
// Supabase Storage. This avoids Vercel's 4.5MB serverless function body limit
// (error 413 "FUNCTION_PAYLOAD_TOO_LARGE") for larger photos.
// Flow:
//   1. Client POSTs { bucket, folder, ext, mime } → this route.
//   2. Route returns { uploadUrl, token, path, publicUrl }.
//   3. Client uploads the file directly via supabase.storage.uploadToSignedUrl.

const BodySchema = z.object({
  bucket: z.string().default('restaurant-photos'),
  folder: z.string().default('photos'),
  ext:    z.string().max(10).default('jpg'),
  mime:   z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
})

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB ceiling at the storage level

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireUser()
  if (authErr || !user) {
    return authErr ?? NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = BodySchema.parse(await req.json())
    const supabase = createAdminClient()

    // Ensure bucket exists (idempotent)
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.find((b: { name: string }) => b.name === body.bucket)) {
      await supabase.storage.createBucket(body.bucket, {
        public: true,
        fileSizeLimit: MAX_SIZE,
        allowedMimeTypes: ALLOWED_MIME,
      })
    }

    const path = `${body.folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${body.ext}`

    // Create signed upload URL (valid ~60s)
    const { data: signed, error: signErr } = await supabase.storage
      .from(body.bucket)
      .createSignedUploadUrl(path)

    if (signErr || !signed) {
      console.error('signed-url error:', signErr)
      return NextResponse.json({ error: 'No se pudo generar URL firmada' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from(body.bucket).getPublicUrl(path)

    return NextResponse.json({
      uploadUrl: signed.signedUrl,
      token:     signed.token,
      path,
      publicUrl: urlData.publicUrl,
      bucket:    body.bucket,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    console.error('POST /api/upload/signed error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
