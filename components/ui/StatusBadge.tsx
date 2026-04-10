import type { LucideIcon } from 'lucide-react'

// ── StatusBadge ──────────────────────────────────────────────────────────────
//
// Color-coded pill used everywhere we render a discrete state (order status,
// emission status, print job status, …). Each tone resolves to a single color
// applied as text + 10% bg + 25% border, so the badge stays legible on dark
// surfaces without us repeating the inline-style trick everywhere.

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand'

const TONE_HEX: Record<Tone, string> = {
  neutral: '#94A3B8',
  info:    '#60A5FA',
  success: '#34D399',
  warning: '#FBBF24',
  danger:  '#F87171',
  brand:   '#FF6B35',
}

interface StatusBadgeProps {
  tone:   Tone
  label:  string
  icon?:  LucideIcon
  size?:  'sm' | 'md'
}

export function StatusBadge({ tone, label, icon: Icon, size = 'sm' }: StatusBadgeProps) {
  const hex = TONE_HEX[tone]
  const padding = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[10px]'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold border ${padding}`}
      style={{
        color:           hex,
        backgroundColor: `${hex}1a`, // 10% alpha
        borderColor:     `${hex}40`, // 25% alpha
      }}
    >
      {Icon && <Icon size={size === 'md' ? 11 : 9} strokeWidth={size === 'md' ? 2.5 : 3} />}
      {label}
    </span>
  )
}
