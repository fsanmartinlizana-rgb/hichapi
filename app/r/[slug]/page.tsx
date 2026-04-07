'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Star, Clock, MapPin, Globe, DollarSign, ArrowLeft, Tag } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MenuItemData {
  id: string
  category: string
  name: string
  description: string
  price: number
  tags: string[]
  available: boolean
  chapi_pick?: boolean
}

interface Promotion {
  name: string
  description: string
  hours: string
}

interface RestaurantData {
  name: string
  slug: string
  neighborhood: string
  cuisine_type: string
  rating: number
  address: string
  phone: string
  website?: string
  price_range: string
  hours: string
  tags: string[]
  photo_url: string | null
  promotions: Promotion[]
  menu: MenuItemData[]
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_RESTAURANTS: Record<string, RestaurantData> = {
  'el-rincon-de-don-jose': {
    name: 'El Rincón de Don José',
    slug: 'el-rincon-de-don-jose',
    neighborhood: 'Providencia',
    cuisine_type: 'Chilena / Italiana',
    rating: 4.7,
    address: 'Av. Providencia 2124, Providencia',
    phone: '+56 2 2344 5678',
    website: 'elrincondedonjose.cl',
    price_range: '$$',
    hours: '12:00 – 23:00',
    tags: ['familiar', 'romántico', 'para reuniones'],
    photo_url: null,
    promotions: [
      {
        name: 'Happy Hour tarde',
        description: '20% de descuento en toda la carta',
        hours: '15:00–17:00 Lun–Jue',
      },
    ],
    menu: [
      { id: '1', category: 'Principal', name: 'Lomo vetado', description: 'Con papas fritas y ensalada', price: 15900, tags: [], available: true, chapi_pick: true },
      { id: '2', category: 'Principal', name: 'Pasta arrabiata', description: 'Salsa de tomate picante', price: 12900, tags: ['vegano'], available: true },
      { id: '3', category: 'Principal', name: 'Salmón grillado', description: 'Con puré y salsa de limón', price: 16900, tags: ['sin gluten'], available: true },
      { id: '4', category: 'Entrada', name: 'Ensalada César', description: 'Lechuga, crutones, parmesano', price: 8900, tags: [], available: true },
      { id: '5', category: 'Entrada', name: 'Gazpacho', description: 'Sopa fría de tomate', price: 7500, tags: ['vegano', 'sin gluten'], available: false },
      { id: '6', category: 'Postre', name: 'Tiramisú', description: 'Receta italiana tradicional', price: 6900, tags: ['vegetariano'], available: true },
      { id: '7', category: 'Bebida', name: 'Pisco sour', description: 'Clásico chileno', price: 5900, tags: [], available: true },
    ],
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(clp: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(clp)
}

function RatingStars({ rating }: { rating: number }) {
  const full  = Math.floor(rating)
  const half  = rating - full >= 0.5
  const empty = 5 - full - (half ? 1 : 0)
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} size={14} className="text-[#FF6B35] fill-[#FF6B35]" />
      ))}
      {half && (
        <span className="relative inline-block" style={{ width: 14, height: 14 }}>
          <Star size={14} className="text-neutral-300 fill-neutral-200 absolute inset-0" />
          <span className="absolute inset-0 overflow-hidden" style={{ width: '55%' }}>
            <Star size={14} className="text-[#FF6B35] fill-[#FF6B35]" />
          </span>
        </span>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} size={14} className="text-neutral-300 fill-neutral-200" />
      ))}
    </span>
  )
}

const CATEGORY_ORDER = ['Entrada', 'Principal', 'Postre', 'Bebida']

function groupByCategory(items: MenuItemData[]): Record<string, MenuItemData[]> {
  const groups: Record<string, MenuItemData[]> = {}
  for (const item of items) {
    if (!groups[item.category]) groups[item.category] = []
    groups[item.category].push(item)
  }
  return groups
}

