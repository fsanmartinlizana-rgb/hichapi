'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle,
  Upload,
  FileSpreadsheet,
  FileText,
  Plus,
  Copy,
  ExternalLink,
  Trash2,
  Zap,
} from 'lucide-react'

/* ─── Helpers ─────────────────────────────────────────────────────── */

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const STORAGE_KEY = 'hichapi_onboarding'

interface ManualDish {
  name: string
  price: string
  description: string
}

interface WizardState {
  // Step 1
  businessName: string
  businessType: string
  phone: string
  // Step 2
  dishes: ManualDish[]
  // Meta
  step: number
  plan: string
}

const DEFAULT_STATE: WizardState = {
  businessName: '',
  businessType: '',
  phone: '',
  dishes: [],
  step: 1,
  plan: 'free',
}

const inputClass =
  'w-full rounded-xl border border-neutral-200 px-4 py-3 text-[#1A1A2E] text-sm ' +
  'bg-white placeholder:text-neutral-300 focus:outline-none focus:border-[#FF6B35] ' +
  'transition-colors duration-150'

const BUSINESS_TYPES = [
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'bar', label: 'Bar' },
  { value: 'dark-kitchen', label: 'Dark Kitchen' },
  { value: 'otro', label: 'Otro' },
]

/* ─── Component ───────────────────────────────────────────────────── */

