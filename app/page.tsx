import type { Metadata } from 'next'
import Link from 'next/link'
import {
  MessageCircle,
  Search,
  Utensils,
  MapPin,
  QrCode,
  BarChart2,
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
  Sparkles,
  Bike,
  Banknote,
  Boxes,
  ClipboardList,
  Grid3X3,
  Package,
  CalendarDays,
  FileText,
  Printer,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'HiChapi — Discovery con IA + Restaurante inteligente',
  description:
    'Dos productos, una plataforma. Para comensales: Chapi te recomienda dónde comer en Santiago. Para restaurantes: el sistema operativo completo para gestionar tu negocio.',
  openGraph: {
    title: 'HiChapi — Discovery con IA + Restaurante inteligente',
    description:
      'Chapi recomienda restaurantes a tus clientes. HiChapi gestiona tu cocina, mesas, equipo, caja y más.',
    type: 'website',
  },
}

/* ──────────────────────────────────────────────────────────────────────
 *  DATA
 * ────────────────────────────────────────────────────────────────────── */

const STATS = [
  { value: '50+', label: 'Restaurantes' },
  { value: '12',  label: 'Barrios' },
  { value: '24/7',label: 'Disponible' },
  { value: '1%',  label: 'Comisión digital' },
]

const HERO_SPLIT = {
  diner: {
    eyebrow: 'Para comensales',
    title:   'No sabes dónde comer?',
    subtitle:'Chapi es tu amigo IA que conoce todos los restaurantes de Santiago. Le hablas como a un amigo y te recomienda exactamente lo que buscas — por barrio, presupuesto o dieta.',
    cta:     { label: 'Hablar con Chapi', href: '/buscar', icon: MessageCircle },
    image:   'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80',
    alt:     'Mesa de un restaurante en la noche',
  },
  restaurant: {
    eyebrow: 'Para restaurantes',
    title:   'Tu restaurante necesita un cerebro',
    subtitle:'HiChapi es el sistema operativo de tu restaurante: pedidos, cocina, mesas, equipo, inventario, caja, reportes — todo conectado y con IA. Solo 1% sobre ventas digitales.',
    cta:     { label: 'Sumar mi restaurante', href: '/unete', icon: Utensils },
    image:   'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1600&q=80',
    alt:     'Cocina profesional trabajando con orden',
  },
}

const HOW_DINER = [
  {
    step: '01',
    icon: MessageCircle,
    title: 'Le hablas a Chapi',
    desc:  '"Algo sin gluten cerca de Providencia por 15 lucas". Lenguaje natural, presupuesto chileno, restricciones — Chapi entiende todo.',
  },
  {
    step: '02',
    icon: Search,
    title: 'Recibe recomendaciones reales',
    desc:  'Restaurantes verificados con platos específicos, precios, distancia y rating — no solo nombres genéricos.',
  },
  {
    step: '03',
    icon: QrCode,
    title: 'Pides desde la mesa',
    desc:  'Llegas, escaneas el QR, conversas con Chapi sobre el menú real y pides sin esperar al garzón.',
  },
]

const HOW_RESTAURANT = [
  {
    step: '01',
    icon: BookIcon,
    title: 'Cargas tu carta en 5 minutos',
    desc:  'Sube una foto de tu menú impreso o un PDF. La IA detecta platos, precios y categorías automáticamente.',
  },
  {
    step: '02',
    icon: QrCode,
    title: 'Pegas QR sobre tus mesas',
    desc:  'Cada mesa tiene su QR único. Tus clientes ven tu carta, piden y pagan sin esperar.',
  },
  {
    step: '03',
    icon: ChefHat,
    title: 'Operas con el panel',
    desc:  'Cocina, garzones, mesas, stock, caja, reportes — todo en un solo lugar. Y Chapi te avisa si algo importante pasa.',
  },
]

function BookIcon(props: React.ComponentProps<typeof QrCode>) {
  // Lucide does not export "BookOpen" with the alias name in default import,
  // so we use Sparkles as a stand-in to keep this file self-contained.
  return <Sparkles {...props} />
}

