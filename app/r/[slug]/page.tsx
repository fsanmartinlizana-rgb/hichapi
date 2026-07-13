import Link from 'next/link'
import Image from 'next/image'
import { Star, Clock, MapPin, Globe, DollarSign, Phone, AtSign, Users, Info, ShoppingBag } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { formatCurrency } from '@/lib/i18n'
import { notFound } from 'next/navigation'
import { BackButton } from './BackButton'
import CartPanel, { type OrderableItem } from '@/components/public/CartPanel'
import PublicMenu from '@/components/public/PublicMenu'

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
  owner_id: string | null
  google_rating: number | null
  google_rating_count: number | null
  menu_items: MenuItemData[]
}

// ── Supabase ──────────────────────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getRestaurant(slug: string): Promise<RestaurantData | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('restaurants')
    .select(`
      id, name, slug, neighborhood, cuisine_type, rating, review_count,
      address, phone, website, instagram, description, capacity, tags, hours,
      photo_url, gallery_urls, price_range, active, claimed, owner_id,
      google_rating, google_rating_count, config_chapi,
      menu_items (id, name, description, price, category, tags, available, photo_url)
    `)
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (error || !data) return null

  const d = data as Record<string, unknown>
  const cfg = (d.config_chapi as Record<string, unknown> | null) ?? {}
  const cfgPhone   = typeof cfg.phone   === 'string' ? cfg.phone   : null
  const cfgWebsite = typeof cfg.website === 'string' ? cfg.website : null

  return {
    ...data,
    phone:        (d.phone   as string | null) || cfgPhone,
    website:      (d.website as string | null) || cfgWebsite,
    gallery_urls: (d.gallery_urls as string[] | null) ?? [],
    google_rating:       (d.google_rating       as number | null) ?? null,
    google_rating_count: (d.google_rating_count as number | null) ?? null,
  } as RestaurantData
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatPrice = (clp: number) => formatCurrency(clp)

const CATEGORY_ORDER = ['Entrada', 'Principal', 'Postre', 'Bebida']
const DAY_KEYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
const DAY_TO_INDEX: Record<string, number> = {
  Domingo: 0, Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6,
}
function todayName() {
  const idx = new Date().getDay()
  return DAY_KEYS.find(d => DAY_TO_INDEX[d] === idx) ?? 'Lunes'
}
function groupByCategory(items: MenuItemData[]) {
  const groups: Record<string, MenuItemData[]> = {}
  for (const item of items) {
    const cat = item.category || 'Otros'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  }
  return groups
}
function sortedCategories(groups: Record<string, MenuItemData[]>) {
  const keys = Object.keys(groups)
  return [
    ...CATEGORY_ORDER.filter(c => keys.includes(c)),
    ...keys.filter(c => !CATEGORY_ORDER.includes(c)),
  ]
}

// ── Rating Stars ──────────────────────────────────────────────────────────────

function RatingStars({ rating }: { rating: number }) {
  const full  = Math.floor(rating)
  const empty = 5 - full
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} size={13} className="text-[#E55A2B] fill-[#FF6B35]" />
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} size={13} className="text-[var(--text-muted)] fill-neutral-200" />
      ))}
    </span>
  )
}

// ── Quick Info Bar ────────────────────────────────────────────────────────────

