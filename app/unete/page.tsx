import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Utensils, TrendingUp, Users } from 'lucide-react'
import { SubmissionForm } from '@/components/onboarding/SubmissionForm'

export const metadata: Metadata = {
  title: 'Suma tu restaurante a HiChapi',
  description:
    'Conecta tu restaurante con miles de personas que buscan dónde comer en Santiago. Súmate a la comunidad HiChapi.',
}

const BENEFITS = [
  {
    icon: Users,
    title: 'Visibilidad real',
    desc:  'Aparece cuando alguien busca exactamente lo que tú ofreces.',
  },
  {
    icon: Utensils,
    title: 'Tu carta, completa',
    desc:  'Carga tus platos con fotos, precios y etiquetas dietéticas.',
  },
  {
    icon: TrendingUp,
    title: 'Sin comisiones',
    desc:  'HiChapi es discovery, no delivery. El cliente llega a ti directamente.',
  },
]

export default function UnetePage() {
  return (
    <main className="min-h-screen" style={{ background: '#FAFAF8' }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-4xl mx-auto">
        <Link
          href="/"
          className="font-bold text-xl tracking-tight"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif', color: '#1A1A2E' }}
        >
          hi<span style={{ color: '#FF6B35' }}>chapi</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-[#FF6B35] transition-colors"
        >
          <ArrowLeft size={14} />
          Volver
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-8 pb-12 text-center">
        <div
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5
                     rounded-full border mb-6"
          style={{
            background: '#FFF4EF',
            borderColor: '#FFD4C2',
            color: '#FF6B35',
          }}
        >
          <span>🍽️</span>
          Para dueños de restaurantes
        </div>

        <h1
          className="font-bold mb-4 leading-tight"
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
            color: '#1A1A2E',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          Conecta tu restaurante<br />
          <span style={{ color: '#FF6B35' }}>con quien busca lo tuyo</span>
        </h1>
        <p
          className="text-neutral-400 text-base max-w-lg mx-auto"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          Chapi recomienda restaurantes en Santiago en tiempo real. Suma el tuyo
          y aparece cuando alguien busca exactamente lo que ofreces.
        </p>
      </section>

      {/* Benefits strip */}
      <section className="max-w-4xl mx-auto px-6 mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {BENEFITS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: '#FFF4EF' }}
              >
                <Icon size={18} style={{ color: '#FF6B35' }} />
              </div>
              <p className="font-semibold text-[#1A1A2E] text-sm mb-1">{title}</p>
              <p className="text-xs text-neutral-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Form */}
      <section className="max-w-2xl mx-auto px-6 pb-20">
        <h2
          className="text-lg font-bold mb-6 text-center"
          style={{ color: '#1A1A2E', fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          Completa tu solicitud
        </h2>
        <SubmissionForm />
      </section>

      <footer className="text-center pb-8 text-xs text-neutral-300">
        HiChapi · Santiago, Chile
      </footer>
    </main>
  )
}
