'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { QRCodeCanvas } from 'qrcode.react'
import { Gift, Ticket, Loader2, ArrowLeft, Copy, Check, Clock, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Coupon {
  id:           string
  code:         string
  status:       string
  issued_at:    string | null
  expires_at:   string | null
  restaurant_id: string
  reward:       { id: string; name: string; type: string; description?: string | null } | null
  restaurant:   { id: string; name: string; slug: string | null } | null
}

export default function MyWalletPage() {
  const supabase = createClient()
  const [loading, setLoading]   = useState(true)
  const [authed, setAuthed]     = useState<boolean | null>(null)
  const [coupons, setCoupons]   = useState<Coupon[]>([])
  const [err, setErr]           = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [copied, setCopied]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setAuthed(false)
      setLoading(false)
      return
    }
    setAuthed(true)
    setUserEmail(user.email ?? '')

    try {
      const res = await fetch('/api/loyalty/my-coupons')
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error al cargar cupones')
      setCoupons(j.coupons ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
        <Loader2 size={24} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  if (authed === false) {
    return (
      <div className="min-h-screen bg-[#0A0A14] text-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-[#161622] border border-white/8 rounded-2xl p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FF6B35]/15 border border-[#FF6B35]/30 flex items-center justify-center">
            <Gift size={26} className="text-[#FF6B35]" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Tu wallet de cupones</h1>
            <p className="text-white/50 text-sm mt-2 leading-relaxed">
              Ingresa a tu cuenta HiChapi para ver los cupones que recibiste.
              Si te enviaron un cupón por correo, tu wallet lo reclamará automáticamente al iniciar sesión con ese email.
            </p>
          </div>
          <Link
            href="/login?next=/mi-wallet"
            className="block w-full py-3 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] font-semibold text-sm text-center transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A14] text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0A0A14]/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base">Mi wallet</h1>
          <p className="text-white/40 text-[11px] truncate">{userEmail}</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-[#FF6B35]/15 border border-[#FF6B35]/30 flex items-center justify-center">
          <Gift size={16} className="text-[#FF6B35]" />
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 pb-20 space-y-4">

        {err && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div className="text-red-300 text-sm">
              <p className="font-semibold">No pudimos cargar tus cupones</p>
              <p className="text-red-300/70 text-xs mt-1">{err}</p>
            </div>
          </div>
        )}

        {/* Intro card */}
        {!err && coupons.length > 0 && (
          <div className="bg-gradient-to-br from-[#FF6B35]/15 via-[#FF6B35]/5 to-transparent border border-[#FF6B35]/20 rounded-2xl p-4">
            <p className="text-white/70 text-sm">
              Tienes <strong className="text-white">{coupons.length} cupón{coupons.length === 1 ? '' : 'es'} activo{coupons.length === 1 ? '' : 's'}</strong>.
              Muéstrale el código o QR al garzón para canjearlo en el restaurante.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!err && coupons.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <Ticket size={28} className="text-white/25" />
            </div>
            <p className="text-white/50 text-sm">Aún no tienes cupones activos.</p>
            <p className="text-white/30 text-xs mt-1">Cuando te regalen uno o canjees puntos, aparecerá acá.</p>
          </div>
        )}

        {/* Coupons grid */}
        {coupons.map(c => {
          const expired = c.expires_at ? new Date(c.expires_at) < new Date() : false
          const expiresLabel = c.expires_at
            ? new Date(c.expires_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
            : null
          // Payload del QR: formato usado por el canjeador del garzón
          const qrPayload = `hichapi:coupon:${c.code}|${c.restaurant_id}`

          return (
            <article
              key={c.id}
              className={`rounded-2xl border p-5 space-y-4 ${
                expired
                  ? 'bg-white/3 border-white/10 opacity-60'
                  : 'bg-[#161622] border-[#FF6B35]/25'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF6B35]/15 border border-[#FF6B35]/30 flex items-center justify-center shrink-0">
                  <Ticket size={17} className="text-[#FF6B35]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/40 text-[10px] uppercase tracking-wide">
                    {c.restaurant?.name ?? 'Restaurante'}
                  </p>
                  <h2 className="text-white font-bold text-base leading-tight mt-0.5">
                    {c.reward?.name ?? 'Recompensa'}
                  </h2>
                  {c.reward?.description && (
                    <p className="text-white/50 text-xs mt-1">{c.reward.description}</p>
                  )}
                </div>
              </div>

              {/* QR */}
              <div className="flex flex-col items-center bg-white rounded-2xl p-4">
                <QRCodeCanvas
                  value={qrPayload}
                  size={180}
                  level="M"
                  imageSettings={{ src: '/favicon.ico', width: 28, height: 28, excavate: true }}
                />
                <p className="text-[#0A0A14]/60 text-[10px] mt-2 font-medium">
                  Muéstrale este QR al garzón
                </p>
              </div>

              {/* Code */}
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-white/40 text-[10px] uppercase tracking-wide">Código</p>
                  <p className="font-mono font-bold text-base text-white tracking-wider truncate">
                    {c.code}
                  </p>
                </div>
                <button
                  onClick={() => copyCode(c.code)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/60 text-xs hover:bg-white/5 hover:text-white transition-colors"
                >
                  {copied === c.code
                    ? <><Check size={12} className="text-emerald-400" /> Copiado</>
                    : <><Copy size={12} /> Copiar</>
                  }
                </button>
              </div>

              {/* Expiry */}
              {expiresLabel && (
                <div className={`flex items-center gap-2 text-xs ${expired ? 'text-red-400' : 'text-white/45'}`}>
                  <Clock size={11} />
                  <span>
                    {expired ? 'Expirado el ' : 'Válido hasta '}<strong>{expiresLabel}</strong>
                  </span>
                </div>
              )}
            </article>
          )
        })}

        <p className="text-white/20 text-[11px] text-center pt-4">
          Los cupones se canjean presencialmente en el local. Sólo el garzón puede marcar un cupón como usado.
        </p>
      </main>
    </div>
  )
}
