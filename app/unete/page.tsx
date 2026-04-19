import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'
import { OnboardingWizard } from './OnboardingWizard'

export const metadata: Metadata = {
  title: 'Suma tu restaurante a HiChapi',
  description:
    'Conecta tu restaurante con miles de personas que buscan donde comer en Santiago. Tu pagina lista en 5 minutos, gratis.',
}

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

      {/* Wizard */}
      <section className="max-w-2xl mx-auto px-6 pb-20">
        <Suspense fallback={<div className="h-96 rounded-2xl bg-neutral-100 animate-pulse" />}>
          <OnboardingWizard />
        </Suspense>
      </section>

      <footer className="text-center pb-8 text-xs text-neutral-300">
        HiChapi · Santiago, Chile
      </footer>
    </main>
  )
}
