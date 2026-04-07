'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Shield, Check, X, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ── Password strength rules ───────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

const STEPS = ['Cuenta', 'Restaurante', 'Listo']

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)

  // Step 0: account
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPass, setShowPass]   = useState(false)

  // Step 1: restaurant info
  const [restName, setRestName]   = useState('')
  const [restAddr, setRestAddr]   = useState('')
  const [restBarrio, setRestBarrio] = useState('')
  const [restCocina, setRestCocina] = useState('')
  const [ownerName, setOwnerName] = useState('')

  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const passwordOk = RULES.every(r => r.test(password))
  const passwordsMatch = password === confirm && confirm.length > 0

  async function handleStep0(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!passwordOk) { setError('La contraseña no cumple los requisitos de seguridad.'); return }
    if (!passwordsMatch) { setError('Las contraseñas no coinciden.'); return }
    setStep(1)
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      // 1. Create auth user
      const { data, error: authErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { owner_name: ownerName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (authErr) {
        if (authErr.message.includes('already registered')) {
          setError('Este email ya tiene una cuenta. ¿Quieres iniciar sesión?')
        } else {
          setError('No pudimos crear tu cuenta. Intenta de nuevo.')
        }
        setStep(0)
        return
      }

      if (!data.user) {
        setError('Error inesperado. Intenta de nuevo.')
        return
      }

      // 2. Create restaurant record (pending approval)
      const slug = restName.trim()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')

      await supabase.from('restaurants').insert({
        name: restName.trim(),
        address: restAddr.trim(),
        neighborhood: restBarrio.trim(),
        cuisine_type: restCocina.trim(),
        slug: `${slug}-${Date.now().toString(36)}`,
        owner_id: data.user.id,
        active: false, // needs admin approval
      })

      setStep(2)

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
        <h1 className="text-white font-bold text-2xl">Registra tu restaurante</h1>
        <p className="text-white/40 text-sm">Gratis para empezar · Sin tarjeta de crédito</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
              transition-all ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-[#FF6B35] text-white' : 'bg-white/8 text-white/25'}`}>
              {i < step ? <Check size={12} /> : i + 1}
            </div>
            <span className={`text-xs ${i === step ? 'text-white/70' : 'text-white/20'}`}>{label}</span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-white/10" />}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="bg-[#161622] border border-white/8 rounded-2xl p-6">

        {error && (
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20
                          rounded-xl px-4 py-3 mb-4">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* ── Step 0: Cuenta ───────────────────────────────────────────────── */}
        {step === 0 && (
          <form onSubmit={handleStep0} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-medium">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                autoComplete="email" placeholder="tu@restaurante.cl"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white
                           placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>

            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-medium">Tu nombre</label>
              <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} required
                placeholder="María González"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white
                           placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>

            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-medium">Contraseña</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required autoComplete="new-password"
                  placeholder="Mínimo 12 caracteres"
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-white/5 border border-white/8 text-white
                             placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-medium">Confirmar contraseña</label>
              <div className="relative">
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  required autoComplete="new-password" placeholder="Repite la contraseña"
                  className={`w-full px-4 py-3 pr-11 rounded-xl bg-white/5 border text-white
                             placeholder:text-white/20 text-sm focus:outline-none transition-colors
                             ${confirm && !passwordsMatch ? 'border-red-500/40' : confirm && passwordsMatch ? 'border-emerald-500/40' : 'border-white/8'}`} />
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

            <button type="submit" disabled={!passwordOk || !passwordsMatch || !email || !ownerName}
              className="w-full py-3.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm
                         hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Continuar →
            </button>
          </form>
        )}

        {/* ── Step 1: Restaurante ──────────────────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <p className="text-white/40 text-xs mb-2">
              Esta info aparecerá en HiChapi para que los clientes te encuentren.
            </p>

            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-medium">Nombre del restaurante</label>
              <input type="text" value={restName} onChange={e => setRestName(e.target.value)} required
                placeholder="El Rincón de Don José"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white
                           placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>

            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-medium">Dirección</label>
              <input type="text" value={restAddr} onChange={e => setRestAddr(e.target.value)} required
                placeholder="Av. Italia 1234"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white
                           placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-white/50 text-xs font-medium">Barrio</label>
                <input type="text" value={restBarrio} onChange={e => setRestBarrio(e.target.value)} required
                  placeholder="Providencia"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white
                             placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-white/50 text-xs font-medium">Tipo de cocina</label>
                <input type="text" value={restCocina} onChange={e => setRestCocina(e.target.value)} required
                  placeholder="Italiana"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white
                             placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setStep(0)}
                className="px-4 py-3 rounded-xl border border-white/10 text-white/40 text-sm hover:border-white/20 transition-colors">
                ← Volver
              </button>
              <button type="submit" disabled={loading || !restName || !restAddr || !restBarrio || !restCocina}
                className="flex-1 py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm
                           hover:bg-[#e85d2a] disabled:opacity-40 transition-colors
                           flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={15} className="animate-spin" /> Creando cuenta...</> : 'Crear cuenta'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 2: Listo ────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25
                            flex items-center justify-center mx-auto">
              <Check size={28} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">¡Cuenta creada!</h2>
              <p className="text-white/40 text-sm mt-1 leading-relaxed">
                Estamos revisando tu solicitud. En menos de 24 horas activamos tu restaurante en HiChapi.
              </p>
            </div>
            <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-left space-y-2">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide">Mientras tanto puedes</p>
              <div className="space-y-1.5">
                <p className="text-white/40 text-xs flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Explorar el panel con datos de demostración
                </p>
                <p className="text-white/40 text-xs flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Configurar tu carta y fotos de platos
                </p>
                <p className="text-white/40 text-xs flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Personalizar el tono de Chapi
                </p>
              </div>
            </div>
            <Link href="/api/admin/demo-setup"
              className="block w-full py-3.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm
                         hover:bg-[#e85d2a] transition-colors text-center">
              Explorar el panel →
            </Link>
            <p className="text-white/20 text-xs">
              Usarás el restaurante demo hasta que aprobemos el tuyo
            </p>
          </div>
        )}
      </div>

      {step < 2 && (
        <p className="text-center text-white/30 text-sm">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-[#FF6B35] hover:underline font-medium">Ingresar</Link>
        </p>
      )}

      <div className="flex items-center justify-center gap-1.5 text-white/15">
        <Shield size={11} />
        <span className="text-[10px]">Conexión segura · Datos encriptados · Supabase Auth</span>
      </div>
    </div>
  )
}
