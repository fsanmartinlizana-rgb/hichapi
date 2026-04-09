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
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'HiChapi — Tu guia gastronomica inteligente en Santiago',
  description:
    'Chapi es tu asistente de IA que entiende lo que quieres comer. Descubre restaurantes por barrio, presupuesto o dieta. Para restaurantes: gestion inteligente sin comisiones.',
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
  { value: '0%', label: 'Comisiones' },
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
  },
  {
    quote: 'Mis clientes piden desde el celular y el pedido llega directo a cocina. Cero errores.',
    author: 'Felipe M.',
    role: 'Dueno, Osteria del Porto',
    rating: 5,
  },
  {
    quote: 'Por fin algo que no cobra comision y me da visibilidad real. No es otro delivery app.',
    author: 'Andrea L.',
    role: 'Chef, La Meson',
    rating: 5,
  },
]

const ZONES = [
  'Providencia', 'Las Condes', 'Nunoa', 'Vitacura',
  'Bellavista', 'Lastarria', 'Barrio Italia', 'Santiago Centro',
  'Lo Barnechea', 'La Reina', 'Barrio Yungay', 'Manuel Montt',
]

/* ─── Components ──────────────────────────────────────────────────── */

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-white/80 border-b border-neutral-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/landing"
          className="font-bold text-xl tracking-tight"
          style={{ color: '#1A1A2E' }}
        >
          hi<span style={{ color: '#FF6B35' }}>chapi</span>
        </Link>
        <div className="hidden sm:flex items-center gap-8 text-sm text-neutral-500">
          <a href="#como-funciona" className="hover:text-[#FF6B35] transition-colors">Como funciona</a>
          <a href="#para-ti" className="hover:text-[#FF6B35] transition-colors">Para ti</a>
          <a href="#restaurantes" className="hover:text-[#FF6B35] transition-colors">Restaurantes</a>
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

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
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
            De "tengo hambre" a "estoy comiendo" en 3 pasos
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

function RestaurantFeatures() {
  return (
    <section id="restaurantes" className="py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
          {/* Left — text */}
          <div className="mb-12 lg:mb-0">
            <div
              className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5
                         rounded-full border mb-4"
              style={{ background: '#FFF4EF', borderColor: '#FFD4C2', color: '#FF6B35' }}
            >
              Para restaurantes
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-4">
              Tu restaurante, inteligente
            </h2>
            <p className="text-neutral-400 text-lg mb-8 leading-relaxed">
              Panel completo para gestionar pedidos, equipo, inventario y mesas.
              Sin comisiones, sin intermediarios. El cliente llega directo a ti.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/unete"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                           bg-[#FF6B35] text-white font-semibold text-sm
                           hover:bg-[#e55a2b] transition-colors shadow-sm"
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

          {/* Right — feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {RESTAURANT_FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm
                           hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-xl bg-[#FFF4EF] flex items-center justify-center mb-3">
                  <Icon size={18} className="text-[#FF6B35]" />
                </div>
                <h3 className="font-semibold text-[#1A1A2E] text-sm mb-1">{title}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  return (
    <section className="py-20 lg:py-28 bg-white">
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
          {TESTIMONIALS.map(({ quote, author, role, rating }) => (
            <div
              key={author}
              className="bg-[#FAFAF8] rounded-2xl p-6 border border-neutral-100
                         hover:bg-white hover:shadow-lg transition-all duration-300"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: rating }).map((_, i) => (
                  <Star key={i} size={14} className="text-[#FF6B35] fill-[#FF6B35]" />
                ))}
              </div>
              <p className="text-sm text-[#1A1A2E] mb-6 leading-relaxed italic">
                &ldquo;{quote}&rdquo;
              </p>
              <div>
                <p className="font-semibold text-sm text-[#1A1A2E]">{author}</p>
                <p className="text-xs text-neutral-400">{role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ZonesSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-4">
          Disponible en toda Santiago
        </h2>
        <p className="text-neutral-400 text-lg mb-10 max-w-xl mx-auto">
          Y seguimos creciendo. Si tu barrio no esta, avisanos.
        </p>
        <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
          {ZONES.map(zone => (
            <span
              key={zone}
              className="px-4 py-2 rounded-full bg-white border border-neutral-100 text-sm text-neutral-600
                         hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors cursor-default shadow-sm"
            >
              <MapPin size={12} className="inline mr-1.5 -mt-0.5" />
              {zone}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function ComparisonSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-4">
            No somos delivery. Somos discovery.
          </h2>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto">
            HiChapi no compite con apps de delivery. Complementamos la experiencia presencial.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Others */}
          <div className="rounded-2xl border border-neutral-200 p-8 bg-neutral-50">
            <p className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-6">Apps de delivery</p>
            <ul className="space-y-4">
              {[
                'Comisiones del 20-30%',
                'El cliente no va al restaurante',
                'Competencia por precio',
                'Sin relacion con el comensal',
                'Tu marca se pierde',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-sm text-neutral-400">
                  <span className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs">x</span>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* HiChapi */}
          <div className="rounded-2xl border-2 border-[#FF6B35]/30 p-8 bg-[#FFF4EF]/30 relative">
            <div className="absolute -top-3 left-6 bg-[#FF6B35] text-white text-xs font-bold px-3 py-1 rounded-full">
              HiChapi
            </div>
            <p className="text-sm font-bold text-[#FF6B35] uppercase tracking-wider mb-6">Discovery + Gestion</p>
            <ul className="space-y-4">
              {[
                'Sin comisiones — jamas',
                'El cliente va presencial',
                'Recomendacion inteligente por IA',
                'Relacion directa con el comensal',
                'Tu marca siempre visible',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-sm text-[#1A1A2E]">
                  <span className="w-5 h-5 rounded-full bg-[#FF6B35] flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={12} className="text-white" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
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
      <ComparisonSection />
      <RestaurantFeatures />
      <Testimonials />
      <ZonesSection />
      <FinalCTA />
      <Footer />
    </main>
  )
}