function QuickInfoBar({ restaurant }: { restaurant: RestaurantData }) {
  const priceLabel =
    restaurant.price_range === 'economico' || restaurant.price_range === '$'   ? '$'   :
    restaurant.price_range === 'premium'   || restaurant.price_range === '$$$' ? '$$$' :
    '$$'

  const todayKey = todayName()
  const today = restaurant.hours?.[todayKey]
  const todayLabel = today
    ? today.closed ? 'Hoy cerrado' : `Hoy ${today.open} – ${today.close}`
    : null

  const items = [
    { icon: <MapPin size={15} className="text-[#E55A2B]" />, label: restaurant.address || 'Dirección por confirmar' },
    { icon: <DollarSign size={15} className="text-[#E55A2B]" />, label: `Precio: ${priceLabel}` },
  ]
  if (todayLabel) items.push({ icon: <Clock size={15} className="text-[#E55A2B]" />, label: todayLabel })
  if (restaurant.capacity) items.push({ icon: <Users size={15} className="text-[#E55A2B]" />, label: `${restaurant.capacity} mesas` })

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

// ── About / Sidebar ───────────────────────────────────────────────────────────

function AboutSection({ restaurant }: { restaurant: RestaurantData }) {
  const hasContact = restaurant.phone || restaurant.website || restaurant.instagram
  const hasHours   = restaurant.hours && Object.keys(restaurant.hours).length > 0
  const todayKey   = todayName()

  if (!restaurant.description && !hasContact && !hasHours && (!restaurant.tags || restaurant.tags.length === 0)) {
    return null
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-4">
      {restaurant.description && (
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">Sobre el lugar</h3>
          <p className="text-sm text-neutral-600 leading-relaxed">{restaurant.description}</p>
        </div>
      )}

      {restaurant.tags && restaurant.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {restaurant.tags.map(t => (
            <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-[#FF6B35]/10 text-[#E55A2B] font-medium capitalize">
              {t}
            </span>
          ))}
        </div>
      )}

      {hasHours && (
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Clock size={12} className="text-[#E55A2B]" /> Horarios
          </h3>
          <div className="space-y-1">
            {DAY_KEYS.map(day => {
              const s = restaurant.hours?.[day]
              const isToday = day === todayKey
              return (
                <div key={day} className={`flex items-center justify-between text-xs ${isToday ? 'font-semibold text-[#1A1A2E]' : 'text-neutral-500'}`}>
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
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2 mt-3">Contacto</h3>
          <div className="space-y-1.5 text-sm">
            {restaurant.phone && (
              <a href={`tel:${restaurant.phone}`} className="flex items-center gap-2 text-neutral-600 hover:text-[#E55A2B] transition-colors">
                <Phone size={13} className="text-[#E55A2B]" />{restaurant.phone}
              </a>
            )}
            {restaurant.website && (
              <a href={restaurant.website.startsWith('http') ? restaurant.website : `https://${restaurant.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-neutral-600 hover:text-[#E55A2B] transition-colors">
                <Globe size={13} className="text-[#E55A2B]" />{restaurant.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {restaurant.instagram && (
              <a href={`https://instagram.com/${restaurant.instagram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-neutral-600 hover:text-[#E55A2B] transition-colors">
                <AtSign size={13} className="text-[#E55A2B]" />{restaurant.instagram}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Action Card ───────────────────────────────────────────────────────────────

function ActionCard({ restaurant }: { restaurant: RestaurantData }) {
  const hasRealOwner = restaurant.claimed && restaurant.owner_id != null

  if (!hasRealOwner) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5 space-y-3">
        <h3 className="font-bold text-[#1A1A2E] text-base">¿Querés ir?</h3>
        <p className="text-sm text-neutral-500 leading-relaxed">
          Este restaurant aún no se sumó a HiChapi. Te recomendamos llamarles antes de ir para confirmar disponibilidad.
        </p>
      </div>
    )
  }

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
        <p className="text-xs font-semibold text-[#1A1A2E]">Ya estás en el local?</p>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Escanea el QR de tu mesa para pedir con Chapi sin esperar al mozo.
        </p>
      </div>
    </div>
  )
}

// ── Claim Banner ──────────────────────────────────────────────────────────────

function ClaimBanner({ slug }: { slug: string }) {
  return (
    <div className="bg-[#FF6B35]/5 border border-[#FF6B35]/20 rounded-2xl p-5 text-center space-y-2">
      <p className="text-sm font-semibold text-[#1A1A2E]">¿Es tu restaurante?</p>
      <p className="text-xs text-neutral-500">Reclama tu perfil para subir la carta, recibir pedidos y más.</p>
      <Link
        href={`/reclamar/${slug}`}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B35] text-white text-sm font-semibold hover:bg-[#e55a2b] transition-colors mt-1"
      >
        Reclamar restaurante
      </Link>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const restaurant = await getRestaurant(slug)
  if (!restaurant) notFound()

  const allGroups  = groupByCategory(restaurant.menu_items)
  const categories = sortedCategories(allGroups)
  const hasMenu    = restaurant.menu_items.length > 0
  const todayKey   = todayName()
  const today      = restaurant.hours?.[todayKey]
  const isOpen     = today ? !today.closed : null
  const displayRating = restaurant.review_count > 0
    ? restaurant.rating
    : restaurant.google_rating

  return (
    <main className="min-h-screen" style={{ background: '#FAFAF8', fontFamily: 'var(--font-dm-sans, system-ui), sans-serif', color: '#1A1A2E' }}>

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-30 bg-[#FAFAF8]/90 backdrop-blur-md border-b border-neutral-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight text-[#1A1A2E]">
            hi<span className="text-[#E55A2B]">chapi</span>
          </Link>
          <div className="flex items-center gap-3">
            {hasMenu && (
              <a
                href="#carta"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/20 text-[#E55A2B] text-sm font-semibold hover:bg-[#FF6B35]/20 transition-colors"
              >
                <ShoppingBag size={15} />
                Pedir ahora
              </a>
            )}
            <BackButton />
          </div>
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
            <div className="w-full h-full bg-gradient-to-br from-neutral-200 to-neutral-300" />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }} />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            {isOpen !== null && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3 border ${
                isOpen
                  ? 'bg-green-500/20 border-green-400/40 text-green-700'
                  : 'bg-red-500/20 border-red-400/40 text-red-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                {isOpen ? `Abierto · ${today!.open} – ${today!.close}` : 'Cerrado ahora'}
              </span>
            )}
            <h1 className="text-3xl font-bold text-[var(--text-strong)] leading-tight mb-2">{restaurant.name}</h1>
            <div className="flex flex-wrap items-center gap-3">
              {displayRating != null && (
                <div className="flex items-center gap-1.5">
                  <RatingStars rating={displayRating} />
                  <span className="text-[var(--text-strong)] font-semibold text-sm">{displayRating.toFixed(1)}</span>
                  <span className="text-[var(--text-muted)] text-xs">
                    {restaurant.review_count > 0
                      ? `(${restaurant.review_count})`
                      : restaurant.google_rating_count != null
                      ? `en Google (${restaurant.google_rating_count})`
                      : ''}
                  </span>
                </div>
              )}
              {restaurant.neighborhood && <span className="text-[var(--text-body)] text-sm">{restaurant.neighborhood}</span>}
              {restaurant.cuisine_type && <span className="text-[var(--text-body)] text-sm">· {restaurant.cuisine_type}</span>}
            </div>
          </div>
        </section>

        {/* ── Quick info bar ── */}
        <QuickInfoBar restaurant={restaurant} />

        {/* ── Gallery ── */}
        {restaurant.gallery_urls.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3">Galería</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
              {restaurant.gallery_urls.map((url, idx) => (
                <div key={url + idx} className="relative w-56 sm:w-64 aspect-[4/3] shrink-0 snap-start rounded-xl overflow-hidden bg-neutral-200 shadow-sm">
                  <Image src={url} alt={`${restaurant.name} — foto ${idx + 1}`} fill className="object-cover" sizes="256px" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Claim banner ── */}
        {!(restaurant.claimed && restaurant.owner_id != null) && (
          <ClaimBanner slug={restaurant.slug} />
        )}

        {/* ── Main 2-col layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Left: Carta (2/3) */}
          <section id="carta" className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#1A1A2E] flex items-center gap-2">
                <ShoppingBag size={17} className="text-[#E55A2B]" />
                Carta
              </h2>
              {hasMenu && (
                <span className="text-[var(--text-muted)] text-xs">{restaurant.menu_items.length} platos</span>
              )}
            </div>

            {!hasMenu ? (
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-10 text-center">
                <span className="text-5xl block mb-4">📋</span>
                <h3 className="text-lg font-bold text-[#1A1A2E] mb-2">Carta no disponible</h3>
                <p className="text-sm text-[var(--text-muted)]">Este restaurante aún no ha publicado su carta.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5">
                <PublicMenu
                  initialItems={restaurant.menu_items.map(item => ({
                    id:          item.id,
                    name:        item.name,
                    description: item.description,
                    price:       item.price,
                    category:    item.category || 'Otros',
                    tags:        item.tags || [],
                    available:   item.available,
                    photo_url:   item.photo_url,
                  }))}
                  categories={categories}
                  lightMode
                />
              </div>
            )}
          </section>

          {/* Right: Actions + About (1/3) */}
          <aside className="lg:col-span-1 space-y-4 lg:sticky lg:top-20">
            <ActionCard restaurant={restaurant} />
            <AboutSection restaurant={restaurant} />
          </aside>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="text-center py-10 text-xs text-[var(--text-muted)] space-y-1.5 border-t border-neutral-100 mt-8">
        <p className="font-medium text-[var(--text-muted)]">HiChapi · Chile</p>
        <p>
          <Link href="/register" className="text-[var(--text-muted)] hover:text-[#E55A2B] transition-colors underline underline-offset-2">
            ¿Eres dueño de un restaurante? Súmate a Chapi
          </Link>
        </p>
        <p className="text-[var(--text-muted)]">&copy; {new Date().getFullYear()} HiChapi. Todos los derechos reservados.</p>
      </footer>

      {/* ── Cart Panel ── */}
      <CartPanel
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        restaurantAddress={restaurant.address || restaurant.name}
      />
    </main>
  )
}
