import type { Metadata } from 'next'
import Link from 'next/link'
import {
  MessageCircle,
  Search,
  Utensils,
  MapPin,
  QrCode,
  BarChart3,
  Users,
  Clock,
  ChefHat,
  Smartphone,
  ArrowRight,
  Star,
  Zap,
  Shield,
  TrendingUp,
  Leaf,
  DollarSign,
  Check,
  ChevronDown,
} from 'lucide-react'
import { FAQAccordion } from './FAQAccordion'

export const metadata: Metadata = {
  title: 'HiChapi — Tu guia gastronomica inteligente en Santiago',
  description:
    'Chapi es tu asistente de IA que entiende lo que quieres comer. Descubre restaurantes por barrio, presupuesto o dieta. Para restaurantes: gestión inteligente con solo 1% sobre ventas digitales.',
  openGraph: {
    title: 'HiChapi — Descubre donde comer en Santiago con IA',
    description:
      'Dile a Chapi que quieres comer y encuentra el restaurante perfecto. Sin gluten, vegano, por presupuesto o barrio.',
    type: 'website',
  },
}

/* ─── Data ─────────────────────────────────────────────────────────── */

const STATS = [
  { value: '50+', label: 'Restaurantes' },
  { value: '12', label: 'Barrios' },
  { value: '24/7', label: 'Disponible' },
  { value: '1%', label: 'Comisión digital' },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: MessageCircle,
    title: 'Dile a Chapi que quieres',
    desc: '"Algo sin gluten cerca de Providencia por 15 lucas" — Chapi entiende lenguaje natural, presupuesto chileno y restricciones dieteticas.',
  },
  {
    step: '02',
    icon: Search,
    title: 'Recibe recomendaciones reales',
    desc: 'Chapi busca en restaurantes verificados y te sugiere platos especificos, no solo nombres. Ves precios, distancia y rating.',
  },
  {
    step: '03',
    icon: QrCode,
    title: 'Escanea y pide en tu mesa',
    desc: 'En el restaurante, escanea el QR de tu mesa. Chapi ya sabe que buscabas y te recomienda del menu real.',
  },
]

const DINER_FEATURES = [
  {
    icon: MessageCircle,
    title: 'Chat con IA',
    desc: 'Habla con Chapi como le hablas a un amigo. Entiende "algo rico por aca", "vegano en Lastarria" o "25 lucas para dos".',
  },
  {
    icon: Leaf,
    title: 'Filtros dieteticos',
    desc: 'Sin gluten, vegano, vegetariano, keto, sin lactosa. Chapi filtra por ti automaticamente.',
  },
  {
    icon: MapPin,
    title: 'Por barrio',
    desc: 'Providencia, Nunoa, Bellavista, Barrio Italia, Las Condes, Vitacura — busca por la zona donde estes.',
  },
  {
    icon: DollarSign,
    title: 'Por presupuesto',
    desc: 'Dile cuanto quieres gastar. Chapi entiende "15 lucas", "$30.000" o "algo barato".',
  },
  {
    icon: Star,
    title: 'Platos sugeridos',
    desc: 'No solo ves el restaurante — Chapi te dice exactamente que plato pedir segun lo que buscas.',
  },
  {
    icon: Smartphone,
    title: 'Pide desde tu mesa',
    desc: 'Escanea el QR, ve el menu, agrega al carrito y pide sin esperar al garzon.',
  },
]

const RESTAURANT_FEATURES = [
  {
    icon: QrCode,
    title: 'Menu digital con QR',
    desc: 'Cada mesa tiene su QR. Los clientes ven tu carta, piden y pagan desde su celular.',
  },
  {
    icon: ChefHat,
    title: 'Cocina en tiempo real',
    desc: 'Pantalla de comandas tipo Kanban. Los pedidos llegan al instante, sin papeles.',
  },
  {
    icon: Users,
    title: 'Gestion de equipo',
    desc: 'Roles para duenos, admin, supervisores, garzones y cocina. Cada uno ve lo que necesita.',
  },
  {
    icon: BarChart3,
    title: 'Control de inventario',
    desc: 'Stock automatico que se descuenta con cada pedido. Alertas de minimo y registro de mermas.',
  },
  {
    icon: Clock,
    title: 'Lista de espera digital',
    desc: 'Tus clientes se anotan con QR en la entrada. Ven su posicion y tiempo estimado.',
  },
  {
    icon: TrendingUp,
    title: 'Chapi Insights',
    desc: 'IA que analiza tus ventas y te dice que promocionar, que platos destacar y cuando.',
  },
]

