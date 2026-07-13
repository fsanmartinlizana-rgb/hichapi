'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Shield, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import HiChapiLogo from '@/components/landing/HiChapiLogo'

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
        <HiChapiLogo size={44} className="mx-auto" />
        <h1 className="text-[var(--text-strong)] font-bold text-2xl">Recuperar contraseña</h1>
        <p className="text-[var(--text-muted)] text-sm">Te enviaremos un enlace para crear una nueva</p>
      </div>

      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl p-6">

        {!sent ? (
          <>
            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                <AlertCircle size={15} className="text-red-700 shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[var(--text-muted)] text-xs font-medium">Email de tu cuenta</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="tu@restaurante.cl"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-strong)] placeholder:text-[var(--text-muted)] text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors"
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
              <CheckCircle2 size={26} className="text-emerald-700" />
            </div>
            <div>
              <h2 className="text-[var(--text-strong)] font-bold text-lg">Revisá tu correo</h2>
              {/* Mensaje uniforme: NO confirmamos si el email existe en la
                  base. Si existe, le llega un link en minutos; si no existe,
                  no le llega nada — pero al usuario le decimos lo mismo para
                  evitar user enumeration. */}
              <p className="text-[var(--text-muted)] text-sm mt-1 leading-relaxed">
                Si <span className="text-[var(--text-muted)]">{email}</span> tiene una cuenta en
                HiChapi, te enviamos un link para restablecer la contraseña.
                Llega en algunos minutos y expira en 1 hora.
              </p>
            </div>
            <p className="text-[var(--text-muted)] text-xs">
              ¿No llegó? Revisá la carpeta de spam o{' '}
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="text-[#E55A2B] hover:text-[#E55A2B] underline"
              >
                intentá con otro email
              </button>.
            </p>
          </div>
        )}
      </div>

      <p className="text-center text-[var(--text-muted)] text-sm">
        <Link href="/login" className="text-[#E55A2B] hover:underline font-medium flex items-center justify-center gap-1.5">
          <ArrowLeft size={13} /> Volver al inicio de sesión
        </Link>
      </p>

      <div className="flex items-center justify-center gap-1.5 text-[var(--text-muted)]">
        <Shield size={11} />
        <span className="text-[10px]">Conexión segura · Datos encriptados · Supabase Auth</span>
      </div>
    </div>
  )
}
