'use client'

import { useState, FormEvent } from 'react'
import { Loader2, CheckCircle, ChevronDown } from 'lucide-react'
import { RestaurantSubmission } from '@/lib/types'

const INITIAL: RestaurantSubmission = {
  name: '',
  address: '',
  neighborhood: '',
  cuisine_type: '',
  price_range: 'medio',
  owner_name: '',
  owner_email: '',
  owner_phone: '',
  description: '',
  instagram_url: '',
}

const PRICE_OPTIONS = [
  { value: 'economico', label: 'Económico',  hint: 'Menos de $10.000' },
  { value: 'medio',     label: 'Precio medio', hint: '$10.000 – $20.000' },
  { value: 'premium',   label: 'Premium',    hint: 'Más de $20.000'    },
] as const

const NEIGHBORHOODS = [
  'Providencia', 'Barrio Italia', 'Bellavista', 'Lastarria', 'Santiago Centro',
  'Las Condes', 'Vitacura', 'Ñuñoa', 'Miraflores', 'San Miguel', 'La Florida',
  'Maipú', 'Recoleta', 'Independencia', 'Otro',
]

function InputField({
  label, required = false, children,
}: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#1A1A2E]">
        {label}
        {required && <span className="text-[#FF6B35] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-xl border border-neutral-200 px-4 py-3 text-[#1A1A2E] text-sm ' +
  'bg-white placeholder:text-neutral-300 focus:outline-none focus:border-[#FF6B35] ' +
  'transition-colors duration-150'

export function SubmissionForm() {
  const [form, setForm]     = useState<RestaurantSubmission>(INITIAL)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  function set(field: keyof RestaurantSubmission) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrMsg('')

    try {
      const res  = await fetch('/api/submit-restaurant', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()

      if (res.ok) {
        setStatus('success')
      } else {
        setStatus('error')
        setErrMsg(data.error ?? 'Algo salió mal. Intenta de nuevo.')
      }
    } catch {
      setStatus('error')
      setErrMsg('Error de conexión. Revisa tu internet e intenta de nuevo.')
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-10 text-center max-w-lg mx-auto">
        <div className="flex justify-center mb-4">
          <CheckCircle size={52} className="text-[#FF6B35]" strokeWidth={1.5} />
        </div>
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: '#1A1A2E', fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          ¡Listo, recibimos tu solicitud!
        </h2>
        <p className="text-neutral-400 text-sm leading-relaxed mb-6">
          Nuestro equipo revisará la información de{' '}
          <span className="font-semibold text-[#1A1A2E]">{form.name}</span> y te
          contactará a{' '}
          <span className="font-semibold text-[#1A1A2E]">{form.owner_email}</span>{' '}
          en los próximos días hábiles.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm px-6 py-3 rounded-full
                     bg-[#FF6B35] hover:bg-[#e55a2b] text-white font-medium
                     transition-colors duration-150"
        >
          Volver a Chapi
        </a>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 md:p-8"
    >
      {/* ── Sección 1: Datos del restaurante ────────────────────────────── */}
      <div className="mb-6">
        <h3
          className="text-base font-bold mb-4 pb-3 border-b border-neutral-100"
          style={{ color: '#1A1A2E' }}
        >
          Datos del restaurante
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <InputField label="Nombre del restaurante" required>
            <input
              type="text"
              placeholder="Ej: La Picada de Ramón"
              value={form.name}
              onChange={set('name')}
              required
              className={inputClass}
            />
          </InputField>

          <InputField label="Barrio / Zona" required>
            <div className="relative">
              <select
                value={form.neighborhood}
                onChange={set('neighborhood')}
                required
                className={inputClass + ' appearance-none pr-9'}
              >
                <option value="">Selecciona un barrio</option>
                {NEIGHBORHOODS.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
            </div>
          </InputField>

          <InputField label="Dirección" required>
            <input
              type="text"
              placeholder="Ej: Av. Italia 1234, Barrio Italia"
              value={form.address}
              onChange={set('address')}
              required
              className={inputClass}
            />
          </InputField>

          <InputField label="Tipo de cocina" required>
            <input
              type="text"
              placeholder="Ej: italiana, japonesa, chilena contemporánea"
              value={form.cuisine_type}
              onChange={set('cuisine_type')}
              required
              className={inputClass}
            />
          </InputField>

          {/* Price range — pill selector */}
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A2E]">
              Rango de precio <span className="text-[#FF6B35]">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRICE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, price_range: opt.value }))}
                  className={[
                    'flex flex-col items-center py-3 px-2 rounded-xl border text-sm',
                    'transition-all duration-150 cursor-pointer',
                    form.price_range === opt.value
                      ? 'bg-[#FF6B35] border-[#FF6B35] text-white'
                      : 'bg-white border-neutral-200 text-neutral-500 hover:border-[#FF6B35]',
                  ].join(' ')}
                >
                  <span className="font-semibold text-xs">{opt.label}</span>
                  <span
                    className={`text-[10px] mt-0.5 ${
                      form.price_range === opt.value ? 'text-white/80' : 'text-neutral-400'
                    }`}
                  >
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Description — full width */}
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A1A2E]">
              Descripción breve{' '}
              <span className="text-neutral-400 font-normal">(opcional)</span>
            </label>
            <textarea
              placeholder="Cuéntanos qué hace especial a tu restaurante..."
              value={form.description}
              onChange={set('description')}
              rows={3}
              maxLength={500}
              className={inputClass + ' resize-none'}
            />
            <p className="text-[11px] text-neutral-300 text-right">
              {(form.description ?? '').length}/500
            </p>
          </div>

          <InputField label="Instagram">
            <input
              type="text"
              placeholder="@turestaurante"
              value={form.instagram_url}
              onChange={set('instagram_url')}
              className={inputClass}
            />
          </InputField>

        </div>
      </div>

      {/* ── Sección 2: Datos de contacto ────────────────────────────────── */}
      <div className="mb-8">
        <h3
          className="text-base font-bold mb-4 pb-3 border-b border-neutral-100"
          style={{ color: '#1A1A2E' }}
        >
          Datos de contacto
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <InputField label="Tu nombre" required>
            <input
              type="text"
              placeholder="Nombre del dueño o encargado"
              value={form.owner_name}
              onChange={set('owner_name')}
              required
              className={inputClass}
            />
          </InputField>

          <InputField label="Email de contacto" required>
            <input
              type="email"
              placeholder="hola@turestaurante.cl"
              value={form.owner_email}
              onChange={set('owner_email')}
              required
              className={inputClass}
            />
          </InputField>

          <InputField label="Teléfono / WhatsApp">
            <input
              type="tel"
              placeholder="+56 9 1234 5678"
              value={form.owner_phone}
              onChange={set('owner_phone')}
              className={inputClass}
            />
          </InputField>

        </div>
      </div>

      {/* Error banner */}
      {status === 'error' && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
          {errMsg}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl
                   bg-[#FF6B35] hover:bg-[#e55a2b] disabled:bg-neutral-200
                   text-white font-semibold text-base
                   transition-colors duration-150"
      >
        {status === 'loading' ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Enviando solicitud…
          </>
        ) : (
          'Enviar solicitud'
        )}
      </button>

      <p className="mt-3 text-center text-xs text-neutral-300">
        Revisamos cada solicitud manualmente. Te contactamos en 2–3 días hábiles.
      </p>
    </form>
  )
}