const TESTIMONIALS = [
  {
    quote: 'Le dije "algo sin gluten cerca" y me recomendo exactamente lo que buscaba. Increible.',
    author: 'Camila R.',
    role: 'Celiaca, Providencia',
    rating: 5,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80&fit=crop',
  },
  {
    quote: 'Mis clientes piden desde el celular y el pedido llega directo a cocina. Cero errores.',
    author: 'Felipe M.',
    role: 'Dueno, Osteria del Porto',
    rating: 5,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80&fit=crop',
  },
  {
    quote: 'Solo cobran 1% de lo digital y me dan visibilidad real. Recupero la inversion en el primer mes.',
    author: 'Andrea L.',
    role: 'Chef, La Meson',
    rating: 5,
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80&fit=crop',
  },
]

// ZONES removido 2026-04-19 junto con ZonesSection.

const PLANS = [
  {
    name: 'Free',
    badge: 'Para empezar',
    price: '$0',
    period: 'siempre gratis',
    description: 'Tu pagina en hichapi.com/tu-nombre lista en 5 minutos',
    features: [
      'Tu propia URL publica',
      'Carta digital con fotos',
      'Apareces en Chapi',
      'Lista de espera digital',
      'Link para Instagram y Google Maps',
    ],
    cta: 'Crear mi pagina gratis',
    href: '/unete',
    highlighted: false,
  },
  {
    name: 'Starter',
    badge: 'Para operar',
    price: '$29.990',
    period: '/ mes',
    description: 'Tus clientes piden desde la mesa. Sin papeles, sin errores.',
    features: [
      'Todo lo de Free',
      'Pedidos QR con Chapi',
      'Panel garzon en tiempo real',
      'Comandas de cocina',
      'Division de cuenta',
      'Control de caja',
    ],
    note: '+ 1% sobre ventas digitales procesadas',
    cta: 'Empezar gratis 30 dias',
    href: '/unete?plan=starter',
    highlighted: false,
  },
  {
    name: 'Pro',
    badge: 'Mas popular',
    price: '$59.990',
    period: '/ mes',
    description: 'Inteligencia de negocio y control total de operaciones.',
    features: [
      'Todo lo de Starter',
      'Reportes IA diarios',
      'Inventario y mermas',
      'Analytics avanzados',
      'Carga de inventario por foto o Excel',
    ],
    note: '+ 1% sobre ventas digitales procesadas',
    cta: 'Empezar gratis 30 dias',
    href: '/unete?plan=pro',
    highlighted: true,
  },
]

const FAQ_ITEMS = [
  {
    question: 'Que es el 1% de comision?',
    answer: 'Solo aplica sobre los pedidos que tus clientes pagan digitalmente a traves de HiChapi. Si un cliente paga en efectivo, no hay comision. Es nuestra forma de alinearnos con tu exito: si vendes mas, ganamos juntos.',
  },
  {
    question: 'Puedo cancelar cuando quiera?',
    answer: 'Si. Los planes mensuales se pueden cancelar en cualquier momento desde tu panel. Sin contratos de permanencia, sin letra chica. Si cancelas, tu pagina gratuita sigue activa.',
  },
  {
    question: 'Funciona para cafes, bares o negocios pequenos?',
    answer: 'Si. HiChapi es modular — activas solo lo que necesitas. Un cafe puede usar solo carta digital y loyalty sin gestion de mesas. Un bar puede usar inventario de licores. Cada negocio configura su propio setup.',
  },
  {
    question: 'Necesito cambiar mi sistema actual?',
    answer: 'No. HiChapi es complementario. Puedes seguir usando tu POS actual para lo que ya tienes y usar HiChapi para la carta digital, los pedidos QR y la visibilidad en Chapi Discovery.',
  },
  {
    question: 'Que pasa con los datos de mis ventas?',
    answer: 'Son tuyos 100%. Puedes exportar tus datos en cualquier momento en formato Excel. HiChapi nunca vende ni comparte los datos de tu negocio.',
  },
]

