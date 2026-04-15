/**
 * uploadImage — client-side helper to upload an image to Supabase Storage
 * bypassing Vercel's 4.5 MB serverless function body limit.
 *
 * Strategy:
 *   1. Compress the image client-side (canvas) to ≤ MAX_SIZE.
 *   2. Ask /api/upload/signed for a signed upload URL.
 *   3. PUT the (compressed) file directly to Supabase Storage.
 *
 * Returns the public URL on success, throws on failure.
 */

import { createClient } from '@/lib/supabase/client'

const MAX_SIZE_BEFORE_COMPRESS = 4 * 1024 * 1024   // 4 MB — anything larger triggers compression
const TARGET_MAX_DIMENSION      = 1920             // px — longest side after resize
const COMPRESS_QUALITY          = 0.82             // JPEG quality

async function compressImage(file: File): Promise<File> {
  if (file.size <= MAX_SIZE_BEFORE_COMPRESS && file.type === 'image/jpeg') {
    return file
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = e => { img.src = e.target?.result as string }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    img.onload = () => {
      const ratio = Math.min(1, TARGET_MAX_DIMENSION / Math.max(img.width, img.height))
      const w = Math.round(img.width * ratio)
      const h = Math.round(img.height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas no disponible'))
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob => {
          if (!blob) return reject(new Error('No se pudo comprimir la imagen'))
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg',
        COMPRESS_QUALITY,
      )
    }
    img.onerror = () => reject(new Error('Archivo no válido'))
    reader.readAsDataURL(file)
  })
}

export async function uploadImage(opts: {
  file:    File
  folder:  string
  bucket?: string
}): Promise<string> {
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
  if (!ALLOWED.includes(opts.file.type)) {
    throw new Error('Solo se permiten JPG, PNG o WebP')
  }

  const compressed = await compressImage(opts.file)
  const ext = compressed.type === 'image/png' ? 'png' : compressed.type === 'image/webp' ? 'webp' : 'jpg'

  // 1. Get signed upload URL from our backend
  const signedRes = await fetch('/api/upload/signed', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      bucket: opts.bucket ?? 'restaurant-photos',
      folder: opts.folder,
      ext,
      mime:   compressed.type,
    }),
  })
  if (!signedRes.ok) {
    const err = await signedRes.json().catch(() => ({}))
    throw new Error(err.error ?? 'No se pudo preparar la subida')
  }
  const { token, path, publicUrl, bucket } = await signedRes.json()

  // 2. Upload directly to Supabase Storage (bypasses Vercel)
  const supabase = createClient()
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, compressed, {
      contentType: compressed.type,
      upsert:      false,
    })

  if (error) throw new Error(error.message || 'No se pudo subir la imagen')

  return publicUrl as string
}