function sortedCategories(groups: Record<string, MenuItemData[]>): string[] {
  const keys = Object.keys(groups)
  return [
    ...CATEGORY_ORDER.filter(c => keys.includes(c)),
    ...keys.filter(c => !CATEGORY_ORDER.includes(c)),
  ]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DietaryTag({ tag }: { tag: string }) {
  const colorMap: Record<string, string> = {
    vegano: 'bg-green-100 text-green-700',
    vegetariano: 'bg-lime-100 text-lime-700',
    'sin gluten': 'bg-yellow-100 text-yellow-700',
  }
  const cls = colorMap[tag] ?? 'bg-neutral-100 text-neutral-500'
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>
      {tag}
    </span>
  )
}

function MenuItemRow({ item }: { item: MenuItemData }) {
  return (
    <div
      className={`flex items-start justify-between gap-4 py-3 border-b border-neutral-100 last:border-0
                  ${!item.available ? 'opacity-50' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
          {item.chapi_pick && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6B35]/10 text-[#FF6B35] font-semibold">
              ✨ Chapi sugiere
            </span>
          )}
          {!item.available && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-500 font-medium">
              Agotado
            </span>
          )}
        </div>
        <p
          className={`text-sm font-semibold text-[#1A1A2E] leading-tight
                      ${!item.available ? 'line-through' : ''}`}
        >
          {item.name}
        </p>
        {item.description && (
          <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{item.description}</p>
        )}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.tags.map(t => <DietaryTag key={t} tag={t} />)}
          </div>
        )}
      </div>
      <p className="text-sm font-semibold font-mono text-[#1A1A2E] shrink-0 mt-0.5">
        {formatPrice(item.price)}
      </p>
    </div>
  )
}

function QuickInfoBar({ restaurant }: { restaurant: RestaurantData }) {
  const items = [
    { icon: <Clock size={15} className="text-[#FF6B35]" />, label: restaurant.hours },
    { icon: <MapPin size={15} className="text-[#FF6B35]" />, label: restaurant.address },
    ...(restaurant.website
      ? [{ icon: <Globe size={15} className="text-[#FF6B35]" />, label: restaurant.website }]
      : []),
    { icon: <DollarSign size={15} className="text-[#FF6B35]" />, label: `Precio: ${restaurant.price_range}` },
  ]
  return (
    <div className="flex flex-wrap gap-3 bg-white rounded-2xl border border-neutral-100 shadow-sm px-5 py-4">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 text-sm text-neutral-600 min-w-0">
          {item.icon}
          <span className="truncate">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function ActionCard({ restaurant }: { restaurant: RestaurantData }) {
  const hasWaitlist = true // In production, derive from restaurant data
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-4">
      <h3 className="font-bold text-[#1A1A2E] text-base">¿Listo para ir?</h3>

      {hasWaitlist && (
        <Link
          href={`/espera/${restaurant.slug}`}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                     bg-[#FF6B35] text-white font-semibold text-sm
                     hover:bg-[#e55a2b] transition-colors"
        >
          📋 Unirme a lista de espera
        </Link>
      )}

      <div className="bg-[#FAFAF8] rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-[#1A1A2E]">¿Ya estás en el local?</p>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Escanea el QR de tu mesa para pedir con Chapi sin esperar al mozo.
        </p>
        <Link
          href={`/${restaurant.slug}/1`}
          className="inline-flex items-center gap-1.5 text-xs text-[#FF6B35] font-semibold
                     hover:underline underline-offset-2 mt-1"
        >
          Ir a Mesa 1 (demo) →
        </Link>
      </div>
    </div>
  )
}

function PromotionsCard({ promotions }: { promotions: Promotion[] }) {
  if (!promotions.length) return null
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-3">
      <h3 className="font-bold text-[#1A1A2E] text-base">🎯 Ofertas de hoy</h3>
      <div className="space-y-2">
        {promotions.map((promo, i) => (
          <div key={i} className="bg-[#FF6B35]/5 border border-[#FF6B35]/15 rounded-xl p-3">
            <p className="text-sm font-semibold text-[#1A1A2E]">{promo.name}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{promo.description}</p>
            <p className="text-[10px] text-[#FF6B35] font-medium mt-1.5">{promo.hours}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TagsCard({ tags }: { tags: string[] }) {
  if (!tags.length) return null
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-3">
      <h3 className="font-bold text-[#1A1A2E] text-base flex items-center gap-2">
        <Tag size={15} className="text-[#FF6B35]" />
        Ambiente
      </h3>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <span
            key={tag}
            className="text-xs px-3 py-1 rounded-full bg-neutral-100 text-neutral-600 capitalize font-medium"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RestaurantPage() {
  const params   = useParams()
  const router   = useRouter()
  const slug     = params.slug as string
  const restaurant = MOCK_RESTAURANTS[slug]

  if (!restaurant) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
        style={{ background: '#FAFAF8', fontFamily: 'var(--font-dm-sans), sans-serif' }}
      >
        <span className="text-6xl mb-4">🍽️</span>
        <h1 className="text-2xl font-bold text-[#1A1A2E] mb-2">Restaurante no encontrado</h1>
        <p className="text-neutral-400 text-sm mb-6">
          No tenemos información para <span className="font-mono text-[#1A1A2E]">{slug}</span> todavía.
        </p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-full
                     bg-[#FF6B35] text-white font-semibold hover:bg-[#e55a2b] transition-colors"
        >
          <ArrowLeft size={14} />
          Volver a resultados
        </button>
      </main>
    )
  }

  const groups     = groupByCategory(restaurant.menu)
  const categories = sortedCategories(groups)

  return (
    <main
      className="min-h-screen"
      style={{ background: '#FAFAF8', fontFamily: 'var(--font-dm-sans), sans-serif', color: '#1A1A2E' }}
    >
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-30 bg-[#FAFAF8]/90 backdrop-blur-md border-b border-neutral-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight text-[#1A1A2E]">
            hi<span className="text-[#FF6B35]">chapi</span>
          </Link>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-neutral-500 font-medium
                       hover:text-[#FF6B35] transition-colors"
          >
            <ArrowLeft size={15} />
            Volver a resultados
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Hero ── */}
        <section className="relative aspect-video rounded-2xl overflow-hidden bg-neutral-200 shadow-md">
          {restaurant.photo_url ? (
            <Image
              src={restaurant.photo_url}
              alt={restaurant.name}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 960px"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300">
              <span className="text-7xl">🍽️</span>
            </div>
          )}

          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }}
          />

          {/* Name + meta on overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h1 className="text-3xl font-bold text-white leading-tight mb-2">
              {restaurant.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <RatingStars rating={restaurant.rating} />
                <span className="text-white font-semibold text-sm">{restaurant.rating.toFixed(1)}</span>
              </div>
              <span className="text-white/60 text-sm">·</span>
              <span className="text-white/80 text-sm">{restaurant.neighborhood}</span>
              <span className="text-white/60 text-sm">·</span>
              <span className="text-white/80 text-sm">{restaurant.cuisine_type}</span>
            </div>
          </div>
        </section>

        {/* ── Quick info bar ── */}
        <QuickInfoBar restaurant={restaurant} />

        {/* ── Main 2-col layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Left: Carta completa (2/3) */}
          <section className="lg:col-span-2 bg-white rounded-2xl border border-neutral-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-[#1A1A2E] mb-5">Carta completa</h2>
            <div className="space-y-7">
              {categories.map(category => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3 pb-2 border-b border-neutral-100">
                    {category}s
                  </h3>
                  <div>
                    {groups[category].map(item => (
                      <MenuItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Right: Actions + promos + tags (1/3) */}
          <aside className="lg:col-span-1 space-y-4">
            <ActionCard restaurant={restaurant} />
            <PromotionsCard promotions={restaurant.promotions} />
            <TagsCard tags={restaurant.tags} />
          </aside>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="text-center py-10 text-xs text-neutral-300 space-y-1.5 border-t border-neutral-100 mt-8">
        <p className="font-medium text-neutral-400">HiChapi · Santiago, Chile</p>
        <p>
          <Link
            href="/unete"
            className="text-neutral-400 hover:text-[#FF6B35] transition-colors underline underline-offset-2"
          >
            ¿Eres dueño de un restaurante? Súmate a Chapi →
          </Link>
        </p>
        <p className="text-neutral-300">© {new Date().getFullYear()} HiChapi. Todos los derechos reservados.</p>
      </footer>
    </main>
  )
}