/* ─── Components ──────────────────────────────────────────────────── */

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-white/80 border-b border-neutral-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-bold text-xl tracking-tight"
          style={{ color: '#1A1A2E' }}
        >
          hi<span style={{ color: '#FF6B35' }}>chapi</span>
        </Link>
        <div className="hidden sm:flex items-center gap-8 text-sm text-neutral-500">
          <a href="#como-funciona" className="hover:text-[#FF6B35] transition-colors">Como funciona</a>
          <a href="#para-ti" className="hover:text-[#FF6B35] transition-colors">Para ti</a>
          <a href="#restaurantes" className="hover:text-[#FF6B35] transition-colors">Restaurantes</a>
          <a href="#planes" className="hover:text-[#FF6B35] transition-colors">Planes</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full
                       bg-[#FF6B35] text-white hover:bg-[#e55a2b] transition-colors shadow-sm"
          >
            Probar Chapi <ArrowRight size={14} />
          </Link>
          <Link
            href="/unete"
            className="text-sm font-medium text-neutral-500 hover:text-[#FF6B35] transition-colors"
          >
            Sumate
          </Link>
        </div>
      </div>
    </nav>
  )
}

function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-20 -left-32 w-96 h-96 bg-[#FF6B35]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#FF6B35]/5 rounded-full blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2
                       rounded-full border mb-8 animate-fade-in"
            style={{ background: '#FFF4EF', borderColor: '#FFD4C2', color: '#FF6B35' }}
          >
            <Zap size={12} />
            Potenciado por IA — Disponible en Santiago
          </div>

          <h1
            className="font-extrabold leading-[1.1] mb-6"
            style={{
              fontSize: 'clamp(2.2rem, 6vw, 4rem)',
              color: '#1A1A2E',
            }}
          >
            Tu proximo restaurante,{' '}
            <span className="relative">
              <span style={{ color: '#FF6B35' }}>a una conversacion</span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                <path d="M2 8 Q75 2 150 6 Q225 10 298 4" stroke="#FF6B35" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
              </svg>
            </span>
          </h1>

          <p className="text-lg lg:text-xl text-neutral-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Dile a Chapi que quieres comer — por barrio, presupuesto o dieta — y recibe
            recomendaciones reales con platos especificos. Como un amigo que sabe
            todos los restaurantes de Santiago.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <Link
              href="/"
              className="group flex items-center gap-3 px-8 py-4 rounded-2xl
                         bg-[#FF6B35] text-white font-bold text-base
                         hover:bg-[#e55a2b] transition-all shadow-lg shadow-[#FF6B35]/25
                         hover:shadow-xl hover:shadow-[#FF6B35]/30 hover:-translate-y-0.5"
            >
              <MessageCircle size={20} />
              Hablar con Chapi
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/unete"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl
                         border-2 border-neutral-200 text-[#1A1A2E] font-semibold text-base
                         hover:border-[#FF6B35] hover:text-[#FF6B35] transition-all"
            >
              <Utensils size={18} />
              Soy restaurante
            </Link>
          </div>

          {/* CAMBIO 5: Prueba social */}
          <p className="text-sm text-neutral-400 mb-12">
            Mas de 50 restaurantes en Santiago ya tienen su pagina en HiChapi
          </p>

          {/* Chat mockup */}
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-3xl shadow-2xl shadow-neutral-200/50 border border-neutral-100 p-6 text-left">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-[#FF6B35] flex items-center justify-center text-white font-bold text-sm">
                  C
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A2E]">Chapi</p>
                  <p className="text-xs text-green-500">En linea</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-[#FAFAF8] rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
                  <p className="text-sm text-[#1A1A2E]">
                    Hola! Que tienes ganas de comer hoy? Puedo buscar por zona, tipo de comida, presupuesto o dieta.
                  </p>
                </div>

                <div className="bg-[#FF6B35] rounded-2xl rounded-tr-md px-4 py-3 max-w-[80%] ml-auto">
                  <p className="text-sm text-white">
                    Algo japones en Providencia, sin gluten, por 20 lucas
                  </p>
                </div>

                <div className="bg-[#FAFAF8] rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
                  <p className="text-sm text-[#1A1A2E]">
                    Encontre 3 opciones perfectas! Te muestro los platos que puedes comer...
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4 flex-wrap">
                {['Sin gluten', 'Vegano', 'Italiano', 'Sushi'].map(chip => (
                  <span
                    key={chip}
                    className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-500
                               hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors cursor-pointer"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            {/* CAMBIO 5: Texto bajo chat */}
            <p className="text-xs text-neutral-400 mt-4 text-center">
              Sin crear cuenta · Sin tarjeta · Responde en segundos
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function StatsBar() {
  return (
    <section className="border-y border-neutral-100 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-extrabold text-[#FF6B35] mb-1">{value}</p>
              <p className="text-sm text-neutral-400">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="como-funciona" className="py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5
                       rounded-full border mb-4"
            style={{ background: '#FFF4EF', borderColor: '#FFD4C2', color: '#FF6B35' }}
          >
            Asi de facil
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-4">
            Como funciona
          </h2>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            De &quot;tengo hambre&quot; a &quot;estoy comiendo&quot; en 3 pasos
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="relative group">
              <div className="bg-white rounded-3xl border border-neutral-100 p-8 shadow-sm
                              hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF4EF] flex items-center justify-center
                                  group-hover:bg-[#FF6B35] transition-colors duration-300">
                    <Icon size={22} className="text-[#FF6B35] group-hover:text-white transition-colors duration-300" />
                  </div>
                  <span className="text-4xl font-extrabold text-neutral-100">{step}</span>
                </div>
                <h3 className="text-lg font-bold text-[#1A1A2E] mb-3">{title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function DinerFeatures() {
  return (
    <section id="para-ti" className="py-20 lg:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5
                       rounded-full border mb-4"
            style={{ background: '#FFF4EF', borderColor: '#FFD4C2', color: '#FF6B35' }}
          >
            Para comensales
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-4">
            Encuentra exactamente lo que quieres
          </h2>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            Chapi entiende tu lenguaje, tu presupuesto y tus restricciones
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {DINER_FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group bg-[#FAFAF8] rounded-2xl p-6 border border-transparent
                         hover:border-[#FF6B35]/20 hover:bg-white hover:shadow-lg
                         transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-xl bg-white border border-neutral-100 flex items-center justify-center mb-4
                              group-hover:bg-[#FF6B35] group-hover:border-[#FF6B35] transition-colors duration-300">
                <Icon size={20} className="text-[#FF6B35] group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="font-bold text-[#1A1A2E] mb-2">{title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── RestaurantShowcase ─────────────────────────────────────────────
   Reemplaza la vieja ComparisonSection. Vitrina visual de restaurants
   que ya están en HiChapi: recupera las fotos que había antes y
   transmite confianza mostrando que la plataforma tiene uso real. */
function RestaurantShowcase() {
  const restaurants = [
    {
      name: 'La Parrilla de Don Martín',
      zone: 'Providencia',
      tag: 'Parrilla · Chile',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
    },
    {
      name: 'Sazón Patagónica',
      zone: 'Ñuñoa',
      tag: 'Cocina de autor',
      image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80',
    },
    {
      name: 'Pizzería Trattoria',
      zone: 'Lastarria',
      tag: 'Italiana · Horno a leña',
      image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80',
    },
    {
      name: 'Sushi Ko',
      zone: 'Las Condes',
      tag: 'Japonés fusión',
      image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80',
    },
    {
      name: 'Fuente Alemana',
      zone: 'Centro',
      tag: 'Comida clásica chilena',
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
    },
    {
      name: 'Café Colmado',
      zone: 'Barrio Italia',
      tag: 'Brunch · Café de especialidad',
      image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80',
    },
  ]

  return (
    <section id="restaurantes-ya-dentro" className="py-20 lg:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5
                       rounded-full border mb-4"
            style={{ background: '#FFF4EF', borderColor: '#FFD4C2', color: '#FF6B35' }}
          >
            <Star size={12} /> Ya confían en HiChapi
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-4">
            Restaurantes que ya usan HiChapi
          </h2>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            Desde parrillas de barrio hasta cocina de autor. Todos empezaron gratis.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
          {restaurants.map(r => (
            <div
              key={r.name}
              className="group relative rounded-2xl overflow-hidden border border-neutral-100 bg-[#FAFAF8]
                         shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {/* Image */}
              <div className="aspect-[4/3] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image}
                  alt={r.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              {/* Overlay text */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent
                              flex flex-col justify-end p-4 lg:p-5">
                <p className="text-white font-bold text-sm lg:text-base leading-tight">{r.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin size={10} className="text-[#FF6B35]" />
                  <p className="text-neutral-300 text-[11px]">{r.zone}</p>
                  <span className="text-neutral-500 text-[11px]">·</span>
                  <p className="text-neutral-300 text-[11px]">{r.tag}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust signal */}
        <div className="mt-12 flex items-center justify-center gap-8 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Shield size={14} className="text-[#FF6B35]" />
            Datos encriptados
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Zap size={14} className="text-[#FF6B35]" />
            99.9% uptime
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Users size={14} className="text-[#FF6B35]" />
            Soporte en español
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Check size={14} className="text-[#FF6B35]" />
            Cancelas cuando quieras
          </div>
        </div>
      </div>
    </section>
  )
}

/* CAMBIO 2: Numeros concretos para restaurantes — fondo oscuro */
function RestaurantNumbers() {
  return (
    <section className="py-16 lg:py-20" style={{ background: '#1A1A2E' }}>
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-2xl lg:text-3xl font-extrabold text-white text-center mb-12">
          Lo que cambia cuando usas HiChapi
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {[
            { value: '$0', label: 'en web propia', sub: 'vs $200k en agencia' },
            { value: '<5 min', label: 'para publicar', sub: 'tu pagina' },
            { value: '1%', label: 'comisión digital', sub: '(Rappi: 30%)' },
            { value: '+23%', label: 'ticket promedio', sub: 'con QR' },
          ].map(({ value, label, sub }) => (
            <div key={label} className="text-center">
              <p className="text-3xl lg:text-4xl font-extrabold mb-2" style={{ color: '#FF6B35' }}>
                {value}
              </p>
              <p className="text-sm text-white font-medium mb-1">{label}</p>
              <p className="text-xs text-neutral-500">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function RestaurantFeatures() {
  return (
    <section id="restaurantes" className="py-20 lg:py-28 relative overflow-hidden">
      {/* Orbs decorativos */}
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-[#FF6B35]/8 rounded-full blur-3xl -translate-y-1/2" />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left — Mockup del panel (transmite confianza visual) */}
          <div className="mb-12 lg:mb-0 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-neutral-300/40 border border-neutral-200 bg-[#0E0E14]">
              {/* Mock header del panel */}
              <div className="bg-[#161622] border-b border-white/5 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                </div>
                <p className="text-white/60 text-[10px] ml-3 font-mono">hichapi.com/dashboard</p>
              </div>
              {/* Mock KPIs */}
              <div className="p-5 space-y-4 bg-[#0E0E14]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-wider">Hoy</p>
                    <p className="text-white text-xl font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>$1.2M</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-400/10 px-2 py-1 rounded-lg">
                    <TrendingUp size={11} /> +18%
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <p className="text-white/40 text-[9px]">PEDIDOS</p>
                    <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>47</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <p className="text-white/40 text-[9px]">TICKET</p>
                    <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>$25k</p>
                  </div>
                  <div className="bg-[#FF6B35]/10 rounded-xl p-3 border border-[#FF6B35]/30">
                    <p className="text-[#FF6B35] text-[9px]">MESAS</p>
                    <p className="text-white text-sm font-bold" style={{ fontFamily: 'var(--font-dm-mono)' }}>12/14</p>
                  </div>
                </div>
                {/* Mock gráfico de barras */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white/60 text-[10px] font-semibold">Órdenes por hora</p>
                    <Clock size={10} className="text-white/30" />
                  </div>
                  <div className="flex items-end gap-0.5 h-12">
                    {[30, 45, 60, 50, 80, 95, 70, 55, 90, 85, 65, 40].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t bg-[#FF6B35]/80" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                {/* Chapi tip mockup */}
                <div className="bg-gradient-to-br from-[#FF6B35]/10 to-transparent rounded-xl p-3 border border-[#FF6B35]/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Zap size={11} className="text-[#FF6B35]" />
                    <p className="text-white text-[10px] font-semibold">Chapi dice</p>
                  </div>
                  <p className="text-white/70 text-[10px] leading-snug">
                    Tu pico es a las 20h. Considera destacar el Lomo Vetado en el menú digital.
                  </p>
                </div>
              </div>
            </div>
            {/* Badge flotante */}
            <div className="absolute -top-3 -right-3 bg-white shadow-lg rounded-full px-3 py-1.5 flex items-center gap-1.5 border border-neutral-100">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[10px] font-semibold text-[#1A1A2E]">En tiempo real</p>
            </div>
          </div>

          {/* Right — text + features */}
          <div>
            <div
              className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5
                         rounded-full border mb-4"
              style={{ background: '#FFF4EF', borderColor: '#FFD4C2', color: '#FF6B35' }}
            >
              Para restaurantes
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-4 leading-[1.1]">
              Todo tu restaurante en un solo lugar
            </h2>
            <p className="text-neutral-500 text-lg mb-6 leading-relaxed">
              Panel en tiempo real para gestionar pedidos, equipo, inventario y mesas.
              Solo 1% sobre ventas digitales. El cliente llega directo a ti.
            </p>

            {/* Feature grid compacto */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {RESTAURANT_FEATURES.slice(0, 6).map(({ icon: Icon, title }) => (
                <div
                  key={title}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white border border-neutral-100 shadow-sm
                             hover:border-[#FF6B35]/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#FFF4EF] flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-[#FF6B35]" />
                  </div>
                  <p className="text-sm font-semibold text-[#1A1A2E] leading-tight">{title}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/unete"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                           bg-[#FF6B35] text-white font-semibold text-sm
                           hover:bg-[#e55a2b] transition-colors shadow-lg shadow-[#FF6B35]/25"
              >
                Sumar mi restaurante <ArrowRight size={14} />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                           border border-neutral-200 text-neutral-600 font-semibold text-sm
                           hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* CAMBIO 1: Pricing section */
function PricingSection() {
  return (
    <section id="planes" className="py-20 lg:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5
                       rounded-full border mb-4"
            style={{ background: '#FFF4EF', borderColor: '#FFD4C2', color: '#FF6B35' }}
          >
            Planes
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-4">
            Elige como quieres operar
          </h2>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            Empieza gratis. Paga solo si lo usas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {PLANS.map(({ name, badge, price, period, description, features, note, cta, href, highlighted }) => (
            <div
              key={name}
              className={`relative rounded-3xl p-8 flex flex-col ${
                highlighted
                  ? 'border-2 border-[#FF6B35] bg-white shadow-xl shadow-[#FF6B35]/10'
                  : 'border border-neutral-200 bg-white shadow-sm'
              }`}
            >
              {/* Badge */}
              {highlighted ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF6B35] text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                  {badge}
                </div>
              ) : (
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  {badge}
                </span>
              )}

              {/* Price */}
              <div className="mb-4 mt-2">
                <span className="text-4xl font-extrabold text-[#1A1A2E]" style={{ fontFamily: 'var(--font-dm-mono), monospace' }}>
                  {price}
                </span>
                <span className="text-sm text-neutral-400 ml-1">{period}</span>
              </div>

              <p className="text-sm text-neutral-500 mb-6 leading-relaxed">{description}</p>

              {/* Features */}
              <ul className="space-y-3 mb-6 flex-1">
                {features.map(feat => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-[#1A1A2E]">
                    <Check size={16} className="text-[#FF6B35] shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>

              {/* Note */}
              {note && (
                <p className="text-xs text-neutral-400 mb-4 px-3 py-2 bg-neutral-50 rounded-lg text-center">
                  {note}
                </p>
              )}

              {/* CTA */}
              <Link
                href={href}
                className={`block text-center py-3.5 rounded-xl font-semibold text-sm transition-all ${
                  highlighted
                    ? 'bg-[#FF6B35] text-white hover:bg-[#e55a2b] shadow-sm'
                    : 'border border-neutral-200 text-[#1A1A2E] hover:border-[#FF6B35] hover:text-[#FF6B35]'
                }`}
              >
                {cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Legal note */}
        <p className="text-center text-xs text-neutral-400 mt-8 max-w-lg mx-auto leading-relaxed">
          Los primeros 30 dias son gratis en cualquier plan pago. Sin tarjeta de credito para empezar. Cancela cuando quieras.
        </p>
      </div>
    </section>
  )
}

function Testimonials() {
  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-4">
            Lo que dicen de Chapi
          </h2>
          <p className="text-neutral-400 text-lg">
            Comensales y restaurantes que ya usan HiChapi
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ quote, author, role, rating, avatar }) => (
            <div
              key={author}
              className="bg-white rounded-2xl p-7 border border-neutral-100 shadow-sm
                         hover:shadow-xl hover:-translate-y-1 transition-all duration-300
                         flex flex-col"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: rating }).map((_, i) => (
                  <Star key={i} size={14} className="text-[#FF6B35] fill-[#FF6B35]" />
                ))}
              </div>
              <p className="text-sm text-[#1A1A2E] mb-6 leading-relaxed italic flex-1">
                &ldquo;{quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-5 border-t border-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar}
                  alt={author}
                  className="w-11 h-11 rounded-full object-cover border-2 border-[#FFD4C2]"
                  loading="lazy"
                />
                <div>
                  <p className="font-semibold text-sm text-[#1A1A2E]">{author}</p>
                  <p className="text-xs text-neutral-400">{role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ZonesSection removida 2026-04-19 por pedido del usuario.
// La antigua sección "Disponible en toda Santiago" ya no se muestra.

/* CAMBIO 4: FAQ Section */
function FAQSection() {
  return (
    <section id="faq" className="py-20 lg:py-28">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-4">
            Preguntas frecuentes
          </h2>
          <p className="text-neutral-400 text-lg">
            Todo lo que necesitas saber antes de empezar
          </p>
        </div>

        <FAQAccordion items={FAQ_ITEMS} />
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-4xl mx-auto px-6">
        <div
          className="relative rounded-3xl p-10 lg:p-16 text-center overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1A1A2E 0%, #2D2D4E 100%)' }}
        >
          {/* Decorative orbs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6B35]/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#FF6B35]/10 rounded-full blur-3xl" />

          <div className="relative">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-4">
              Listo para descubrir<br />
              <span style={{ color: '#FF6B35' }}>tu proximo restaurante?</span>
            </h2>
            <p className="text-neutral-400 text-lg mb-10 max-w-lg mx-auto">
              Chapi esta esperando. Dile que quieres comer y dejate sorprender.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/"
                className="group flex items-center gap-3 px-8 py-4 rounded-2xl
                           bg-[#FF6B35] text-white font-bold text-base
                           hover:bg-[#e55a2b] transition-all shadow-lg shadow-[#FF6B35]/30"
              >
                <MessageCircle size={20} />
                Hablar con Chapi
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/unete"
                className="flex items-center gap-2 px-8 py-4 rounded-2xl
                           border-2 border-white/20 text-white font-semibold text-base
                           hover:border-[#FF6B35] hover:text-[#FF6B35] transition-all"
              >
                Sumar mi restaurante
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-neutral-100 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="sm:col-span-2">
            <p className="font-bold text-xl tracking-tight mb-3" style={{ color: '#1A1A2E' }}>
              hi<span style={{ color: '#FF6B35' }}>chapi</span>
            </p>
            <p className="text-sm text-neutral-400 max-w-xs leading-relaxed">
              Tu guia gastronomica inteligente en Santiago. Potenciado por IA,
              creado para comensales y restaurantes.
            </p>
          </div>

          {/* Links */}
          <div>
            <p className="text-sm font-semibold text-[#1A1A2E] mb-3">Producto</p>
            <ul className="space-y-2 text-sm text-neutral-400">
              <li><Link href="/" className="hover:text-[#FF6B35] transition-colors">Probar Chapi</Link></li>
              <li><Link href="/unete" className="hover:text-[#FF6B35] transition-colors">Sumar restaurante</Link></li>
              <li><Link href="/login" className="hover:text-[#FF6B35] transition-colors">Iniciar sesion</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#1A1A2E] mb-3">Compania</p>
            <ul className="space-y-2 text-sm text-neutral-400">
              <li><span className="text-neutral-300">Santiago, Chile</span></li>
              <li><a href="mailto:hola@hichapi.com" className="hover:text-[#FF6B35] transition-colors">hola@hichapi.com</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-neutral-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-300">
            &copy; {new Date().getFullYear()} HiChapi. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-1 text-xs text-neutral-300">
            <Shield size={12} />
            <span>Hecho con IA en Santiago</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <main className="min-h-screen" style={{ background: '#FAFAF8', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
      <Navbar />
      <HeroSection />
      <StatsBar />
      <HowItWorks />
      <DinerFeatures />
      <RestaurantShowcase />
      <RestaurantNumbers />
      <RestaurantFeatures />
      <PricingSection />
      <Testimonials />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </main>
  )
}
