'use client'

// ── /mesas/qrs ───────────────────────────────────────────────────────────────
// Vista imprimible de todos los QR de las mesas del restaurant seleccionado.
// Se abre en una tab aparte para poder usar Ctrl/Cmd+P directo.
//
// Layout: 6 QR por "página" A4 (2 columnas × 3 filas). El CSS `@media print`
// oculta header/toolbar y deja solo los QR con sus labels.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRestaurant } from '@/lib/restaurant-context'
import { QRCodeCanvas } from 'qrcode.react'
import { Printer, Download, ArrowLeft, Loader2, QrCode } from 'lucide-react'
import Link from 'next/link'

interface Mesa {
  id: string
  label: string
  seats: number
  zone: string | null
  qr_token: string
}

export default function QrsImprimiblesPage() {
  const { restaurant } = useRestaurant()
  const restId = restaurant?.id
  const slug   = restaurant?.slug ?? ''

  const [mesas, setMesas]     = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const origin = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hichapi.com')

  const load = useCallback(async () => {
    if (!restId) return
    setLoading(true)
    const res = await fetch(`/api/tables?restaurant_id=${restId}`)
    const data = await res.json()
    const list: Mesa[] = (data.tables ?? [])
      .filter((t: { qr_token: string | null }) => !!t.qr_token)
      .map((t: { id: string; label: string; seats: number; zone: string | null; qr_token: string }) => ({
        id:       t.id,
        label:    t.label,
        seats:    t.seats,
        zone:     t.zone,
        qr_token: t.qr_token,
      }))
    setMesas(list)
    setLoading(false)
  }, [restId])

  useEffect(() => { load() }, [load])

  function handlePrint() {
    window.print()
  }

  // Descarga cada QR como PNG empaquetado en un ZIP sería ideal, pero para
  // no agregar jszip, bajamos mesa por mesa (Chrome/Safari soportan múltiples
  // downloads con un pequeño delay). Si son >20 mesas mostramos aviso.
  async function handleDownloadAll() {
    const canvases = containerRef.current?.querySelectorAll<HTMLCanvasElement>('canvas.qr-canvas')
    if (!canvases) return
    const arr = Array.from(canvases)
    for (let i = 0; i < arr.length; i++) {
      const canvas = arr[i]
      const label  = canvas.dataset.label ?? `mesa-${i + 1}`
      const url    = canvas.toDataURL('image/png')
      const a      = document.createElement('a')
      a.href       = url
      a.download   = `qr-${slug}-${label.replace(/\s+/g, '-')}.png`
      a.click()
      // Pausa pequeña para evitar que el browser bloquee downloads masivos
      if (i < arr.length - 1) await new Promise(r => setTimeout(r, 200))
    }
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E0E14]">
        <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0E0E14] text-white print:bg-white print:text-black">
      {/* Toolbar — solo visible en pantalla */}
      <div className="sticky top-0 z-10 bg-[#0E0E14]/95 backdrop-blur border-b border-white/10 px-6 py-4 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/mesas"
              className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft size={14} /> Volver a Mesas
            </Link>
            <span className="text-white/20">·</span>
            <div className="flex items-center gap-2">
              <QrCode size={14} className="text-[#FF6B35]" />
              <p className="text-white text-sm font-semibold">{restaurant.name}</p>
              <span className="text-white/30 text-xs">· {mesas.length} QR</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAll}
              disabled={loading || mesas.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-white/70 text-xs hover:text-white hover:border-white/25 transition-colors disabled:opacity-40"
            >
              <Download size={12} /> Descargar todos (PNG)
            </button>
            <button
              onClick={handlePrint}
              disabled={loading || mesas.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#FF6B35] text-white text-xs font-semibold hover:bg-[#e55a2b] transition-colors disabled:opacity-40"
            >
              <Printer size={12} /> Imprimir
            </button>
          </div>
        </div>
        {mesas.length > 20 && (
          <p className="max-w-6xl mx-auto text-white/40 text-[11px] mt-2">
            Al descargar muchos archivos a la vez el navegador puede pedirte permiso.
            Conviene usar &quot;Imprimir&quot; y guardar como PDF si son muchas.
          </p>
        )}
      </div>

      {/* Grid de QR */}
      <div ref={containerRef} className="max-w-5xl mx-auto px-6 py-8 print:px-0 print:py-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={22} className="text-[#FF6B35] animate-spin" />
          </div>
        ) : mesas.length === 0 ? (
          <div className="text-center py-20 text-white/40 text-sm">
            No hay mesas con QR generado.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
            {mesas.map(m => {
              const url = `${origin}/${slug}/${m.qr_token}`
              return (
                <div
                  key={m.id}
                  className="qr-card rounded-2xl border border-white/10 bg-white/[0.02] p-6 break-inside-avoid flex flex-col items-center gap-3 print:border-neutral-300 print:bg-white print:shadow-none"
                >
                  {/* Encabezado */}
                  <div className="text-center print:text-black">
                    <p className="text-white/40 text-[10px] uppercase tracking-widest print:text-neutral-500">Chapi · Mesa</p>
                    <p className="text-white text-3xl font-bold leading-none mt-1 print:text-black" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                      {m.label}
                    </p>
                    {m.zone && (
                      <p className="text-white/30 text-[10px] mt-1 print:text-neutral-500">{m.zone} · {m.seats} pax</p>
                    )}
                  </div>

                  {/* QR */}
                  <div className="bg-white rounded-2xl p-3 print:p-2 print:border print:border-neutral-200">
                    <QRCodeCanvas
                      value={url}
                      size={200}
                      level="M"
                      className="qr-canvas"
                      imageSettings={{
                        src:       '/favicon.ico',
                        width:     32,
                        height:    32,
                        excavate:  true,
                      }}
                    />
                    {/* Canvas attribute data-label para download bulk */}
                    <DataLabelAttacher label={m.label} />
                  </div>

                  {/* URL de referencia (small) */}
                  <p className="text-white/25 text-[9px] font-mono break-all text-center print:text-neutral-400">
                    {url}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 1cm;
          }
          body {
            background: white !important;
          }
          .qr-card {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}

// Pequeño helper: agrega data-label al canvas del QR para el bulk download.
// React no permite pasar atributos HTML arbitrarios a QRCodeCanvas, así que
// busco el canvas hermano del nodo siguiente y le pego el atributo.
function DataLabelAttacher({ label }: { label: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const canvas = el.parentElement?.querySelector<HTMLCanvasElement>('canvas.qr-canvas')
    if (canvas) canvas.dataset.label = label
  }, [label])
  return <span ref={ref} className="hidden" aria-hidden="true" />
}
