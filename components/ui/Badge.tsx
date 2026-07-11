import React from 'react'

/**
 * Badge — pill de color para cualquier estado discreto (estado de comanda,
 * emisión DTE, nivel de stock, plan). Reconstrucción light-surface del truco
 * dark de StatusBadge: fondo tinte suave + texto legible + borde, en vez de
 * brillante-sobre-negro. `barra` (violeta) = ruteo cocina vs barra en el KDS.
 *
 * Lee tokens semánticos por tono, así respeta el tema oscuro automáticamente.
 */
export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'barra'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps {
  tone?: BadgeTone
  label?: React.ReactNode
  icon?: React.ReactNode
  dot?: boolean
  solid?: boolean
  size?: BadgeSize
  className?: string
  children?: React.ReactNode
}

/** Trío de tokens por tono: [texto, superficie, borde]. */
const TONE_VARS: Record<BadgeTone, { fg: string; bg: string; border: string }> = {
  neutral: { fg: 'var(--text-muted)', bg: 'var(--surface-sunken)', border: 'var(--border-default)' },
  brand: { fg: 'var(--orange-600)', bg: 'var(--orange-50)', border: 'var(--orange-200)' },
  info: { fg: 'var(--info-text)', bg: 'var(--info-surface)', border: 'var(--info-border)' },
  success: { fg: 'var(--success-text)', bg: 'var(--success-surface)', border: 'var(--success-border)' },
  warning: { fg: 'var(--warning-text)', bg: 'var(--warning-surface)', border: 'var(--warning-border)' },
  danger: { fg: 'var(--danger-text)', bg: 'var(--danger-surface)', border: 'var(--danger-border)' },
  barra: { fg: 'var(--accent-violet-text)', bg: 'var(--accent-violet-surface)', border: 'var(--accent-violet-border)' },
}

export function Badge({
  tone = 'neutral',
  label,
  icon,
  dot = false,
  solid = false,
  size = 'sm',
  className = '',
  children,
}: BadgeProps) {
  const t = TONE_VARS[tone]
  const style: React.CSSProperties = solid
    ? { background: t.fg, color: '#fff', borderColor: t.fg }
    : { background: t.bg, color: t.fg, borderColor: t.border }

  const cls = [
    'inline-flex items-center gap-1.5 border font-semibold leading-none whitespace-nowrap',
    'rounded-[var(--radius-pill)]',
    size === 'md' ? 'px-[11px] py-1 text-[12px]' : 'px-[9px] py-[2.5px] text-[11px]',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={cls} style={style}>
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: solid ? '#fff' : t.fg }}
        />
      )}
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {label ?? children}
    </span>
  )
}

export default Badge