const DINER_FEATURES = [
  { icon: MessageCircle, title: 'Chat con IA',         desc: 'Habla como con un amigo. Entiende "algo rico por aca", "vegano en Lastarria" o "25 lucas para dos".' },
  { icon: Leaf,          title: 'Filtros dietéticos',   desc: 'Sin gluten, vegano, vegetariano, keto, sin lactosa. Chapi filtra por ti automáticamente.' },
  { icon: MapPin,        title: 'Por barrio',           desc: 'Providencia, Ñuñoa, Bellavista, Lastarria, Las Condes — busca por la zona donde estés.' },
  { icon: DollarSign,    title: 'Por presupuesto',      desc: 'Dile cuánto quieres gastar. Chapi entiende "15 lucas", "$30.000" o "algo barato".' },
  { icon: Star,          title: 'Platos sugeridos',     desc: 'No solo te muestra el restaurante — Chapi te dice exactamente qué plato pedir.' },
  { icon: Smartphone,    title: 'Pide desde tu mesa',   desc: 'Escanea el QR, ve el menú real y pide sin esperar al garzón.' },
]

/** Todos los módulos del sistema operativo de restaurante */
const MODULES = [
  { icon: Grid3X3,       title: 'Mesas + QR',         desc: 'Genera QR únicos por mesa, divide y une mesas, controla zonas.' },
  { icon: ClipboardList, title: 'Comandas en vivo',    desc: 'Kitchen display tipo Kanban: Recibida → En cocina → Lista → Entregada.' },
  { icon: Sparkles,      title: 'Carta digital',       desc: 'Importa tu carta con IA desde foto o PDF. Tags, destinos, disponibilidad.' },
  { icon: Users,         title: 'Equipo y roles',      desc: 'Garzón, cocina, supervisor, admin. Multi-rol soportado para equipos chicos.' },
  { icon: Package,       title: 'Stock e inventario',  desc: 'Descuento automático con cada pedido, alertas de mínimo, registro de mermas.' },
  { icon: Banknote,      title: 'Caja',                desc: 'Apertura/cierre de turno, conciliación cash + digital, diferencia de caja.' },
  { icon: BarChart2,     title: 'Reportes y analytics',desc: 'Ventas del día, top platos, ticket promedio, comparativos por hora.' },
  { icon: Sparkles,      title: 'Chapi Insights',      desc: 'IA que conversa contigo sobre tu negocio en tiempo real y te ayuda a decidir.' },
  { icon: Clock,         title: 'Lista de espera',     desc: 'Anota grupos en la entrada, notifícalos por WhatsApp cuando hay mesa.' },
  { icon: Bike,          title: 'Integraciones delivery', desc: 'PedidosYa, Rappi, Uber Eats, Justo, DiDi Food, Cornershop.' },
  { icon: FileText,      title: 'Boletas DTE',         desc: 'Boletas y facturas electrónicas Chile (SII).' },
  { icon: Printer,       title: 'Impresoras térmicas', desc: 'Imprime comandas y boletas en cualquier impresora térmica.' },
]

const TESTIMONIALS = [
  { quote: 'Le dije "algo sin gluten cerca" y me recomendó exactamente lo que buscaba.',   author: 'Camila R.',  role: 'Celíaca, Providencia',     rating: 5 },
  { quote: 'Mis clientes piden desde el celular y el pedido llega directo a cocina. Cero errores.', author: 'Felipe M.',  role: 'Dueño, Osteria del Porto', rating: 5 },
  { quote: 'Solo cobran 1% de lo digital y me dan visibilidad real. No es otro delivery.',     author: 'Andrea L.',  role: 'Chef, La Mesón',            rating: 5 },
]