export function OnboardingWizard() {
  const searchParams = useSearchParams()
  const [state, setState] = useState<WizardState>(DEFAULT_STATE)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setState(prev => ({ ...prev, ...parsed }))
      }
    } catch { /* ignore */ }

    // Read plan from URL
    const planParam = searchParams.get('plan')
    if (planParam && ['starter', 'pro'].includes(planParam)) {
      setState(prev => ({ ...prev, plan: planParam }))
    }
  }, [searchParams])

  // Persist to localStorage on state change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch { /* ignore */ }
  }, [state])

  const slug = toSlug(state.businessName)
  const canGoStep2 = state.businessName.trim().length >= 2 && state.businessType !== '' && state.phone.trim().length >= 6
  const canGoStep3 = state.dishes.length >= 3

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState(prev => ({ ...prev, [key]: value }))
  }

  function goTo(step: number) {
    setState(prev => ({ ...prev, step }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Add empty dish
  function addDish() {
    setState(prev => ({
      ...prev,
      dishes: [...prev.dishes, { name: '', price: '', description: '' }],
    }))
  }

  function updateDish(index: number, field: keyof ManualDish, value: string) {
    setState(prev => {
      const dishes = [...prev.dishes]
      dishes[index] = { ...dishes[index], [field]: value }
      return { ...prev, dishes }
    })
  }

  function removeDish(index: number) {
    setState(prev => ({
      ...prev,
      dishes: prev.dishes.filter((_, i) => i !== index),
    }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/submit-restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.businessName,
          address: 'Por completar',
          neighborhood: 'Por completar',
          cuisine_type: state.businessType,
          price_range: 'medio',
          owner_name: state.businessName,
          owner_email: `${slug}@pendiente.hichapi.com`,
          owner_phone: state.phone,
          description: `Plan: ${state.plan}. ${state.dishes.length} platos cargados.`,
          instagram_url: '',
        }),
      })

      if (res.ok) {
        setSubmitted(true)
        localStorage.removeItem(STORAGE_KEY)
        goTo(3)
      }
    } catch { /* */ }
    setSubmitting(false)
  }

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(`hichapi.com/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [slug])

  /* ─── Step Indicator ──────────────────────────────────────────── */
  function StepIndicator() {
    const steps = ['Lo basico', 'Tu carta', 'Publicar']
    return (
      <div className="flex items-center justify-center gap-2 mb-10">
        {steps.map((label, i) => {
          const stepNum = i + 1
          const isActive = state.step === stepNum
          const isDone = state.step > stepNum
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`w-8 h-px ${isDone ? 'bg-[#FF6B35]' : 'bg-neutral-200'}`} />
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isDone
                      ? 'bg-[#FF6B35] text-white'
                      : isActive
                        ? 'bg-[#FF6B35] text-white'
                        : 'bg-neutral-100 text-neutral-400'
                  }`}
                >
                  {isDone ? <CheckCircle size={16} /> : stepNum}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${
                  isActive ? 'text-[#1A1A2E]' : 'text-neutral-400'
                }`}>
                  {label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  /* ─── Step 1: Lo basico ───────────────────────────────────────── */
  function Step1() {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 md:p-8">
        <h2 className="text-xl font-bold text-[#1A1A2E] mb-6">Lo basico</h2>

        <div className="space-y-5">
          {/* Business name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A2E]">
              Como se llama tu negocio? <span className="text-[#FF6B35]">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej: La Picada de Ramon"
              value={state.businessName}
              onChange={e => update('businessName', e.target.value)}
              className={inputClass}
            />
            {slug && (
              <p className="text-xs text-neutral-400 mt-1">
                Tu pagina quedara en:{' '}
                <span className="font-mono text-[#FF6B35] font-medium">
                  hichapi.com/{slug}
                </span>
              </p>
            )}
          </div>

          {/* Business type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A2E]">
              Que tipo de negocio es? <span className="text-[#FF6B35]">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BUSINESS_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update('businessType', value)}
                  className={`py-3 px-3 rounded-xl border text-sm font-medium transition-all ${
                    state.businessType === value
                      ? 'bg-[#FF6B35] border-[#FF6B35] text-white'
                      : 'bg-white border-neutral-200 text-neutral-500 hover:border-[#FF6B35]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A2E]">
              Tu numero de contacto <span className="text-[#FF6B35]">*</span>
            </label>
            <input
              type="tel"
              placeholder="+56 9 1234 5678"
              value={state.phone}
              onChange={e => update('phone', e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-neutral-400">Para activacion — no se publica</p>
          </div>
        </div>

        <button
          onClick={() => goTo(2)}
          disabled={!canGoStep2}
          className="mt-8 w-full flex items-center justify-center gap-2 py-4 rounded-xl
                     bg-[#FF6B35] hover:bg-[#e55a2b] disabled:bg-neutral-200 disabled:cursor-not-allowed
                     text-white font-semibold text-base transition-colors"
        >
          Siguiente <ArrowRight size={16} />
        </button>
      </div>
    )
  }

  /* ─── Step 2: Tu carta ────────────────────────────────────────── */
  function Step2() {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 md:p-8">
        <h2 className="text-xl font-bold text-[#1A1A2E] mb-2">Tu carta</h2>
        <p className="text-sm text-neutral-400 mb-6">
          Tienes tu carta en algun formato?
        </p>

        {/* Upload options */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            type="button"
            className="flex flex-col items-center gap-2 py-5 px-3 rounded-xl border border-neutral-200
                       text-neutral-400 hover:border-[#FF6B35] hover:text-[#FF6B35] transition-all text-center"
          >
            <Upload size={22} />
            <span className="text-xs font-medium">Subir foto</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-2 py-5 px-3 rounded-xl border border-neutral-200
                       text-neutral-400 hover:border-[#FF6B35] hover:text-[#FF6B35] transition-all text-center"
          >
            <FileSpreadsheet size={22} />
            <span className="text-xs font-medium">Excel/CSV</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-2 py-5 px-3 rounded-xl border border-neutral-200
                       text-neutral-400 hover:border-[#FF6B35] hover:text-[#FF6B35] transition-all text-center"
          >
            <FileText size={22} />
            <span className="text-xs font-medium">PDF</span>
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-neutral-100" />
          <span className="text-xs text-neutral-300">o</span>
          <div className="flex-1 h-px bg-neutral-100" />
        </div>

        {/* Manual dishes */}
        <button
          type="button"
          onClick={addDish}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed
                     border-neutral-200 text-sm text-neutral-500 font-medium
                     hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors mb-4"
        >
          <Plus size={16} />
          Agregar plato manualmente
        </button>

        {state.dishes.length > 0 && (
          <div className="space-y-3 mb-4">
            {state.dishes.map((dish, i) => (
              <div key={i} className="bg-[#FAFAF8] rounded-xl p-4 border border-neutral-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-neutral-400">Plato {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeDish(i)}
                    className="text-neutral-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre del plato"
                    value={dish.name}
                    onChange={e => updateDish(i, 'name', e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="Precio (ej: 12000)"
                    value={dish.price}
                    onChange={e => updateDish(i, 'price', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Descripcion breve (opcional)"
                  value={dish.description}
                  onChange={e => updateDish(i, 'description', e.target.value)}
                  className={inputClass + ' mt-3'}
                />
              </div>
            ))}
          </div>
        )}

        <p className={`text-xs mb-6 ${
          state.dishes.length >= 3 ? 'text-green-600' : 'text-neutral-400'
        }`}>
          {state.dishes.length >= 3
            ? `${state.dishes.length} platos agregados`
            : `Necesitas al menos 3 platos para publicar tu pagina. (${state.dishes.length}/3)`
          }
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => goTo(1)}
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl
                       border border-neutral-200 text-neutral-500 font-semibold text-sm
                       hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
          >
            <ArrowLeft size={14} /> Atras
          </button>
          <button
            onClick={() => {
              if (!submitted) handleSubmit()
              else goTo(3)
            }}
            disabled={!canGoStep3 || submitting}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl
                       bg-[#FF6B35] hover:bg-[#e55a2b] disabled:bg-neutral-200 disabled:cursor-not-allowed
                       text-white font-semibold text-base transition-colors"
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> Creando pagina...</>
            ) : (
              <>Publicar mi pagina <ArrowRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    )
  }

  /* ─── Step 3: Publicar ────────────────────────────────────────── */
  function Step3() {
    const selectedPlan = state.plan
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 md:p-8 text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle size={52} className="text-[#FF6B35]" strokeWidth={1.5} />
        </div>

        <h2 className="text-2xl font-bold text-[#1A1A2E] mb-2">
          Tu pagina esta lista!
        </h2>
        <p className="text-sm text-neutral-400 mb-8">
          Ya puedes compartirla con tus clientes
        </p>

        {/* Preview URL */}
        <div className="bg-[#FAFAF8] rounded-xl border border-neutral-100 p-5 mb-6">
          <p className="text-xs text-neutral-400 uppercase tracking-wider font-medium mb-2">
            Tu pagina
          </p>
          <p className="text-lg font-bold text-[#1A1A2E] font-mono">
            hichapi.com/<span className="text-[#FF6B35]">{slug}</span>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mb-10">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-neutral-200
                       text-sm font-semibold text-neutral-600 hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
          >
            <Copy size={14} />
            {copied ? 'Copiado!' : 'Copiar link'}
          </button>
          <a
            href={`https://www.instagram.com/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-neutral-200
                       text-sm font-semibold text-neutral-600 hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
          >
            <ExternalLink size={14} />
            Compartir en Instagram
          </a>
        </div>

        {/* Upsell */}
        <div className="border-t border-neutral-100 pt-8">
          <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
            Quieres que tus clientes puedan pedir desde la mesa?<br />
            Activa Starter gratis por 30 dias.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/login"
              className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                         font-semibold text-sm transition-colors ${
                           selectedPlan === 'starter' || selectedPlan === 'pro'
                             ? 'bg-[#FF6B35] text-white hover:bg-[#e55a2b] shadow-sm ring-2 ring-[#FF6B35]/20'
                             : 'bg-[#FF6B35] text-white hover:bg-[#e55a2b] shadow-sm'
                         }`}
            >
              <Zap size={16} />
              Activar Starter gratis
            </a>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                         border border-neutral-200 text-neutral-600 font-semibold text-sm
                         hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
            >
              Seguir con Free
            </a>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Render ──────────────────────────────────────────────────── */
  return (
    <div>
      <StepIndicator />
      {state.step === 1 && <Step1 />}
      {state.step === 2 && <Step2 />}
      {state.step === 3 && <Step3 />}
    </div>
  )
}
