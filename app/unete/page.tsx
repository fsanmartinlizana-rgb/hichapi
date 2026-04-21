import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Suma tu restaurante a HiChapi',
  description:
    'Conecta tu restaurante con miles de personas que buscan donde comer en Santiago. Tu pagina lista en 5 minutos, gratis.',
}

export default function UnetePage() {
  redirect('/register')
}
