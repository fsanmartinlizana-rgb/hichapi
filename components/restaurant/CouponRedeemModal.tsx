'use client'

/**
 * <CouponRedeemModal /> — modal para que el garzón canjee un cupón de cliente.
 * Flujo: el garzón escribe/escanea el código → se verifica con /api/loyalty/coupon-lookup
 * → muestra el detalle (recompensa, cliente, validez) → botón "Marcar como canjeado"
 * dispara /api/loyalty/redeem con body { restaurant_id, code }.
 */

import { useState, useRef, useEffect } from 'react'
import { Ticket, Loader2, X, Check, AlertCircle, Search } from 'lucide-react'

interface CouponPreview {
  ok:      true
  valid:   boolean
  expired: boolean
  coupon:  { id: string; code: string; status: string; expires_at: string | null }
  reward:  { id: string; name: string; type: string; description?: string | null } | null
  customer: string | null
}

export function CouponRedeemModal({
  restaurantId,
  onClose,
  onRedeemed,
}: {
  restaurantId: string
  onClose: () => void
  onRedeemed?: (code: string) => void
}) {
  const [code, setCode]       = useState('')
  const [preview, setPreview] = useState<CouponPreview | null>(null)
  const [busy, setBusy]       = useState(false)
  const [err, setErr]         = useState<string | null>(null)
  const [done, setDone]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function lookup() {
    const cleaned = code.trim().toUpperCase()
    if (cleaned.length < 4) { setErr('Ingresa el código completo'); return }
    setBusy(true); setErr(null); setPreview(null)
    try {
      const res = await fetch(`/api/loyalty/coupon-lookup?code=${encodeURIComponent(cleaned)}&restaurant_id=${restaurantId}`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? `Error ${res.status}`)
      setPreview(j as CouponPreview)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al verificar cupón')
    } finally {
      setBusy(false)
    }
  }

  async function redeem() {
    if (!preview?.valid) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/loyalty/redeem', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          restaurant_id: restaurantId,
          code:          preview.coupon.code,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error al canjear')
      setDone(true)
      onRedeemed?.(preview.coupon.code)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al canjear')
    } finally {
      setBusy(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); lookup() }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#1C1C2E] border border-white/12 rounded-2xl w-full max-w-sm p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FF6B35]/20 border border-[#FF6B35]/30 flex items-center justify-center">
              <Ticket size={15} className="text-[#FF6B35]" />
            </div>
            <h3 className="text-white font-semibold text-base">Canjear cupón</h3>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Input */}
        {!done && (
          <>
            <div>
              <label className="text-white/50 text-xs mb-1.5 block">Código del cupón</label>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={code}
                  onChange={e => { setCode(e.target.value.toUpperCase()); setPreview(null); setErr(null) }}
                  onKeyDown={handleKeyDown}
                  placeholder="CH-XXXXXXXXXX"
                  className="flex-1 bg-white/5 border border-white/12 rounded-xl px-3 py-2.5 text-white text-sm font-mono tracking-wider focus:outline-none focus:border-[#FF6B35]/50"
                  autoComplete="off"
                  autoCapitalize="characters"
                />
                <button
                  onClick={lookup}
                  disabled={busy || code.trim().length < 4}
                  className="px-3 py-2.5 rounded-xl bg-white/8 border border-white/12 text-white text-sm hover:bg-white/12 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                  Buscar
                </button>
              </div>
              <p className="text-white/25 text-[10px] mt-1.5">
                El cliente puede mostrarte el código en su wallet (/mi-wallet) o en el email que recibió.
              </p>
            </div>

            {err && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-xs">{err}</p>
              </div>
            )}

            {preview && (
              <div className={`rounded-xl p-4 border ${
                preview.valid
                  ? 'bg-emerald-500/8 border-emerald-500/30'
                  : 'bg-amber-500/8 border-amber-500/30'
              } space-y-2`}>
                <div className="flex items-center gap-2">
                  {preview.valid
                    ? <Check size={15} className="text-emerald-400 shrink-0" />
                    : <AlertCircle size={15} className="text-amber-400 shrink-0" />
                  }
                  <p className={`text-sm font-semibold ${preview.valid ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {preview.valid
                      ? 'Cupón válido'
                      : preview.expired
                        ? 'Cupón expirado'
                        : `Cupón ${preview.coupon.status === 'redeemed' ? 'ya canjeado' : preview.coupon.status}`}
                  </p>
                </div>
                <div className="pl-6 space-y-1 text-xs">
                  <p className="text-white">
                    <span className="text-white/40">Recompensa: </span>
                    <strong>{preview.reward?.name ?? 'Desconocida'}</strong>
                  </p>
                  {preview.reward?.description && (
                    <p className="text-white/50">{preview.reward.description}</p>
                  )}
                  {preview.customer && (
                    <p className="text-white/50">
                      <span className="text-white/35">Cliente: </span>{preview.customer}
                    </p>
                  )}
                  {preview.coupon.expires_at && (
                    <p className="text-white/40">
                      Vence: {new Date(preview.coupon.expires_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-white/12 text-white/60 text-sm hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={redeem}
                disabled={!preview?.valid || busy}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Marcar canjeado
              </button>
            </div>
          </>
        )}

        {done && preview && (
          <div className="py-4 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Check size={26} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-semibold">¡Cupón canjeado!</p>
              <p className="text-white/50 text-xs mt-1">
                {preview.reward?.name ?? 'Recompensa'} aplicada al cliente.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#FF6B35] hover:bg-[#e85d2a] text-white text-sm font-semibold transition-colors"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
