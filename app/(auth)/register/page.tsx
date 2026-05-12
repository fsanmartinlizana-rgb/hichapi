'use client'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2, Shield, Check, X, AlertCircle, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ── Plan que se va a activar tras el registro ────────────────────────────────

type PlanId = 'free' | 'starter' | 'pro' | 'enterprise'

const PLAN_INFO: Record<PlanId, {
  name: string
  trial: boolean
  description: string
  bullets: string[]
}> = {
  free: {
    name: 'Free',
    trial: false,
    description: 'Tu presencia digital sin costo.',
    bullets: ['Página pública', 'Carta digital', 'Apareces en Chapi'],
  },
  starter: {
    name: 'Starter',
    trial: true,
    description: 'Operación del salón completa.',
    bullets: ['Mesas + QR', 'Comandas en vivo', 'Caja con cierre de turno'],
  },
  pro: {
    name: 'Pro',
    trial: true,
    description: 'Inteligencia operativa con IA.',
    bullets: ['Todo lo de Starter', 'Stock + mermas', 'Reporte IA + Fidelización'],
  },
  enterprise: {
    name: 'Enterprise',
    trial: false,
    description: 'Para holdings con 2+ locales. Precio por local baja con la escala.',
    bullets: ['Dashboard consolidado', 'Transferencia de stock', 'Comisión desde 1% hasta 0.5%'],
  },
}

function isPlanId(v: string | null): v is PlanId {
  return v === 'free' || v === 'starter' || v === 'pro' || v === 'enterprise'
}

// ── Rate limiting (client-side guard) ─────────────────────────────────────────

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

// ── Slug generation (mirrors server-side logic) ──────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, '-')             // Spaces to hyphens
    .replace(/[^a-z0-9-]/g, '')       // Remove special chars
    .replace(/-+/g, '-')              // Collapse multiple hyphens
    .replace(/^-|-$/g, '')            // Trim hyphens
}

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
  return (
    <Suspense fallback={<div className="text-white/40 text-sm text-center py-8">Cargando…</div>}>
      <RegisterPageInner />
    </Suspense>
  )
}

function RegisterPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planParam = searchParams.get('plan')
  const selectedPlan: PlanId = isPlanId(planParam) ? planParam : 'free'
  const planInfo = PLAN_INFO[selectedPlan]
  // ── Modo claim: ?claimed=<restaurant_id> ────────────────────────────────
  // Llega desde el magic link de /api/restaurants/[id]/claim. El user ya
  // está autenticado y tiene team_members.role='owner' del restaurant.
  // No necesita crear cuenta ni restaurant — lo llevamos directo a
  // completar el perfil con un mensaje de bienvenida.
  const claimedId = searchParams.get('claimed')
  if (claimedId && /^[0-9a-f-]{36}$/.test(claimedId)) {
    return <ClaimedWelcome restaurantId={claimedId} />
  }

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
  const [blocked, setBlocked]     = useState(false)

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

    if (!checkRateLimit()) {
      setBlocked(true)
      setError('Demasiados intentos. Espera 15 minutos antes de volver a intentar.')
      return
    }

    setLoading(true)

    try {
      // 1. Crear cuenta + restaurante + team_members en server (service role)
      const res = await fetch('/api/auth/register-restaurant', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:       email.trim().toLowerCase(),
          password,
          ownerName:   ownerName.trim(),
          restName:    restName.trim(),
          restAddress: restAddr.trim(),
          restBarrio:  restBarrio.trim(),
          restCocina:  restCocina.trim(),
          plan:        selectedPlan, // ← desde ?plan= en la URL
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 409) {
          setError(json.error ?? 'Este email ya tiene una cuenta.')
          setStep(0)
        } else {
          setError(json.error ?? 'No pudimos crear tu cuenta. Intenta de nuevo.')
        }
        return
      }

      // 2. Auto-login para que el usuario entre al panel inmediatamente
      const supabase = createClient()
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password,
      })

      if (signInErr) {
        // Cuenta creada pero el auto-login falló — manda al login manual
        setStep(2)
        return
      }

      setStep(2)
      // Reset attempts on success
      attempts.count = 0
      // Redirigir al panel después de mostrar el éxito
      setTimeout(() => router.replace('/dashboard'), 1500)

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
        <h1 className="text-white font-bold text-2xl">Registra tu restaurante</h1>
        <p className="text-white/40 text-sm">
          {planInfo.trial
            ? 'Trial 30 días sin tarjeta de crédito'
            : 'Gratis para empezar · Sin tarjeta de crédito'}
        </p>
      </div>

      {/* Banner del plan elegido (solo si no es free) */}
      {selectedPlan !== 'free' && (
        <div
          className="rounded-2xl p-4 border"
          style={{
            background: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(255,107,53,0.04))',
            borderColor: 'rgba(255,107,53,0.3)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="rounded-full flex items-center justify-center shrink-0"
              style={{
                width: 36,
                height: 36,
                background: 'rgba(255,107,53,0.18)',
                border: '1px solid rgba(255,107,53,0.4)',
              }}
            >
              <Sparkles size={16} className="text-[#FF6B35]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">
                  Activarás
                </span>
                <span className="text-white font-extrabold text-base leading-none">
                  Plan {planInfo.name}
                </span>
                {planInfo.trial && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    30 días gratis
                  </span>
                )}
              </div>
              <p className="text-white/55 text-xs mb-2 leading-relaxed">
                {planInfo.description}
              </p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {planInfo.bullets.map(b => (
                  <li key={b} className="flex items-center gap-1 text-[11px] text-white/65">
                    <Check size={10} className="text-[#FF6B35] shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

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
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
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
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>

            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-medium">Tu nombre</label>
              <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} required
                placeholder="María González"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>

            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-medium">Contraseña</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required autoComplete="new-password"
                  placeholder="Mínimo 12 caracteres"
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
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
              className="w-full py-3.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
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
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
              {restName.length >= 2 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-white/30 text-xs">Tu URL será:</span>
                  <span className="text-[#FF6B35] text-xs font-mono">
                    hichapi.cl/{toSlug(restName)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-white/50 text-xs font-medium">Dirección</label>
              <input type="text" value={restAddr} onChange={e => setRestAddr(e.target.value)} required
                placeholder="Av. Italia 1234"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-white/50 text-xs font-medium">Barrio</label>
                <input type="text" value={restBarrio} onChange={e => setRestBarrio(e.target.value)} required
                  placeholder="Providencia"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-white/50 text-xs font-medium">Tipo de cocina</label>
                <input type="text" value={restCocina} onChange={e => setRestCocina(e.target.value)} required
                  placeholder="Italiana"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#FF6B35]/50 transition-colors" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setStep(0)}
                className="px-4 py-3 rounded-xl border border-white/10 text-white/40 text-sm hover:border-white/20 transition-colors">
                ← Volver
              </button>
              <button type="submit" disabled={loading || blocked || !restName || !restAddr || !restBarrio || !restCocina}
                className="flex-1 py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={15} className="animate-spin" /> Creando cuenta...</> : 'Crear cuenta'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 2: Listo ────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto">
              <Check size={28} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">¡Bienvenido a HiChapi!</h2>
              <p className="text-white/40 text-sm mt-1 leading-relaxed">
                Tu restaurante ya está creado y activo. Te llevamos al panel…
              </p>
            </div>
            <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-left space-y-2">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide">Próximos pasos sugeridos</p>
              <div className="space-y-1.5">
                <p className="text-white/40 text-xs flex items-center gap-2">
                  <span className="text-emerald-400">1.</span> Cargar tu carta y fotos de platos
                </p>
                <p className="text-white/40 text-xs flex items-center gap-2">
                  <span className="text-emerald-400">2.</span> Crear las mesas y descargar los QR
                </p>
                <p className="text-white/40 text-xs flex items-center gap-2">
                  <span className="text-emerald-400">3.</span> Invitar a tu equipo (garzones, cocina)
                </p>
              </div>
            </div>
            <Link href="/dashboard"
              className="block w-full py-3.5 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e85d2a] transition-colors text-center">
              Ir al panel →
            </Link>
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

// ── ClaimedWelcome ──────────────────────────────────────────────────────────
// El owner llega acá tras clickear el magic link de claim. Le mostramos:
//   1. Bienvenida con el nombre del restaurant
//   2. Lo que ya tenemos pre-cargado del agent_enriched
//   3. Qué le falta completar (con badges)
//   4. CTA grande al panel de edición (/restaurante)
//
// No re-pedimos contraseña ni datos básicos — eso ya pasó en el claim.
// La info del restaurant (agent_enriched) queda persistida y es base para
// que el owner la actualice desde el panel.

interface ClaimedRestaurant {
  id: string
  name: string
  slug: string
  neighborhood: string | null
  cuisine_type: string | null
  address: string | null
  description: string | null
  phone: string | null
  photo_url: string | null
  hours: Record<string, unknown> | null
}

function ClaimedWelcome({ restaurantId }: { restaurantId: string }) {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<ClaimedRestaurant | null>(null)
  const [authOk, setAuthOk] = useState<boolean | null>(null)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Magic link expirado o sesión perdida → redirigir a login
        router.replace(`/login?redirect=/register?claimed=${restaurantId}`)
        return
      }
      // Cargar el restaurant. El user ya tiene RLS de owner gracias al
      // team_members insertado por el endpoint de claim.
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, slug, neighborhood, cuisine_type, address, description, phone, photo_url, hours')
        .eq('id', restaurantId)
        .single()
      setRestaurant(data as ClaimedRestaurant | null)
      setAuthOk(true)
    })()
  }, [restaurantId, router])

  if (authOk === null) {
    return (
      <div className="w-full max-w-sm bg-[#13132A] rounded-2xl border border-white/8 p-8 text-center">
        <Loader2 size={20} className="text-white/40 mx-auto animate-spin" />
      </div>
    )
  }
  if (!restaurant) {
    return (
      <div className="w-full max-w-sm bg-[#13132A] rounded-2xl border border-white/8 p-8 text-center space-y-3">
        <AlertCircle size={24} className="text-amber-400 mx-auto" />
        <p className="text-sm text-white/70">No pudimos cargar el restaurant. El link puede haber expirado.</p>
        <Link href="/login" className="text-sm text-[#FF6B35] underline">Iniciar sesión</Link>
      </div>
    )
  }

  // Checklist de qué le falta al perfil — guía al owner sobre qué editar
  const missing: { key: string; label: string }[] = []
  if (!restaurant.description) missing.push({ key: 'desc', label: 'Descripción' })
  if (!restaurant.phone)       missing.push({ key: 'phone', label: 'Teléfono' })
  if (!restaurant.photo_url)   missing.push({ key: 'photo', label: 'Foto principal real' })
  if (!restaurant.hours || Object.keys(restaurant.hours).length === 0) {
    missing.push({ key: 'hours', label: 'Horarios' })
  }

  return (
    <div className="w-full max-w-md bg-[#13132A] rounded-2xl border border-white/8 p-8 space-y-5">
      <div className="text-center space-y-2">
        <Sparkles size={28} className="text-[#FF6B35] mx-auto" />
        <h1 className="text-xl font-bold text-white">¡Bienvenido a HiChapi!</h1>
        <p className="text-sm text-white/60">
          <span className="font-semibold text-white">{restaurant.name}</span> ya es tuyo.
        </p>
      </div>

      {/* Pre-cargado */}
      <div className="bg-white/5 rounded-xl border border-white/8 p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-wide font-semibold text-emerald-400">Ya tenemos esto cargado</p>
        <ul className="text-xs text-white/70 space-y-1">
          <li>• Nombre: <span className="text-white">{restaurant.name}</span></li>
          {restaurant.address && <li>• Dirección: <span className="text-white">{restaurant.address}</span></li>}
          {restaurant.neighborhood && <li>• Barrio: <span className="text-white">{restaurant.neighborhood}</span></li>}
          {restaurant.cuisine_type && <li>• Cocina: <span className="text-white capitalize">{restaurant.cuisine_type}</span></li>}
        </ul>
      </div>

      {/* Qué falta */}
      {missing.length > 0 && (
        <div className="bg-amber-500/5 rounded-xl border border-amber-500/15 p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-amber-300">Para completar tu perfil</p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map(m => (
              <span key={m.key} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-200 border border-amber-500/20">
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => router.push('/restaurante')}
        className="w-full py-3 rounded-xl bg-[#FF6B35] hover:bg-[#e55a2b] text-white font-semibold text-sm transition-colors"
      >
        Ir a editar mi perfil →
      </button>

      <p className="text-[10px] text-white/30 text-center leading-relaxed">
        Los datos los obtuvimos de fuentes públicas (Google Maps). Vos sos el dueño,
        así que tu edición es la versión oficial.
      </p>
    </div>
  )
}
