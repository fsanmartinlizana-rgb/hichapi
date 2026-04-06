import Image from 'next/image'
import { Star, MapPin } from 'lucide-react'
import { RestaurantResult } from '@/lib/types'

function formatPrice(clp: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(clp)
}

function formatDistance(meters?: number): string {
  if (!meters) return ''
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function ResultCard({
  result,
  index,
}: {
  result: RestaurantResult
  index: number
}) {
  const { restaurant, suggested_dish, distance_m } = result

  return (
    <article
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-neutral-100
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
          <div
            className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm
                          text-[#1A1A2E] text-xs font-medium px-2 py-1 rounded-full
                          flex items-center gap-1"
          >
            <MapPin size={10} />
            {formatDistance(distance_m)}
          </div>
        )}

        <div
          className="absolute top-3 left-3 bg-[#FF6B35] text-white
                        text-xs font-bold w-6 h-6 rounded-full
                        flex items-center justify-center"
        >
          {index + 1}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-semibold text-[#1A1A2E] text-base leading-tight">
            {restaurant.name}
          </h3>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <Star size={12} className="text-[#FF6B35] fill-[#FF6B35]" />
            <span className="text-xs font-medium text-neutral-600">
              {restaurant.rating.toFixed(1)}
            </span>
          </div>
        </div>

        <p className="text-xs text-neutral-400 mb-3">{restaurant.neighborhood}</p>

        {suggested_dish && (
          <div className="bg-[#FAFAF8] rounded-xl p-3">
            <p className="text-xs text-neutral-400 mb-1 uppercase tracking-wide font-medium">
              Chapi sugiere
            </p>
            <p className="font-medium text-[#1A1A2E] text-sm italic mb-1">
              {suggested_dish.name}
            </p>
            {suggested_dish.description && (
              <p className="text-xs text-neutral-500 line-clamp-2 mb-2">
                {suggested_dish.description}
              </p>
            )}
            <p className="font-mono text-[#FF6B35] font-semibold text-sm">
              {formatPrice(suggested_dish.price)}
            </p>
          </div>
        )}

        {suggested_dish?.tags && suggested_dish.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {suggested_dish.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-500
                           rounded-full capitalize"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
