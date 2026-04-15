'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, CheckCircle2, Shield, RefreshCw, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────────────────────
// /invite-callback
// Recibe el redirect del email de invitación de Supabase. El token llega en
// el hash (#access_token=… &refresh_token=… &type=invite). Lo intercambiamos
// por una sesión y mandamos al usuario a crear su contraseña.
// ─────────────────────────────────────────────────────────────────────────────

function isExpiredError(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('expired') ||
    m.includes('invalid or has expired') ||
    m.includes('invalid token') ||
    m.includes('otp_expired')
  )
}

export default function InviteCallbackPage() {
  const router = useRouter()
  const [error, setError]   = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok'>('loading')
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [resendEmail, setResendEmail] = useState('')

  useEffect(() => {
    const supabase = createClient()

    async function run() {
      try {
        // Supabase Auth devuelve los tokens en el fragmento (#) — no en query
        const hash = typeof window !== 'undefined' ? window.location.hash : ''
        const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)

        const access_token  = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        const errParam      = params.get('error_description') ?? params.get('error')

        // Query params (?coupon=..., ?next=...) vienen en search, no hash
        const searchParams = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search) : new URLSearchParams()
        const couponCode = searchParams.get('coupon')
        const nextPath   = searchParams.get('next')

        if (errParam) {
          setError(decodeURIComponent(errParam))
          return
        }

        if (!access_token || !refresh_token) {
          setError('El enlace de invitación es inválido o ya fue usado.')
          return
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        })

        if (sessionError) {
          setError(sessionError.message ?? 'No pudimos validar tu invitación.')
          return
        }

        // Post-login: si hay cupón pendiente, lo reclamamos para que quede
        // vinculado a la cuenta recién creada (wallet virtual).
        try {
          await fetch('/api/loyalty/claim-coupons', { method: 'POST' })
        } catch { /* best-effort — no bloquea */ }

        // Limpiar el hash de la URL por seguridad
        window.history.replaceState(null, '', window.location.pathname)

        setStatus('ok')

        // Si vino con ?next=/mi-wallet (flujo cupón), vamos directo al wallet
        // Si no, flujo tradicional: crear contraseña y al panel
        const redirectPath = nextPath && nextPath.startsWith('/')
          ? `/update-password?next=${encodeURIComponent(nextPath)}${couponCode ? `&coupon=${encodeURIComponent(couponCode)}` : ''}`
          : '/update-password'

        setTimeout(() => router.replace(redirectPath), 800)
      } catch {
        setError('Ocurrió un error procesando tu invitación.')
      }
    }

    run()
  }, [router])

  async function handleResend(e?: React.FormEvent) {
    e?.preventDefault()
    if (!resendEmail || resending) return
    setResending(true)
    setResendMsg(null)
    try {
      const res = await fetch('/api/auth/resend-invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: resendEmail.trim().toLowerCase() }),
      })
      const j = await res.json()
      if (!res.ok) {
        setResendMsg({ ok: false, text: j.error ?? 'No pudimos reenviar la invitación.' })
      } else {
        setResendMsg({
          ok:   true,
          text: j.message ?? 'Te enviamos un nuevo link a tu correo. Revisá en 1-2 minutos.',
        })
      }
    } catch {
      setResendMsg({ ok: false, text: 'Sin conexión. Reintentá.' })
    } finally {
      setResending(false)
    }
  }

  const expired = error ? isExpiredError(error) : false

  return (
    <div className="space-y-6">

      {/* Logo */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-[#FF6B35] flex items-center justify-center text-white font-bold text-xl mx-auto">
          hi
        </div>
        <h1 className="text-white font-bold text-2xl">Bienvenido a HiChapi</h1>
        <p className="text-white/40 text-sm">
          {expired ? 'Tu invitación expiró o ya fue usada' : 'Estamos validando tu invitación…'}
        </p>
      </div>

      <div className="bg-[#161622] border border-white/8 rounded-2xl p-6">
        {error ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <div className="text-red-400 text-sm leading-relaxed">
                <p>{error}</p>
                {expired && (
                  <p className="text-red-300/70 text-xs mt-2 leading-relaxed">
                    Esto puede pasar porque (1) el link expiró, (2) ya fue usado, o (3) tu cliente de email lo
                    consumió en una vista previa antes que vos. Pedí uno nuevo abajo y entrá apenas te llegue.
                  </p>
                )}
              </div>
            </div>

            {expired ? (
              <form onSubmit={handleResend} className="space-y-3">
                <label className="text-white/60 text-xs font-medium block">
                  Tu email
                </label>
                <input
                  type="email"
                  required
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-[#FF6B35]/50"
                />
                <button
                  type="submit"
                  disabled={!resendEmail || resending}
                  className="w-full py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                >
                  {resending
                    ? <><Loader2 size={14} className="animate-spin" /> Enviando…</>
                    : <><RefreshCw size={14} /> Reenviar invitación</>
                  }
                </button>

                {resendMsg && (
                  <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs ${
                    resendMsg.ok
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/20 text-red-300'
                  }`}>
                    <Mail size={12} className="shrink-0 mt-0.5" />
                    <p>{resendMsg.text}</p>
                  </div>
                )}

                <Link
                  href="/login"
                  className="block w-full text-center py-2.5 rounded-xl border border-white/10 text-white/50 text-xs hover:border-white/20 transition-colors"
                >
                  ¿Ya tienes cuenta? Iniciá sesión
                </Link>
              </form>
            ) : (
              <Link
                href="/login"
                className="block w-full text-center py-3.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] transition-colors"
              >
                Ir al inicio de sesión
              </Link>
            )}
          </div>
        ) : status === 'ok' ? (
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto">
              <CheckCircle2 size={26} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">¡Invitación aceptada!</h2>
              <p className="text-white/40 text-sm mt-1">
                Te llevamos a crear tu contraseña…
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Loader2 size={28} className="text-[#FF6B35] animate-spin mx-auto" />
            <p className="text-white/40 text-sm mt-3">Procesando tu invitación…</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-white/15">
        <Shield size={11} />
        <span className="text-[10px]">Conexión segura · Datos encriptados · Supabase Auth</span>
      </div>
    </div>
  )
}
