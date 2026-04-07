'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Star, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { RestaurantResult, MenuItem } from '@/lib/types'

function formatPrice(clp: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', minimumFractionDigits: 0,
  }).format(clp)
}

function formatDistance(meters?: number): string {
  if (!meters) return ''
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function DishRow({ dish, highlight = false }: { dish: MenuItem; highlight?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 py-2.5 ${highlight ? '' : 'border-t border-neutral-50'}`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-tight mb-0.5 ${highlight ? 'font-semibold text-[#1A1A2E] italic' : 'font-medium text-[#1A1A2E]'}`}>
          {dish.name}
        </p>
        {dish.description && (
          <p className="text-xs text-neutral-400 line-clamp-1">{dish.description}</p>
        )}
        {dish.tags && dish.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {dish.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-400 rounded-full capitalize">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className={`font-mono font-semibold shrink-0 ${highlight ? 'text-[#FF6B35] text-sm' : 'text-neutral-500 text-xs'}`}>
        {formatPrice(dish.price)}
      </p>
    </div>
  )
}

// `has_promotion` is not yet in the Restaurant type; we cast defensively so the
// card works today and will automatically light up once the column exists.
function hasPromotion(result: RestaurantResult): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(result as any).restaurant?.has_promotion
}

export function ResultCard({ result, index }: { result: RestaurantResult; index: number }) {
  const { restaurant, suggested_dish, menu_items, distance_m } = result
  const [expanded, setExpanded] = useState(false)
  const showPromoBadge = hasPromotion(result)

  // Extra dishes beyond the first one
  const extraDishes = (menu_items ?? []).slice(1)
  const hasExtras   = extraDishes.length > 0

  return (
    <Link
      href={`/r/${restaurant.slug}`}
      className="group block bg-white rounded-2xl overflow-hidden shadow-sm border border-neutral-100
                 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
    >
      {/* Foto */}
      <div className="relative aspect-video overflow-hidden bg-neutral-100">
        {restaurant.photo_url ? (
          <Image
            src={restaurant.photo_url}
            alt={restaurant.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
            priority={index === 0}
          />
        ) : (
          <div className="w-full h-full bg-neutral-200 flex items-center justify-center">
            <span className="text-4xl">🍽️</span>
          </div>
        )}

        {distance_m && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm
                         text-[#1A1A2E] text-xs font-medium px-2 py-1 rounded-full
                         flex items-center gap-1">
            <MapPin size={10} />
            {formatDistance(distance_m)}
          </div>
        )}

        {/* Index number + optional promo badge stacked top-left */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <div className="bg-[#FF6B35] text-white text-xs font-bold w-6 h-6 rounded-full
                          flex items-center justify-center">
            {index + 1}
          </div>
          {showPromoBadge && (
            <span className="bg-orange-500 text-white text-[10px] font-bold
                             px-2 py-0.5 rounded-full leading-none">
              🎯 Oferta hoy
            </span>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-semibold text-[#1A1A2E] text-base leading-tight group-hover:text-[#FF6B35] transition-colors">
            {restaurant.name}
          </h3>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <Star size={12} className="text-[#FF6B35] fill-[#FF6B35]" />
            <span className="text-xs font-medium text-neutral-600">
              {restaurant.rating.toFixed(1)}
            </span>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mb-3">{restaurant.neighborhood} · {restaurant.cuisine_type}</p>

        {/* Carta — plato destacado + opcionales */}
        {suggested_dish && (
          <div className="bg-[#FAFAF8] rounded-xl px-3 pt-2 pb-1">
            <p className="text-[10px] text-neutral-400 uppercase tracking-wide font-medium mb-1">
              Chapi sugiere
            </p>

            <DishRow dish={suggested_dish} highlight />

            {/* Otros platos — expandibles */}
            {hasExtras && expanded && (
              <div className="mt-1">
                {extraDishes.map(dish => (
                  <DishRow key={dish.id} dish={dish} />
                ))}
              </div>
            )}

            {/* Toggle ver más / menos — stop propagation so Link doesn't fire */}
            {hasExtras && (
              <button
                onClick={e => { e.preventDefault(); setExpanded(v => !v) }}
                className="w-full flex items-center justify-center gap-1 pt-1 pb-2
                           text-[11px] text-neutral-400 hover:text-[#FF6B35] transition-colors"
              >
                {expanded
                  ? <><ChevronUp size={12} /> Ver menos</>
                  : <><ChevronDown size={12} /> Ver {extraDishes.length} plato{extraDishes.length > 1 ? 's' : ''} más</>
                }
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer — ver menú */}
      <div className="border-t border-neutral-50 px-4 py-2.5">
        <span className="text-xs text-neutral-400 group-hover:text-[#FF6B35] transition-colors font-medium">
          Ver menú →
        </span>
      </div>
    </Link>
  )
}
