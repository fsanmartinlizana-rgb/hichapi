'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, CheckCircle2, Shield, Mail } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// /aceptar-invitacion?t=TOKEN
// Recibe un token firmado por nosotros (no por Supabase). Lo manda al backend
// para verificar y obtener un magic-link de Supabase. Después navega al
// magic-link para que el cliente quede con sesión activa.
//
// Esto bypasea completamente el flujo de Site URL de Supabase Auth, que se
// rompía cuando hichapi.com (Site URL configurada) apuntaba a GoDaddy parking.
// ─────────────────────────────────────────────────────────────────────────────

function AcceptInviteInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('t')

  const [status, setStatus] = useState<'loading' | 'ok' | 'manual' | 'error'>('loading')
  const [error,  setError]  = useState<string | null>(null)
  const [info,   setInfo]   = useState<{ email?: string } | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Falta el token de invitación. El link parece estar incompleto.')
      setStatus('error')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/accept-invite', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token }),
        })
        const j = await res.json()
        if (cancelled) return

        if (!res.ok) {
          setError(j.error ?? 'No pudimos validar tu invitación.')
          setStatus('error')
          return
        }

        setInfo({ email: j.email })

        if (j.method === 'magic_link' && j.action_link) {
          // Redirigir al magic-link para que Supabase nos dé sesión, después
          // a /update-password que está en el redirectTo.
          setStatus('ok')
          setTimeout(() => { window.location.href = j.action_link }, 600)
        } else {
          // Fallback: cuenta lista, mandar a login manual
          setStatus('manual')
        }
      } catch {
        if (cancelled) return
        setError('Sin conexión. Reintentá en un momento.')
        setStatus('error')
      }
    })()

    return () => { cancelled = true }
  }, [token])

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-[#FF6B35] flex items-center justify-center text-white font-bold text-xl mx-auto">
          hi
        </div>
        <h1 className="text-white font-bold text-2xl">Bienvenido a HiChapi</h1>
        <p className="text-white/40 text-sm">
          {status === 'loading' && 'Validando tu invitación…'}
          {status === 'ok'      && '¡Listo! Te llevamos a tu cuenta…'}
          {status === 'manual'  && 'Cuenta activa'}
          {status === 'error'   && 'Hubo un problema'}
        </p>
      </div>

      <div className="bg-[#161622] border border-white/8 rounded-2xl p-6">
        {status === 'loading' && (
          <div className="text-center py-6">
            <Loader2 size={28} className="text-[#FF6B35] animate-spin mx-auto" />
            <p className="text-white/40 text-sm mt-3">Procesando…</p>
          </div>
        )}

        {status === 'ok' && (
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto">
              <CheckCircle2 size={26} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">¡Invitación aceptada!</h2>
              <p className="text-white/40 text-sm mt-1">
                {info?.email ? `Entrando como ${info.email}…` : 'Entrando…'}
              </p>
            </div>
          </div>
        )}

        {status === 'manual' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-emerald-300 text-sm leading-relaxed">
                Tu cuenta ya está activa. Iniciá sesión con tu email{info?.email ? ` (${info.email})` : ''}.
              </p>
            </div>
            <Link
              href="/login"
              className="block w-full text-center py-3.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm leading-relaxed">{error}</p>
            </div>
            <Link
              href="/invite-callback"
              className="block w-full text-center py-3 rounded-xl border border-white/10 text-white/60 text-sm hover:border-white/20 transition-colors flex items-center justify-center gap-2"
            >
              <Mail size={14} /> Pedir un link nuevo
            </Link>
            <Link
              href="/login"
              className="block w-full text-center py-2.5 rounded-xl text-white/40 text-xs hover:text-white/60 transition-colors"
            >
              Iniciar sesión con cuenta existente
            </Link>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-white/15">
        <Shield size={11} />
        <span className="text-[10px]">Conexión segura · Datos encriptados</span>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="text-white/40 text-sm">Cargando…</div>}>
      <AcceptInviteInner />
    </Suspense>
  )
}
