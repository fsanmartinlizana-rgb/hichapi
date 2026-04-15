import Link from 'next/link'
import Image from 'next/image'
import { Star, Clock, MapPin, Globe, DollarSign, Phone, AtSign, Users } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { formatCurrency } from '@/lib/i18n'
import { notFound } from 'next/navigation'
import { BackButton } from './BackButton'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MenuItemData {
  id: string
  category: string
  name: string
  description: string | null
  price: number
  tags: string[]
  available: boolean
  photo_url: string | null
}

interface DaySchedule { open: string; close: string; closed: boolean }

interface RestaurantData {
  id: string
  name: string
  slug: string
  neighborhood: string
  cuisine_type: string
  rating: number
  review_count: number
  address: string
  phone: string | null
  website: string | null
  instagram: string | null
  description: string | null
  capacity: number | null
  tags: string[] | null
  hours: Record<string, DaySchedule> | null
  photo_url: string | null
  gallery_urls: string[]
  price_range: string
  active: boolean
  claimed: boolean
  menu_items: MenuItemData[]
}

// ── Supabase server client ──────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Data fetching (server component) ────────────────────────────────────────

async function getRestaurant(slug: string): Promise<RestaurantData | null> {
  const supabase = getSupabase()

  // Sprint 12 columns (phone/website/instagram/description/capacity/tags/hours)
  // not yet migrated in this DB — query only the columns that exist and
  // backfill the rest as null so the UI gracefully hides them.
  const { data, error } = await supabase
    .from('restaurants')
    .select(`
      id, name, slug, neighborhood, cuisine_type, rating, review_count,
      address, photo_url, gallery_urls, price_range, active, claimed,
      menu_items (id, name, description, price, category, tags, available, photo_url)
    `)
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (error || !data) return null
  return {
    ...data,
    phone:         null,
    website:       null,
    instagram:     null,
    description:   null,
    capacity:      null,
    tags:          null,
    hours:         null,
    gallery_urls: (data as { gallery_urls?: string[] | null }).gallery_urls ?? [],
  } as RestaurantData
}

async function getReviews(restaurantId: string) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(10)

  return data ?? []
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatPrice = (clp: number) => formatCurrency(clp)

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
    const cat = item.category || 'Otros'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
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
    promovido: 'bg-[#FF6B35]/10 text-[#FF6B35]',
  }
  const cls = colorMap[tag] ?? 'bg-neutral-100 text-neutral-500'
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>
      {tag}
    </span>
  )
}

