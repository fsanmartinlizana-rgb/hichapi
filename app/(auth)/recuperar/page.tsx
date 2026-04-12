'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Shield, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
      const supabase = createClient()
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          // After clicking the link → callback exchanges code → redirects to /update-password
          redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
        }
      )

      if (resetErr) {
        setError('No pudimos enviar el correo. Intenta de nuevo.')
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
              <h2 className="text-white font-bold text-lg">¡Correo enviado!</h2>
              <p className="text-white/40 text-sm mt-1 leading-relaxed">
                Revisa tu bandeja de entrada en{' '}
                <span className="text-white/60">{email}</span>.
                El enlace expira en 1 hora.
              </p>
            </div>
            <p className="text-white/25 text-xs">
              ¿No llegó? Revisa la carpeta de spam o{' '}
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="text-[#FF6B35]/70 hover:text-[#FF6B35] underline"
              >
                intenta con otro email
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
