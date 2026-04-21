'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  MessageCircle,
  Utensils,
  ArrowRight,
  Leaf,
  MapPin,
  DollarSign,
  Star,
  Smartphone,
  CalendarDays,
  Grid3X3,
  BarChart2,
  ClipboardList,
  Package,
  Sparkles,
} from 'lucide-react'

/* ── Data per audience ─────────────────────────────────────────────── */

const AUDIENCES = {
  comensal: {
    badge: 'Soy comensal',
    headline: (
      <>
        Descubre dónde comer con{' '}
        <span style={{ color: '#FF6B35' }}>inteligencia artificial</span>
      </>
    ),
    subtitle:
      'Chapi es tu amigo IA que conoce todos los restaurantes de Santiago. Dile qué se te antoja, tu presupuesto o tu dieta y te recomienda exactamente lo que buscas.',
    cta: { label: 'Descubrir restaurantes', href: '/buscar', icon: MessageCircle },
    secondaryCta: { label: 'Hablar con Chapi', href: '/buscar' },
    image:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80',
    alt: 'Mesa de un restaurante en la noche',
    features: [
      { icon: MessageCircle, label: 'Chat con IA en lenguaje natural' },
      { icon: Leaf, label: 'Filtros: vegano, sin gluten, keto...' },
      { icon: MapPin, label: 'Busca por barrio o cercanía' },
      { icon: DollarSign, label: 'Filtra por presupuesto chileno' },
      { icon: Star, label: 'Recomendaciones de platos reales' },
      { icon: CalendarDays, label: 'Reserva tu mesa al instante' },
    ],
  },
  restaurante: {
    badge: 'Tengo un restaurante',
    headline: (
      <>
        El sistema operativo{' '}
        <span style={{ color: '#FF6B35' }}>inteligente</span> para tu restaurante
      </>
    ),
    subtitle:
      'HiChapi gestiona pedidos, cocina, mesas, equipo, inventario, caja y reportes — todo conectado y con IA. Solo 1 % sobre ventas digitales.',
    cta: { label: 'Registrar mi restaurante', href: '/register', icon: Utensils },
    secondaryCta: { label: 'Ya tengo cuenta', href: '/login' },
    image:
      'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1600&q=80',
    alt: 'Cocina profesional trabajando con orden',
    features: [
      { icon: Grid3X3, label: 'Mesas + QR por mesa' },
      { icon: ClipboardList, label: 'Comandas en vivo (KDS)' },
      { icon: Sparkles, label: 'Carta digital con IA' },
      { icon: Package, label: 'Stock e inventario' },
      { icon: BarChart2, label: 'Reportes y analytics' },
      { icon: Smartphone, label: 'Pedidos desde el celular' },
    ],
  },
} as const

type Audience = keyof typeof AUDIENCES

/* ── Component ─────────────────────────────────────────────────────── */

export default function HeroToggle() {
  const [active, setActive] = useState<Audience>('comensal')
  const data = AUDIENCES[active]
  const CtaIcon = data.cta.icon

  return (
    <section className="relative pt-28 pb-12 lg:pt-36 lg:pb-16 overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-20 -left-32 w-96 h-96 bg-[#FF6B35]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#FF6B35]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* ── Toggle ── */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-full p-1 bg-neutral-100 border border-neutral-200">
            {(['comensal', 'restaurante'] as Audience[]).map((key) => (
              <button
                key={key}
                onClick={() => setActive(key)}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                  active === key
                    ? 'bg-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/25'
                    : 'text-neutral-500 hover:text-[#1A1A2E]'
                }`}
              >
                {key === 'comensal' ? 'Soy comensal' : 'Tengo un restaurante'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Hero content ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: copy */}
          <div className="text-center lg:text-left">
            <h1
              className="font-extrabold leading-[1.08] mb-5"
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                color: '#1A1A2E',
              }}
            >
              {data.headline}
            </h1>

            <p className="text-base lg:text-lg text-neutral-500 leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
              {data.subtitle}
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-8">
              {data.features.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5
                             rounded-full bg-[#FFF4EF] text-[#FF6B35] border border-[#FFD4C2]/60"
                >
                  <Icon size={12} />
                  {label}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                href={data.cta.href}
                className="group inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl
                           bg-[#FF6B35] text-white font-bold text-base
                           hover:bg-[#e55a2b] transition-all shadow-lg shadow-[#FF6B35]/25
                           hover:shadow-xl hover:shadow-[#FF6B35]/30 hover:-translate-y-0.5"
              >
                <CtaIcon size={17} />
                {data.cta.label}
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href={data.secondaryCta.href}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl
                           border-2 border-neutral-200 text-[#1A1A2E] font-semibold text-sm
                           hover:border-[#FF6B35] hover:text-[#FF6B35] transition-all"
              >
                {data.secondaryCta.label}
              </Link>
            </div>
          </div>

          {/* Right: image card */}
          <div className="relative rounded-3xl overflow-hidden shadow-xl shadow-neutral-300/30 aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.image}
              alt={data.alt}
              className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
              loading="eager"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(26,26,46,0.1) 0%, rgba(26,26,46,0.45) 100%)',
              }}
            />
            {/* Badge on image */}
            <span
              className="absolute top-4 left-4 text-[10px] font-bold uppercase tracking-widest
                         px-3 py-1.5 rounded-full backdrop-blur-md"
              style={{
                background: 'rgba(255,255,255,0.18)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              {data.badge}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