function MenuItemRow({ item }: { item: MenuItemData }) {
  const isPromoted = item.tags?.includes('promovido')
  return (
    <div
      className={`flex items-start justify-between gap-4 py-3 border-b border-neutral-100 last:border-0
                  ${!item.available ? 'opacity-50' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
          {isPromoted && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6B35]/10 text-[#FF6B35] font-semibold">
              Chapi sugiere
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
        {item.tags && item.tags.filter(t => t !== 'promovido').length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.tags.filter(t => t !== 'promovido').map(t => <DietaryTag key={t} tag={t} />)}
          </div>
        )}
      </div>
      <p className="text-sm font-semibold font-mono text-[#1A1A2E] shrink-0 mt-0.5">
        {formatPrice(item.price)}
      </p>
    </div>
  )
}

const DAY_KEYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
const DAY_TO_INDEX: Record<string, number> = {
  Domingo: 0, Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6,
}

function todayName(): string {
  const idx = new Date().getDay()
  return DAY_KEYS.find(d => DAY_TO_INDEX[d] === idx) ?? 'Lunes'
}

function QuickInfoBar({ restaurant }: { restaurant: RestaurantData }) {
  const priceLabel =
    restaurant.price_range === 'economico' || restaurant.price_range === '$'   ? '$'   :
    restaurant.price_range === 'premium'   || restaurant.price_range === '$$$' ? '$$$' :
    restaurant.price_range === 'medio'     || restaurant.price_range === '$$'  ? '$$'  :
    '$$'

  const today = restaurant.hours?.[todayName()]
  const todayLabel = today
    ? today.closed ? 'Hoy cerrado' : `Hoy ${today.open} – ${today.close}`
    : null

  const items = [
    { icon: <MapPin size={15} className="text-[#FF6B35]" />, label: restaurant.address || 'Dirección por confirmar' },
    { icon: <DollarSign size={15} className="text-[#FF6B35]" />, label: `Precio: ${priceLabel}` },
  ]
  if (todayLabel) items.push({ icon: <Clock size={15} className="text-[#FF6B35]" />, label: todayLabel })
  if (restaurant.capacity) items.push({ icon: <Users size={15} className="text-[#FF6B35]" />, label: `${restaurant.capacity} mesas` })

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 bg-white rounded-2xl border border-neutral-100 shadow-sm px-5 py-4">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 text-sm text-neutral-600 min-w-0">
          {item.icon}
          <span className="truncate">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Description, hours, contact ─────────────────────────────────────────────

function AboutSection({ restaurant }: { restaurant: RestaurantData }) {
  const hasContact = restaurant.phone || restaurant.website || restaurant.instagram
  const hasHours   = restaurant.hours && Object.keys(restaurant.hours).length > 0

  if (!restaurant.description && !hasContact && !hasHours && (!restaurant.tags || restaurant.tags.length === 0)) {
    return null
  }

  const todayKey = todayName()

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-4">
      {restaurant.description && (
        <div>
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-2">
            Sobre el lugar
          </h3>
          <p className="text-sm text-neutral-600 leading-relaxed">{restaurant.description}</p>
        </div>
      )}

      {restaurant.tags && restaurant.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {restaurant.tags.map(t => (
            <span
              key={t}
              className="text-[11px] px-2.5 py-1 rounded-full bg-[#FF6B35]/10 text-[#FF6B35] font-medium capitalize"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {hasHours && (
        <div>
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Clock size={12} className="text-[#FF6B35]" />
            Horarios
          </h3>
          <div className="space-y-1">
            {DAY_KEYS.map(day => {
              const s = restaurant.hours?.[day]
              const isToday = day === todayKey
              return (
                <div
                  key={day}
                  className={`flex items-center justify-between text-xs ${isToday ? 'font-semibold text-[#1A1A2E]' : 'text-neutral-500'}`}
                >
                  <span>{day}{isToday && ' · hoy'}</span>
                  <span>{s ? (s.closed ? 'Cerrado' : `${s.open} – ${s.close}`) : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {hasContact && (
        <div className="pt-1 border-t border-neutral-100">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-2 mt-3">
            Contacto
          </h3>
          <div className="space-y-1.5 text-sm">
            {restaurant.phone && (
              <a href={`tel:${restaurant.phone}`} className="flex items-center gap-2 text-neutral-600 hover:text-[#FF6B35] transition-colors">
                <Phone size={13} className="text-[#FF6B35]" />
                {restaurant.phone}
              </a>
            )}
            {restaurant.website && (
              <a
                href={restaurant.website.startsWith('http') ? restaurant.website : `https://${restaurant.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-neutral-600 hover:text-[#FF6B35] transition-colors"
              >
                <Globe size={13} className="text-[#FF6B35]" />
                {restaurant.website}
              </a>
            )}
            {restaurant.instagram && (
              <a
                href={`https://instagram.com/${restaurant.instagram.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-neutral-600 hover:text-[#FF6B35] transition-colors"
              >
                <AtSign size={13} className="text-[#FF6B35]" />
                {restaurant.instagram}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionCard({ restaurant }: { restaurant: RestaurantData }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-4">
      <h3 className="font-bold text-[#1A1A2E] text-base">Listo para ir?</h3>

      <Link
        href={`/reservar/${restaurant.slug}`}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#FF6B35] text-white font-semibold text-sm hover:bg-[#e55a2b] transition-colors"
      >
        Reservar mesa
      </Link>

      <div className="bg-[#FAFAF8] rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-[#1A1A2E]">Ya estas en el local?</p>
        <p className="text-xs text-neutral-400 leading-relaxed">
          Escanea el QR de tu mesa para pedir con Chapi sin esperar al mozo.
        </p>
      </div>
    </div>
  )
}

function ReviewsSection({ reviews, rating, reviewCount }: {
  reviews: { id: string; rating: number; comment: string | null; created_at: string }[]
  rating: number
  reviewCount: number
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#1A1A2E] text-base flex items-center gap-2">
          <Star size={15} className="text-[#FF6B35]" />
          Opiniones
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-[#1A1A2E]">{rating.toFixed(1)}</span>
          <RatingStars rating={rating} />
          <span className="text-xs text-neutral-400">({reviewCount})</span>
        </div>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-4">
          Aun no hay opiniones. Se el primero!
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.slice(0, 5).map(review => (
            <div key={review.id} className="bg-[#FAFAF8] rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <RatingStars rating={review.rating} />
                <span className="text-[10px] text-neutral-400">
                  {new Date(review.created_at).toLocaleDateString('es-CL')}
                </span>
              </div>
              {review.comment && (
                <p className="text-xs text-neutral-600 leading-relaxed">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClaimBanner({ slug }: { slug: string }) {
  return (
    <div className="bg-[#FF6B35]/5 border border-[#FF6B35]/20 rounded-2xl p-5 text-center space-y-2">
      <p className="text-sm font-semibold text-[#1A1A2E]">Es tu restaurante?</p>
      <p className="text-xs text-neutral-500">Reclama tu perfil para subir la carta, recibir pedidos y mas.</p>
      <Link
        href={`/reclamar/${slug}`}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] transition-colors mt-1"
      >
        Reclamar restaurante
      </Link>
    </div>
  )
}

function NoMenuBanner() {
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-8 text-center">
      <span className="text-5xl block mb-3">📋</span>
      <h2 className="text-lg font-bold text-[#1A1A2E] mb-2">Carta no disponible</h2>
      <p className="text-sm text-neutral-400 leading-relaxed">
        Este restaurante aun no ha subido su carta a HiChapi.
        Si eres el dueño, reclama tu perfil para publicarla.
      </p>
    </div>
  )
}

// ── Page (Server Component) ──────────────────────────────────────────────────

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const restaurant = await getRestaurant(slug)

  if (!restaurant) {
    notFound()
  }

  const reviews = await getReviews(restaurant.id)
  const availableItems = restaurant.menu_items.filter(i => i.available !== false)
  const groups     = groupByCategory(availableItems)
  const categories = sortedCategories(groups)
  const hasMenu    = restaurant.menu_items.length > 0

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
          <BackButton />
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

          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }}
          />

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h1 className="text-3xl font-bold text-white leading-tight mb-2">
              {restaurant.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <RatingStars rating={restaurant.rating} />
                <span className="text-white font-semibold text-sm">{restaurant.rating.toFixed(1)}</span>
                {restaurant.review_count > 0 && (
                  <span className="text-white/50 text-xs">({restaurant.review_count})</span>
                )}
              </div>
              <span className="text-white/60 text-sm">·</span>
              <span className="text-white/80 text-sm">{restaurant.neighborhood}</span>
              {restaurant.cuisine_type && (
                <>
                  <span className="text-white/60 text-sm">·</span>
                  <span className="text-white/80 text-sm">{restaurant.cuisine_type}</span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Gallery ── */}
        {restaurant.gallery_urls && restaurant.gallery_urls.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">Galería</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
              {restaurant.gallery_urls.map((url, idx) => (
                <div key={url + idx} className="relative w-56 sm:w-64 aspect-[4/3] shrink-0 snap-start rounded-xl overflow-hidden bg-neutral-200 shadow-sm">
                  <Image
                    src={url}
                    alt={`${restaurant.name} — foto ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 224px, 256px"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Quick info bar ── */}
        <QuickInfoBar restaurant={restaurant} />

        {/* ── Claim banner for unclaimed restaurants ── */}
        {!restaurant.claimed && <ClaimBanner slug={restaurant.slug} />}

        {/* ── Main 2-col layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Left: Carta completa (2/3) */}
          <section className="lg:col-span-2">
            {hasMenu ? (
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6">
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
              </div>
            ) : (
              <NoMenuBanner />
            )}
          </section>

          {/* Right: Actions + about + reviews (1/3) */}
          <aside className="lg:col-span-1 space-y-4">
            <ActionCard restaurant={restaurant} />
            <AboutSection restaurant={restaurant} />
            <ReviewsSection
              reviews={reviews}
              rating={restaurant.rating}
              reviewCount={restaurant.review_count}
            />
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
            Eres dueño de un restaurante? Sumate a Chapi
          </Link>
        </p>
        <p className="text-neutral-300">&copy; {new Date().getFullYear()} HiChapi. Todos los derechos reservados.</p>
      </footer>
    </main>
  )
}