const ZONES = [
  'Providencia', 'Las Condes', 'Ñuñoa', 'Vitacura',
  'Bellavista', 'Lastarria', 'Barrio Italia', 'Santiago Centro',
  'Lo Barnechea', 'La Reina', 'Barrio Yungay', 'Manuel Montt',
]

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'siempre',
    desc: 'Para empezar y publicar tu restaurante en discovery.',
    features: ['Perfil público', 'Mesas + QR', 'Comandas básicas', 'Carta digital', 'Lista de espera'],
    cta: 'Empezar gratis',
  },
  {
    name: 'Starter',
    price: '$29.990',
    period: '/mes',
    desc: 'Para restaurantes que quieren operar full con HiChapi.',
    features: ['Todo de Free', 'Stock + mermas', 'Turnos', 'Importar carta con IA', 'Soporte prioritario'],
    cta: 'Probar Starter',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$59.990',
    period: '/mes',
    desc: 'Para restaurantes que quieren ver todo con datos.',
    features: ['Todo de Starter', 'Reportes diarios', 'Chapi Insights ilimitado', 'Analytics avanzado', 'Fidelización'],
    cta: 'Probar Pro',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '$149.990',
    period: '/mes',
    desc: 'Multi-local, geofencing, API y soporte 24/7.',
    features: ['Todo de Pro', 'Multi-local', 'API pública', 'Geofencing', 'Soporte 24/7'],
    cta: 'Contactar',
  },
]

/* ──────────────────────────────────────────────────────────────────────
 *  COMPONENTS
 * ────────────────────────────────────────────────────────────────────── */

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-white/85 border-b border-neutral-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-bold text-xl tracking-tight"
          style={{ color: '#1A1A2E' }}
        >
          hi<span style={{ color: '#FF6B35' }}>chapi</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-neutral-500">
          <a href="#productos"   className="hover:text-[#FF6B35] transition-colors">Productos</a>
          <a href="#modulos"     className="hover:text-[#FF6B35] transition-colors">Módulos</a>
          <a href="#planes"      className="hover:text-[#FF6B35] transition-colors">Planes</a>
          <a href="#testimonios" className="hover:text-[#FF6B35] transition-colors">Testimonios</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/buscar"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full
                       bg-[#FF6B35] text-white hover:bg-[#e55a2b] transition-colors shadow-sm"
          >
            Probar Chapi <ArrowRight size={14} />
          </Link>
          <Link
            href="/unete"
            className="text-sm font-medium text-neutral-500 hover:text-[#FF6B35] transition-colors"
          >
            Sumar mi restaurante
          </Link>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="relative pt-28 pb-12 lg:pt-36 lg:pb-16 overflow-hidden">
      <div className="absolute top-20 -left-32 w-96 h-96 bg-[#FF6B35]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#FF6B35]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2
                       rounded-full border mb-6 animate-fade-in"
            style={{ background: '#FFF4EF', borderColor: '#FFD4C2', color: '#FF6B35' }}
          >
            <Zap size={12} />
            Dos productos, una plataforma
          </div>

          <h1
            className="font-extrabold leading-[1.05] mb-5"
            style={{
              fontSize: 'clamp(2.2rem, 5.5vw, 4rem)',
              color: '#1A1A2E',
            }}
          >
            La plataforma que conecta{' '}
            <span style={{ color: '#FF6B35' }}>comensales con restaurantes</span>
          </h1>

          <p className="text-base lg:text-xl text-neutral-500 max-w-2xl mx-auto leading-relaxed">
            Por un lado: Chapi recomienda dónde comer. <br className="hidden sm:block" />
            Por otro: tu restaurante opera con un cerebro inteligente.
          </p>
        </div>

        {/* Two-product split */}
        <div id="productos" className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-7">
          <ProductCard product={HERO_SPLIT.diner}      tone="diner" />
          <ProductCard product={HERO_SPLIT.restaurant} tone="restaurant" />
        </div>
      </div>
    </section>
  )
}

