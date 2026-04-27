'use client'

/**
 * PricingCard — card compacta y expandible para la sección de planes.
 *
 * En estado compacto muestra solo: nombre, badge, precio, descripción, las
 * primeras 3 features y el CTA. Un botón "Ver todo" expande el resto.
 *
 * El plan destacado (`highlighted`) arranca expandido para que quede claro
 * todo lo que incluye.
 */

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'

interface PricingCardProps {
  name:        string
  badge:       string
  price:       string
  period:      string
  description: string
  features:    string[]
  note?:       string
  cta:         string
  href:        string
  highlighted?: boolean
}

const COMPACT_FEATURES_COUNT = 3

export default function PricingCard({
  name,
  badge,
  price,
  period,
  description,
  features,
  note,
  cta,
  href,
  highlighted = false,
}: PricingCardProps) {
  // El plan destacado arranca expandido — es el que queremos que vean entero.
  const [expanded, setExpanded] = useState(highlighted)
  const hasMoreFeatures = features.length > COMPACT_FEATURES_COUNT
  const visibleFeatures = expanded ? features : features.slice(0, COMPACT_FEATURES_COUNT)
  const hiddenCount = features.length - COMPACT_FEATURES_COUNT

  return (
    <div
      className={`relative rounded-3xl p-6 lg:p-7 flex flex-col transition-shadow ${
        highlighted
          ? 'border-2 border-[#FF6B35] bg-white shadow-xl shadow-[#FF6B35]/10'
          : 'border border-neutral-200 bg-white shadow-sm hover:shadow-md'
      }`}
    >
      {/* Plan name */}
      <p className="text-sm font-bold text-[#1A1A2E] mb-1">{name}</p>

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
      <div className="mb-3 mt-2">
        <span
          className="text-4xl font-extrabold text-[#1A1A2E]"
          style={{ fontFamily: 'var(--font-dm-mono), monospace' }}
        >
          {price}
        </span>
        <span className="text-sm text-neutral-400 ml-1">{period}</span>
      </div>

      <p className="text-sm text-neutral-500 mb-4 leading-relaxed">{description}</p>

      {/* Features (compactas o expandidas) */}
      <ul className="space-y-2 mb-4 flex-1">
        {visibleFeatures.map(feat => (
          <li key={feat} className="flex items-start gap-2.5 text-sm text-[#1A1A2E]">
            <Check size={16} className="text-[#FF6B35] shrink-0 mt-0.5" />
            <span>{feat}</span>
          </li>
        ))}
      </ul>

      {/* Toggle expand */}
      {hasMoreFeatures && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          className="flex items-center justify-center gap-1 text-xs font-semibold text-[#FF6B35] hover:text-[#e55a2b] mb-3 transition-colors"
        >
          {expanded
            ? <>Ver menos <ChevronUp size={12} /></>
            : <>Ver {hiddenCount} {hiddenCount === 1 ? 'feature' : 'features'} más <ChevronDown size={12} /></>}
        </button>
      )}

      {/* Note */}
      {note && (
        <p className="text-xs text-neutral-400 mb-3 px-3 py-1.5 bg-neutral-50 rounded-lg text-center">
          {note}
        </p>
      )}

      {/* CTA */}
      <Link
        href={href}
        className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${
          highlighted
            ? 'bg-[#FF6B35] text-white hover:bg-[#e55a2b] shadow-sm'
            : 'border border-neutral-200 text-[#1A1A2E] hover:border-[#FF6B35] hover:text-[#FF6B35]'
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}
