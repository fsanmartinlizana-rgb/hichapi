'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, Shield, Check, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const RULES = [
  { label: 'Al menos 12 caracteres',     test: (p: string) => p.length >= 12 },
  { label: 'Al menos un número',         test: (p: string) => /\d/.test(p) },
  { label: 'Al menos una mayúscula',     test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Al menos un símbolo (!@#$)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const passed = RULES.filter(r => r.test(password)).length
  const color  = passed <= 1 ? 'bg-red-500' : passed <= 2 ? 'bg-yellow-500' : passed <= 3 ? 'bg-blue-400' : 'bg-emerald-400'

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {RULES.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < passed ? color : 'bg-white/8'}`} />
        ))}
      </div>
      <div className="space-y-1">
        {RULES.map(rule => {
          const ok = rule.test(password)
          return (
            <div key={rule.label} className="flex items-center gap-1.5">
              {ok
                ? <Check size={10} className="text-emerald-400 shrink-0" />
                : <X size={10} className="text-white/20 shrink-0" />
              }
              <span className={`text-[10px] ${ok ? 'text-white/50' : 'text-white/20'}`}>{rule.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function UpdatePasswordPage() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [done, setDone]           = useState(false)

  const passwordOk     = RULES.every(r => r.test(password))
  const passwordsMatch = password === confirm && confirm.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!passwordOk)     { setError('La contraseña no cumple los requisitos de seguridad.'); return }
    if (!passwordsMatch) { setError('Las contraseñas no coinciden.'); return }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateErr } = await supabase.auth.updateUser({ password })

      if (updateErr) {
        if (updateErr.message.toLowerCase().includes('same password')) {
          setError('La nueva contraseña debe ser diferente a la anterior.')
        } else {
          setError('No pudimos actualizar tu contraseña. El enlace puede haber expirado.')
        }
        return
      }

      setDone(true)

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
        <h1 className="text-white font-bold text-2xl">Nueva contraseña</h1>
        <p className="text-white/40 text-sm">Elige una contraseña segura para tu cuenta</p>
      </div>

      <div className="bg-[#161622] border border-white/8 rounded-2xl p-6">

        {!done ? (
          <>
            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20
                              rounded-xl px-4 py-3 mb-4">
                <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-white/50 text-xs font-medium">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Mínimo 12 caracteres"
                    className="w-full px-4 py-3 pr-11 rounded-xl bg-white/5 border border-white/8 text-white
                               placeholder:text-white/20 text-sm focus:outline-none
                               focus:border-[#FF6B35]/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </div>

              <div className="space-y-1.5">
                <label className="text-white/50 text-xs font-medium">Confirmar contraseña</label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Repite la contraseña"
                    className={`w-full px-4 py-3 pr-11 rounded-xl bg-white/5 border text-white
                               placeholder:text-white/20 text-sm focus:outline-none transition-colors
                               ${confirm && !passwordsMatch ? 'border-red-500/40' : confirm && passwordsMatch ? 'border-emerald-500/40' : 'border-white/8'}`}
                  />
                  {confirm && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {passwordsMatch
                        ? <Check size={16} className="text-emerald-400" />
                        : <X size={16} className="text-red-400" />
                      }
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !passwordOk || !passwordsMatch}
                className="w-full py-3.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm
                           hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> Actualizando...</>
                  : 'Actualizar contraseña'
                }
              </button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25
                            flex items-center justify-center mx-auto">
              <CheckCircle2 size={26} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">¡Contraseña actualizada!</h2>
              <p className="text-white/40 text-sm mt-1">
                Tu contraseña fue cambiada exitosamente.
              </p>
            </div>
            <button
              onClick={() => { window.location.href = '/dashboard' }}
              className="w-full py-3.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm
                         hover:bg-[#e85d2a] transition-colors"
            >
              Ir al panel →
            </button>
          </div>
        )}
      </div>

      {!done && (
        <p className="text-center text-white/30 text-sm">
          <Link href="/login" className="text-[#FF6B35]/70 hover:text-[#FF6B35] transition-colors">
            Volver al inicio de sesión
          </Link>
        </p>
      )}

      <div className="flex items-center justify-center gap-1.5 text-white/15">
        <Shield size={11} />
        <span className="text-[10px]">Conexión segura · Datos encriptados · Supabase Auth</span>
      </div>
    </div>
  )
}
