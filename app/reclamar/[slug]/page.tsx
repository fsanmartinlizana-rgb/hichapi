'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, CheckCircle, Loader2, Store, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface RestaurantInfo {
  id: string
  name: string
  slug: string
  neighborhood: string
  cuisine_type: string
  claimed: boolean
}

export default function ClaimPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    message: '',
  })

  // Fetch restaurant info
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, slug, neighborhood, cuisine_type, claimed')
        .eq('slug', slug)
        .single()

      if (data) setRestaurant(data)
      setLoading(false)
    }
    load()
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant) return
    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/restaurants/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          owner_name: form.owner_name,
          owner_email: form.owner_email,
          owner_phone: form.owner_phone || undefined,
          message: form.message || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al enviar la solicitud')
        setSubmitting(false)
        return
      }

      setSuccess(true)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 size={24} className="text-[#FF6B35] animate-spin" />
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-neutral-500">Restaurante no encontrado</p>
          <Link href="/" className="text-[#FF6B35] text-sm font-medium">Volver al inicio</Link>
        </div>
      </div>
    )
  }

  if (restaurant.claimed) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-100 shadow-sm p-8 text-center space-y-4">
          <AlertCircle size={40} className="text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold text-[#1A1A2E]">Restaurante ya reclamado</h1>
          <p className="text-sm text-neutral-500">
            {restaurant.name} ya fue reclamado por su dueño.
            Si crees que esto es un error, contáctanos.
          </p>
          <Link
            href={`/r/${restaurant.slug}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] transition-colors"
          >
            Ver restaurante
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-100 shadow-sm p-8 text-center space-y-4">
          <CheckCircle size={48} className="text-emerald-500 mx-auto" />
          <h1 className="text-xl font-bold text-[#1A1A2E]">Solicitud enviada</h1>
          <p className="text-sm text-neutral-500 leading-relaxed">
            Revisaremos tu solicitud para <strong>{restaurant.name}</strong> y te contactaremos
            a <strong>{form.owner_email}</strong> en las próximas 24 horas.
          </p>
          <Link
            href={`/r/${restaurant.slug}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] transition-colors"
          >
            Volver al perfil
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Back link */}
        <Link
          href={`/r/${restaurant.slug}`}
          className="inline-flex items-center gap-1.5 text-neutral-400 text-sm hover:text-neutral-600 transition-colors"
        >
          <ArrowLeft size={14} />
          Volver a {restaurant.name}
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#FF6B35]/10 flex items-center justify-center">
              <Store size={20} className="text-[#FF6B35]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1A1A2E]">Reclamar {restaurant.name}</h1>
              <p className="text-xs text-neutral-400">
                {restaurant.cuisine_type} · {restaurant.neighborhood}
              </p>
            </div>
          </div>

          <p className="text-sm text-neutral-500 leading-relaxed">
            Al reclamar este restaurante podrás administrar su perfil,
            subir la carta digital, recibir pedidos con QR y acceder
            al panel completo de HiChapi.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 space-y-5">
          <h2 className="text-sm font-semibold text-[#1A1A2E]">Datos del dueño</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Nombre completo *
              </label>
              <input
                type="text"
                required
                value={form.owner_name}
                onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm text-[#1A1A2E]
                           focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35]"
                placeholder="Tu nombre"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Correo electrónico *
              </label>
              <input
                type="email"
                required
                value={form.owner_email}
                onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm text-[#1A1A2E]
                           focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35]"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Teléfono (opcional)
              </label>
              <input
                type="tel"
                value={form.owner_phone}
                onChange={e => setForm(f => ({ ...f, owner_phone: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm text-[#1A1A2E]
                           focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35]"
                placeholder="+56 9 1234 5678"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                Mensaje (opcional)
              </label>
              <textarea
                rows={3}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm text-[#1A1A2E] resize-none
                           focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35]"
                placeholder="Cuéntanos cómo podemos verificar que eres el dueño..."
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold
                       hover:bg-[#e55a2b] disabled:opacity-50 transition-colors
                       flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar solicitud'
            )}
          </button>

          <p className="text-[10px] text-neutral-400 text-center leading-relaxed">
            Revisaremos tu solicitud y te contactaremos dentro de 24 horas.
            Solo aprobamos solicitudes de dueños verificados.
          </p>
        </form>
      </div>
    </div>
  )
}
