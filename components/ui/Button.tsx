import React from 'react'

/**
 * Button — control de acción primario de HiChapi (Design System light-first).
 *
 * `primary` naranjo con glow de marca para la acción principal, `secondary`
 * blanco con borde, `ghost` para toolbars, `danger` rojo suave que rellena al
 * hover. El press encoge a scale(0.97) — nunca un flip duro de color.
 *
 * Lee los tokens semánticos (var(--surface-card), var(--danger-*)…) por lo que
 * respeta automáticamente el tema oscuro (data-theme="dark").
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  block?: boolean
  className?: string
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-orange-500 text-white border border-orange-500 shadow-[var(--shadow-brand)] ' +
    'hover:bg-orange-600 hover:border-orange-600',
  secondary:
    'bg-surface text-ink-900 border border-line-strong shadow-[var(--shadow-xs)] ' +
    'hover:border-[var(--border-strong)] hover:bg-[var(--neutral-25)]',
  ghost:
    'bg-transparent text-[var(--text-muted)] border border-transparent ' +
    'hover:bg-[var(--surface-hover)] hover:text-[var(--text-strong)]',
  danger:
    'bg-danger-bg text-danger-fg border border-[var(--danger-border)] ' +
    'hover:bg-danger hover:text-[var(--text-strong)] hover:border-[var(--danger)]',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-[34px] px-3 text-[13px] gap-1.5 rounded-[var(--radius-md)]',
  md: 'h-[42px] px-[18px] text-sm gap-2 rounded-[var(--radius-md)]',
  lg: 'h-[52px] px-6 text-base gap-2.5 rounded-[var(--radius-lg)]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  block = false,
  disabled = false,
  type = 'button',
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const cls = [
    'inline-flex items-center justify-center font-semibold leading-none whitespace-nowrap',
    'transition-[background-color,border-color,color,transform] duration-[var(--dur-base)] ease-[var(--ease-soft)]',
    'active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
    'focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]',
    block ? 'flex w-full' : '',
    SIZE_CLASS[size],
    VARIANT_CLASS[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} disabled={disabled} className={cls} {...rest}>
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
      {iconRight && <span className="inline-flex shrink-0">{iconRight}</span>}
    </button>
  )
}

export default Button
