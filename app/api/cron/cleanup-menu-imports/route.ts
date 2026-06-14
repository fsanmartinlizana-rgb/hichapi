import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ── GET /api/cron/cleanup-menu-imports ───────────────────────────────────────
// Limpia archivos del bucket `menu-imports` con más de 24h.
//
// Por qué: el flujo de ImportMenuModal sube PDFs/imágenes grandes para que el
// extractor pase la URL a Anthropic (en vez de base64 → 413 Vercel). Una vez
// terminado el extract NO necesitamos guardar el archivo: los items extraídos
// ya viven en menu_items. Sin limpieza el bucket crece sin tope.
//
// Schedule: diario 03:00 UTC (vercel.json).
// Auth: header `Authorization: Bearer ${CRON_SECRET}` — Vercel lo manda
// automáticamente en cron jobs. En dev local también lo aceptamos sin secret
// para poder probarlo.

const BUCKET = 'menu-imports'
const MAX_AGE_MS = 24 * 60 * 60 * 1000  // 24h
const PAGE = 1000

export async function GET(req: Request) {
  // Auth: en producción exigimos el bearer del cron. En dev sin CRON_SECRET
  // configurado, dejamos pasar para poder ejecutar manualmente.
  const expected = process.env.CRON_SECRET
  if (expected) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const cutoff = Date.now() - MAX_AGE_MS

  let totalScanned = 0
  let totalDeleted = 0
  let totalBytesFreed = 0
  const folders = ['extract']  // único folder usado por ImportMenuModal hoy

  try {
    for (const folder of folders) {
      // List paginado por si el bucket crece. Una sola página de 1000 cubre
      // varias semanas de uso normal, pero ponemos el loop por seguridad.
      let offset = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: files, error: listErr } = await supabase.storage
          .from(BUCKET)
          .list(folder, {
            limit: PAGE,
            offset,
            sortBy: { column: 'created_at', order: 'asc' },
          })

        if (listErr) {
          // Si el bucket no existe (cero subidas todavía), salimos limpio.
          if (listErr.message.includes('not found') || listErr.message.includes('Bucket')) {
            return NextResponse.json({ ok: true, note: 'bucket not found', deleted: 0 })
          }
          console.error('[cleanup-menu-imports] list error:', listErr)
          return NextResponse.json({ error: 'list failed' }, { status: 500 })
        }

        if (!files || files.length === 0) break

        const toDelete: string[] = []
        for (const f of files) {
          totalScanned++
          // created_at puede venir como string ISO o ya como Date; defensivos.
          const created = f.created_at ? new Date(f.created_at).getTime() : Date.now()
          if (created < cutoff) {
            toDelete.push(`${folder}/${f.name}`)
            const size = (f.metadata as { size?: number } | null)?.size ?? 0
            totalBytesFreed += size
          }
        }

        if (toDelete.length > 0) {
          const { error: delErr } = await supabase.storage.from(BUCKET).remove(toDelete)
          if (delErr) {
            console.error('[cleanup-menu-imports] remove error:', delErr)
          } else {
            totalDeleted += toDelete.length
          }
        }

        if (files.length < PAGE) break
        offset += PAGE
      }
    }

    return NextResponse.json({
      ok:           true,
      scanned:      totalScanned,
      deleted:      totalDeleted,
      bytes_freed:  totalBytesFreed,
      cutoff_iso:   new Date(cutoff).toISOString(),
    })
  } catch (err) {
    console.error('[cleanup-menu-imports] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
