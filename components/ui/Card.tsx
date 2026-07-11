import React from 'react'

/**
 * Card — la superficie blanca universal del Design System light-first. Todo
 * panel, tarjeta KPI, item de lista y cuerpo de modal vive en una Card.
 *
 * Reposa con sombra suave + borde hairline sobre el lienzo crema; `interactive`
 * la levanta al hover (para tarjetas clickeables); `accent` agrega el borde
 * superior naranjo de 3px. La elevación es gentil — nunca apilar sombras duras.
 */
export type CardPad = 'none' | 'sm' | 'md' | 'lg'
export type CardRadius = 'lg' | 'xl' | '2xl' | '3xl'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  accent?: boolean
  pad?: CardPad
  radius?: CardRadius
}

const PAD_CLASS: Record<CardPad, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-[18px]',
  lg: 'p-6',
}

const RADIUS_CLASS: Record<CardRadius, string> = {
  lg: 'rounded-[var(--radius-lg)]',
  xl: 'rounded-[var(--radius-xl)]',
  '2xl': 'rounded-[var(--radius-2xl)]',
  '3xl': 'rounded-[var(--radius-3xl)]',
}

export function Card({
  interactive = false,
  accent = false,
  pad = 'md',
  radius = 'xl',
  className = '',
  children,
  ...rest
}: CardProps) {
  const cls = [
    'bg-surface border border-line shadow-[var(--shadow-sm)]',
    accent ? 'border-t-[3px] border-t-orange-500' : '',
    interactive
      ? 'cursor-pointer transition-[box-shadow,transform] duration-[var(--dur-slow)] ease-[var(--ease-soft)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5'
      : '',
    RADIUS_CLASS[radius],
    PAD_CLASS[pad],
    pad === 'none' ? 'overflow-hidden' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  )
}

export default Card