function ProductCard({
  product,
  tone,
}: {
  product: typeof HERO_SPLIT.diner
  tone: 'diner' | 'restaurant'
}) {
  const Icon = product.cta.icon
  return (
    <div
      className="group relative rounded-3xl overflow-hidden border border-neutral-100 shadow-lg
                 shadow-neutral-200/40 hover:shadow-2xl hover:shadow-neutral-300/40
                 hover:-translate-y-1 transition-all duration-300 bg-white"
    >
      {/* Background image — Ken Burns animation simulates a video */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.alt}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[8s] ease-out
                     group-hover:scale-110"
          style={{ animation: tone === 'diner' ? 'kenburns-left 25s ease-out infinite alternate' : 'kenburns-right 25s ease-out infinite alternate' }}
          loading="eager"
        />
        {/* Dark gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(26,26,46,0.3) 0%, rgba(26,26,46,0.78) 80%, rgba(26,26,46,0.92) 100%)' }}
        />
        {/* Eyebrow */}
        <span
          className="absolute top-4 left-4 text-[10px] font-bold uppercase tracking-widest
                     px-3 py-1.5 rounded-full backdrop-blur-md"
          style={{
            background: 'rgba(255,255,255,0.18)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.25)',
          }}
        >
          {product.eyebrow}
        </span>
        {/* Title block sitting over the image */}
        <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-8">
          <h3 className="text-white text-2xl lg:text-3xl font-extrabold leading-tight mb-2">
            {product.title}
          </h3>
          <p className="text-white/80 text-sm lg:text-[15px] leading-relaxed max-w-md">
            {product.subtitle}
          </p>
        </div>
      </div>

      {/* CTA bar */}
      <div className="px-6 py-5 bg-white">
        <Link
          href={product.cta.href}
          className="flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl
                     bg-[#1A1A2E] hover:bg-[#FF6B35] text-white font-semibold text-sm
                     transition-colors duration-200 group/btn"
        >
          <span className="flex items-center gap-2.5">
            <Icon size={17} />
            {product.cta.label}
          </span>
          <ArrowRight size={15} className="group-hover/btn:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
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

/* ── Diner side ─────────────────────────────────────────────────────── */

function DinerSection() {
  return (
    <section id="comensales" className="relative py-20 lg:py-28 overflow-hidden">
      {/* Subtle background image */}
      <div className="absolute inset-0 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2000&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-[0.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAFAF8] via-[#FAFAF8]/95 to-[#FAFAF8]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border mb-4"
            style={{ background: '#FFF4EF', borderColor: '#FFD4C2', color: '#FF6B35' }}
          >
            Para comensales
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-3">
            Encuentra exactamente lo que quieres comer
          </h2>
          <p className="text-neutral-500 text-lg max-w-xl mx-auto">
            De &ldquo;tengo hambre&rdquo; a &ldquo;estoy comiendo&rdquo; en 3 pasos
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {HOW_DINER.map(({ step, icon: Icon, title, desc }) => (
            <div
              key={step}
              className="group relative bg-white rounded-3xl border border-neutral-100 p-7 shadow-sm
                         hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF4EF] flex items-center justify-center
                                group-hover:bg-[#FF6B35] transition-colors duration-300">
                  <Icon size={22} className="text-[#FF6B35] group-hover:text-white transition-colors duration-300" />
                </div>
                <span className="text-4xl font-extrabold text-neutral-100">{step}</span>
              </div>
              <h3 className="text-lg font-bold text-[#1A1A2E] mb-2">{title}</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Diner features grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-4xl mx-auto mb-12">
          {DINER_FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-neutral-100
                         hover:border-[#FF6B35]/30 hover:shadow-md transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-[#FFF4EF] flex items-center justify-center mb-3">
                <Icon size={16} className="text-[#FF6B35]" />
              </div>
              <h4 className="font-bold text-[#1A1A2E] text-sm mb-1">{title}</h4>
              <p className="text-[11px] text-neutral-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Link
            href="/buscar"
            className="group flex items-center gap-3 px-8 py-4 rounded-2xl
                       bg-[#FF6B35] text-white font-bold text-base
                       hover:bg-[#e55a2b] transition-all shadow-lg shadow-[#FF6B35]/25
                       hover:shadow-xl hover:shadow-[#FF6B35]/30 hover:-translate-y-0.5"
          >
            <MessageCircle size={18} />
            Hablar con Chapi ahora
            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ── Restaurant side ─────────────────────────────────────────────────── */

function RestaurantSection() {
  return (
    <section id="restaurantes" className="relative py-20 lg:py-28 overflow-hidden bg-[#0F0F1C] text-white">
      {/* Background image */}
      <div className="absolute inset-0 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=2000&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25"
          style={{ animation: 'kenburns-right 30s ease-out infinite alternate' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(15,15,28,0.92) 0%, rgba(15,15,28,0.85) 50%, rgba(15,15,28,0.96) 100%)' }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border mb-4"
            style={{
              background: 'rgba(255,107,53,0.15)',
              borderColor: 'rgba(255,107,53,0.35)',
              color: '#FF6B35',
            }}
          >
            Para restaurantes
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-3">
            El sistema operativo de tu restaurante
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Pedidos, cocina, mesas, equipo, stock, caja, reportes — todo conectado.
            Y con Chapi como copiloto inteligente que te ayuda a decidir.
          </p>
        </div>

        {/* 3-step how */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {HOW_RESTAURANT.map(({ step, icon: Icon, title, desc }) => (
            <div
              key={step}
              className="group bg-white/5 rounded-3xl border border-white/10 p-7
                         hover:bg-white/8 hover:border-[#FF6B35]/40 transition-all"
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-[#FF6B35]/15 flex items-center justify-center
                                group-hover:bg-[#FF6B35] transition-colors duration-300">
                  <Icon size={22} className="text-[#FF6B35] group-hover:text-white transition-colors duration-300" />
                </div>
                <span className="text-4xl font-extrabold text-white/8">{step}</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/unete"
            className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl
                       bg-[#FF6B35] text-white font-bold text-base
                       hover:bg-[#e55a2b] transition-all shadow-lg shadow-[#FF6B35]/30"
          >
            <Utensils size={17} />
            Sumar mi restaurante
            <ArrowRight size={15} />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl
                       border-2 border-white/15 text-white font-semibold text-base
                       hover:border-[#FF6B35] hover:text-[#FF6B35] transition-all"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ── Modules grid ────────────────────────────────────────────────────── */

function ModulesGrid() {
  return (
    <section id="modulos" className="py-20 lg:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border mb-4"
            style={{ background: '#FFF4EF', borderColor: '#FFD4C2', color: '#FF6B35' }}
          >
            12 módulos en una sola plataforma
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-3">
            Todo lo que tu restaurante necesita
          </h2>
          <p className="text-neutral-500 text-lg max-w-xl mx-auto">
            Un sistema operativo completo, sin contratos. Solo 1% sobre ventas digitales.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {MODULES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group bg-[#FAFAF8] rounded-2xl p-5 border border-neutral-100
                         hover:bg-white hover:border-[#FF6B35]/30 hover:shadow-lg hover:-translate-y-0.5
                         transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-neutral-100 flex items-center justify-center mb-4
                              group-hover:bg-[#FF6B35] group-hover:border-[#FF6B35] transition-colors duration-200">
                <Icon size={18} className="text-[#FF6B35] group-hover:text-white transition-colors duration-200" />
              </div>
              <h3 className="font-bold text-[#1A1A2E] text-sm mb-1.5">{title}</h3>
              <p className="text-[11px] text-neutral-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Plans ───────────────────────────────────────────────────────────── */

function Plans() {
  return (
    <section id="planes" className="py-20 lg:py-28 bg-[#FAFAF8]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border mb-4"
            style={{ background: '#FFF4EF', borderColor: '#FFD4C2', color: '#FF6B35' }}
          >
            Planes simples
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-3">
            Empieza gratis, crece cuando quieras
          </h2>
          <p className="text-neutral-500 text-lg max-w-xl mx-auto">
            Solo 1% sobre ventas digitales por Chapi. Cancela cuando quieras.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-6 flex flex-col transition-all duration-200 ${
                plan.popular
                  ? 'bg-[#1A1A2E] text-white border-2 border-[#FF6B35] shadow-xl shadow-[#FF6B35]/20 lg:-translate-y-2'
                  : 'bg-white border border-neutral-100 hover:shadow-lg'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF6B35] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  Más elegido
                </span>
              )}
              <h3 className={`text-lg font-bold mb-1 ${plan.popular ? 'text-white' : 'text-[#1A1A2E]'}`}>
                {plan.name}
              </h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className={`text-3xl font-extrabold ${plan.popular ? 'text-white' : 'text-[#1A1A2E]'}`}>
                  {plan.price}
                </span>
                <span className={`text-sm ${plan.popular ? 'text-white/60' : 'text-neutral-400'}`}>
                  {plan.period}
                </span>
              </div>
              <p className={`text-xs leading-relaxed mb-5 ${plan.popular ? 'text-white/60' : 'text-neutral-500'}`}>
                {plan.desc}
              </p>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map(f => (
                  <li key={f} className={`text-xs flex items-start gap-2 ${plan.popular ? 'text-white/85' : 'text-neutral-600'}`}>
                    <Check size={12} className="text-[#FF6B35] shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/unete"
                className={`text-center text-sm font-semibold py-3 rounded-xl transition-colors ${
                  plan.popular
                    ? 'bg-[#FF6B35] text-white hover:bg-[#e55a2b]'
                    : 'bg-[#FAFAF8] text-[#1A1A2E] border border-neutral-200 hover:border-[#FF6B35] hover:text-[#FF6B35]'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Comparison ─────────────────────────────────────────────────────── */

function ComparisonSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-3">
            No somos delivery. Somos discovery + gestión.
          </h2>
          <p className="text-neutral-500 text-lg max-w-xl mx-auto">
            HiChapi no compite con apps de delivery. Te trae clientes presenciales y te ayuda a operar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Others */}
          <div className="rounded-2xl border border-neutral-200 p-7 bg-neutral-50">
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-5">Apps de delivery</p>
            <ul className="space-y-3.5">
              {[
                'Comisiones del 20–30 %',
                'El cliente no va al restaurante',
                'Competencia por precio',
                'Sin relación con el comensal',
                'Tu marca se pierde en la app',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-sm text-neutral-500">
                  <span className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs">×</span>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* HiChapi */}
          <div className="rounded-2xl border-2 border-[#FF6B35]/40 p-7 bg-[#FFF4EF]/40 relative">
            <div className="absolute -top-3 left-6 bg-[#FF6B35] text-white text-xs font-bold px-3 py-1 rounded-full">
              HiChapi
            </div>
            <p className="text-xs font-bold text-[#FF6B35] uppercase tracking-wider mb-5">Discovery + Gestión</p>
            <ul className="space-y-3.5">
              {[
                'Sin comisiones — jamás',
                'El cliente va presencial a tu local',
                'Recomendación inteligente con IA',
                'Relación directa con el comensal',
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

/* ── Testimonials & Zones ────────────────────────────────────────────── */

function Testimonials() {
  return (
    <section id="testimonios" className="py-20 lg:py-28 bg-[#FAFAF8]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-3">
            Lo que dicen de Chapi
          </h2>
          <p className="text-neutral-500 text-lg">
            Comensales y restaurantes que ya usan HiChapi
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map(({ quote, author, role, rating }) => (
            <div
              key={author}
              className="bg-white rounded-2xl p-6 border border-neutral-100
                         hover:shadow-lg transition-all duration-300"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: rating }).map((_, i) => (
                  <Star key={i} size={14} className="text-[#FF6B35] fill-[#FF6B35]" />
                ))}
              </div>
              <p className="text-sm text-[#1A1A2E] mb-5 leading-relaxed italic">
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
    <section className="py-20 lg:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <h2 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] mb-3">
          Disponible en toda Santiago
        </h2>
        <p className="text-neutral-500 text-lg mb-10 max-w-xl mx-auto">
          Y seguimos creciendo. Si tu barrio no está, avísanos.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto">
          {ZONES.map(zone => (
            <span
              key={zone}
              className="px-4 py-2 rounded-full bg-[#FAFAF8] border border-neutral-100 text-sm text-neutral-600
                         hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors cursor-default"
            >
              <MapPin size={11} className="inline mr-1.5 -mt-0.5" />
              {zone}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Final CTA ──────────────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-5xl mx-auto px-6">
        <div
          className="relative rounded-3xl p-10 lg:p-16 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1A1A2E 0%, #2D2D4E 100%)' }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6B35]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#FF6B35]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Diner CTA */}
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/10 text-white/80 mb-4">
                <MessageCircle size={11} />
                Para comensales
              </div>
              <h3 className="text-2xl lg:text-3xl font-extrabold text-white mb-3 leading-tight">
                ¿No sabes dónde comer?
              </h3>
              <p className="text-white/55 text-sm mb-6 leading-relaxed">
                Chapi conoce todos los restaurantes de Santiago. Cuéntale qué buscas.
              </p>
              <Link
                href="/buscar"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl
                           bg-[#FF6B35] text-white font-bold text-sm
                           hover:bg-[#e55a2b] transition-colors shadow-lg shadow-[#FF6B35]/30"
              >
                Hablar con Chapi
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* Restaurant CTA */}
            <div className="text-center md:text-left md:border-l md:border-white/10 md:pl-10">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/10 text-white/80 mb-4">
                <Utensils size={11} />
                Para restaurantes
              </div>
              <h3 className="text-2xl lg:text-3xl font-extrabold text-white mb-3 leading-tight">
                ¿Quieres operar con un cerebro autónomo en tu restaurante?
              </h3>
              <p className="text-white/55 text-sm mb-6 leading-relaxed">
                Sumar tu restaurante toma 5 minutos. Plan Free para siempre.
              </p>
              <Link
                href="/unete"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl
                           bg-white text-[#1A1A2E] font-bold text-sm
                           hover:bg-[#FF6B35] hover:text-white transition-colors shadow-lg"
              >
                Sumar mi restaurante
                <ArrowRight size={14} />
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
          <div className="sm:col-span-2">
            <p className="font-bold text-xl tracking-tight mb-3" style={{ color: '#1A1A2E' }}>
              hi<span style={{ color: '#FF6B35' }}>chapi</span>
            </p>
            <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
              Discovery con IA + sistema operativo de restaurante.
              Una sola plataforma, dos productos. Hecho en Santiago, Chile.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#1A1A2E] mb-3">Productos</p>
            <ul className="space-y-2 text-sm text-neutral-500">
              <li><Link href="/buscar" className="hover:text-[#FF6B35] transition-colors">Hablar con Chapi</Link></li>
              <li><Link href="/unete" className="hover:text-[#FF6B35] transition-colors">Sumar mi restaurante</Link></li>
              <li><Link href="/login" className="hover:text-[#FF6B35] transition-colors">Iniciar sesión</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#1A1A2E] mb-3">Compañía</p>
            <ul className="space-y-2 text-sm text-neutral-500">
              <li><span className="text-neutral-400">Santiago, Chile</span></li>
              <li><a href="mailto:hola@hichapi.cl" className="hover:text-[#FF6B35] transition-colors">hola@hichapi.cl</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-neutral-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-400">
            &copy; {new Date().getFullYear()} HiChapi. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Shield size={12} />
            <span>Hecho con IA en Santiago</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ──────────────────────────────────────────────────────────────────────
 *  PAGE
 * ────────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <main className="min-h-screen" style={{ background: '#FAFAF8', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
      {/* Inline keyframes for Ken Burns animation — safe to ship inline */}
      <style>{`
        @keyframes kenburns-left {
          0%   { transform: scale(1.05) translate(0, 0); }
          100% { transform: scale(1.18) translate(-2%, -1%); }
        }
        @keyframes kenburns-right {
          0%   { transform: scale(1.05) translate(0, 0); }
          100% { transform: scale(1.18) translate(2%, -1%); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.6s ease-out both; }
      `}</style>

      <Navbar />
      <Hero />
      <StatsBar />
      <DinerSection />
      <RestaurantSection />
      <ModulesGrid />
      <Plans />
      <Testimonials />
      <ZonesSection />
      <FinalCTA />
      <Footer />
    </main>
  )
}
