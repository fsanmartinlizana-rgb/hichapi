'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, CheckCircle2, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────────────────────
// /invite-callback
// Recibe el redirect del email de invitación de Supabase. El token llega en
// el hash (#access_token=… &refresh_token=… &type=invite). Lo intercambiamos
// por una sesión y mandamos al usuario a crear su contraseña.
// ─────────────────────────────────────────────────────────────────────────────

export default function InviteCallbackPage() {
  const router = useRouter()
  const [error, setError]   = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok'>('loading')

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
          setError('No pudimos validar tu invitación. Pídele a tu admin que la reenvíe.')
          return
        }

        // Limpiar el hash de la URL por seguridad
        window.history.replaceState(null, '', window.location.pathname)

        setStatus('ok')

        // Mandar a crear contraseña — al terminar irá al panel
        setTimeout(() => router.replace('/update-password'), 800)
      } catch {
        setError('Ocurrió un error procesando tu invitación.')
      }
    }

    run()
  }, [router])

  return (
    <div className="space-y-6">

      {/* Logo */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-[#FF6B35] flex items-center justify-center text-white font-bold text-xl mx-auto">
          hi
        </div>
        <h1 className="text-white font-bold text-2xl">Bienvenido a HiChapi</h1>
        <p className="text-white/40 text-sm">Estamos validando tu invitación…</p>
      </div>

      <div className="bg-[#161622] border border-white/8 rounded-2xl p-6">
        {error ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm leading-relaxed">{error}</p>
            </div>
            <Link
              href="/login"
              className="block w-full text-center py-3.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] transition-colors"
            >
              Ir al inicio de sesión
            </Link>
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
