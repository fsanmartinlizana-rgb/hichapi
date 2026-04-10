import type { Metadata } from 'next'
import { DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'HiChapi — Encuentra tu próximo restaurante en Santiago',
  description:
    'Dile a Chapi qué quieres comer y encuentra el restaurante perfecto. Sin gluten, vegano, por presupuesto o barrio.',
  keywords:
    'restaurantes Santiago, sin gluten Santiago, vegano Providencia, dónde comer Santiago',
  openGraph: {
    title: 'HiChapi — Tu guía gastronómica inteligente',
    description: 'Chapi entiende lo que quieres comer.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
