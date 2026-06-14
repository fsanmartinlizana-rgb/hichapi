'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Shield, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'

export default function RecuperarPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [sent, setSent]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Llamamos a nuestro endpoint server-side, NO a supabase.auth.resetPasswordForEmail
      // directo. Razones:
      //   1. Usa la plantilla de marca HiChapi vía Resend (no el email genérico
      //      de Supabase con "noreply@projectid.supabase.co").
      //   2. Evita el rate-limit nativo de Supabase (36s por email) — Resend
      //      tiene límites mucho más altos.
      //   3. Centraliza el control del redirectTo y logs.
      const res = await fetch('/api/auth/recover-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'No pudimos enviar el correo. Intenta de nuevo.')
        return
      }
      setSent(true)
    } catch {
      setError('Error de conexión. Revisa tu internet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Logo */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-[#FF6B35] flex items-center justify-center text-white font-bold text-xl mx-auto">
          hi
        </div>
        <h1 className="text-white font-bold text-2xl">Recuperar contraseña</h1>
        <p className="text-white/40 text-sm">Te enviaremos un enlace para crear una nueva</p>
      </div>

      <div className="bg-[#161622] border border-white/8 rounded-2xl p-6">

        {!sent ? (
          <>
            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-white/50 text-xs font-medium">Email de tu cuenta</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="tu@restaurante.cl"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> Enviando...</>
                  : 'Enviar enlace de recuperación'
                }
              </button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto">
              <CheckCircle2 size={26} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Revisá tu correo</h2>
              {/* Mensaje uniforme: NO confirmamos si el email existe en la
                  base. Si existe, le llega un link en minutos; si no existe,
                  no le llega nada — pero al usuario le decimos lo mismo para
                  evitar user enumeration. */}
              <p className="text-white/40 text-sm mt-1 leading-relaxed">
                Si <span className="text-white/60">{email}</span> tiene una cuenta en
                HiChapi, te enviamos un link para restablecer la contraseña.
                Llega en algunos minutos y expira en 1 hora.
              </p>
            </div>
            <p className="text-white/25 text-xs">
              ¿No llegó? Revisá la carpeta de spam o{' '}
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="text-[#FF6B35]/70 hover:text-[#FF6B35] underline"
              >
                intentá con otro email
              </button>.
            </p>
          </div>
        )}
      </div>

      <p className="text-center text-white/30 text-sm">
        <Link href="/login" className="text-[#FF6B35] hover:underline font-medium flex items-center justify-center gap-1.5">
          <ArrowLeft size={13} /> Volver al inicio de sesión
        </Link>
      </p>

      <div className="flex items-center justify-center gap-1.5 text-white/15">
        <Shield size={11} />
        <span className="text-[10px]">Conexión segura · Datos encriptados · Supabase Auth</span>
      </div>
    </div>
  )
}
