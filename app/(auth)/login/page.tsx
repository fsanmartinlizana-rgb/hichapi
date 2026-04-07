'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2, Shield, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Rate limiting — client-side guard (real limiting is server-side via Supabase)
const attempts: { count: number; since: number } = { count: 0, since: Date.now() }

function checkRateLimit(): boolean {
  const now = Date.now()
  if (now - attempts.since > 15 * 60 * 1000) {
    attempts.count = 0
    attempts.since = now
  }
  attempts.count++
  return attempts.count <= 5
}

export default function LoginPage() {
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirect') ?? '/dashboard'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [blocked, setBlocked]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!checkRateLimit()) {
      setBlocked(true)
      setError('Demasiados intentos. Espera 15 minutos antes de volver a intentar.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (authErr) {
        // Normalize error messages — never leak internal details
        if (authErr.message.toLowerCase().includes('invalid login') ||
            authErr.message.toLowerCase().includes('invalid credentials')) {
          setError('Email o contraseña incorrectos.')
        } else if (authErr.message.toLowerCase().includes('email not confirmed')) {
          setError('Debes verificar tu email antes de ingresar. Revisa tu bandeja.')
        } else {
          setError('No pudimos iniciar sesión. Intenta de nuevo.')
        }
        return
      }

      if (!data.session) {
        setError('No se pudo crear la sesión. Intenta de nuevo.')
        return
      }

      // Reset attempts on success
      attempts.count = 0

      // Hard navigation ensures middleware reads fresh cookies
      const safe = redirectTo.startsWith('/') ? redirectTo : '/dashboard'
      window.location.href = safe

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
        <div className="w-12 h-12 rounded-2xl bg-[#FF6B35] flex items-center justify-center
                        text-white font-bold text-xl mx-auto">
          hi
        </div>
        <h1 className="text-white font-bold text-2xl">Bienvenido de vuelta</h1>
        <p className="text-white/40 text-sm">Ingresa a tu panel de restaurante</p>
      </div>

      {/* Form */}
      <div className="bg-[#161622] border border-white/8 rounded-2xl p-6 space-y-4">

        {error && (
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20
                          rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-white/50 text-xs font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={blocked}
              placeholder="tu@restaurante.cl"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white
                         placeholder:text-white/20 text-sm focus:outline-none
                         focus:border-[#FF6B35]/50 transition-colors disabled:opacity-40"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-white/50 text-xs font-medium">Contraseña</label>
              <Link href="/recuperar" className="text-[#FF6B35]/70 text-xs hover:text-[#FF6B35] transition-colors">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={blocked}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 pr-11 rounded-xl bg-white/5 border border-white/8 text-white
                           placeholder:text-white/20 text-sm focus:outline-none
                           focus:border-[#FF6B35]/50 transition-colors disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || blocked || !email || !password}
            className="w-full py-3.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm
                       hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Ingresando...</>
              : 'Ingresar al panel'
            }
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/6" />
          <span className="text-white/20 text-xs">o</span>
          <div className="flex-1 h-px bg-white/6" />
        </div>

        {/* Google SSO */}
        <button
          onClick={async () => {
            setLoading(true)
            const supabase = createClient()
            await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: `${window.location.origin}/auth/callback` },
            })
          }}
          disabled={loading || blocked}
          className="w-full py-3 rounded-xl bg-white/5 border border-white/8 text-white/70 text-sm
                     hover:bg-white/8 hover:text-white disabled:opacity-40
                     transition-colors flex items-center justify-center gap-2.5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar con Google
        </button>
      </div>

      {/* Register link */}
      <p className="text-center text-white/30 text-sm">
        ¿Tu restaurante aún no está en HiChapi?{' '}
        <Link href="/register" className="text-[#FF6B35] hover:underline font-medium">
          Regístrate gratis
        </Link>
      </p>

      {/* Security badge */}
      <div className="flex items-center justify-center gap-1.5 text-white/15">
        <Shield size={11} />
        <span className="text-[10px]">Conexión segura · Datos encriptados · Supabase Auth</span>
      </div>
    </div>
  )
}
