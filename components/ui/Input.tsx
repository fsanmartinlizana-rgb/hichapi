import React from 'react'

/**
 * Input — campo de texto del UI claro (Design System light-first). Pozo hundido
 * (surface-sunken), borde hairline que se pone naranjo al foco con ring suave.
 * Soporta ícono a la izquierda, prefijo (ej. "$" en DM Mono), label y hint/error.
 *
 * Lee tokens semánticos → respeta el tema oscuro automáticamente.
 */
export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  icon?: React.ReactNode
  prefix?: React.ReactNode
  size?: InputSize
  wrapClassName?: string
}

const HEIGHT_CLASS: Record<InputSize, string> = {
  sm: 'h-9',
  md: 'h-11',
  lg: 'h-[50px]',
}

export function Input({
  label,
  hint,
  error,
  icon,
  prefix,
  size = 'md',
  id,
  className = '',
  wrapClassName = '',
  ...rest
}: InputProps) {
  const reactId = React.useId()
  const fieldId = id || reactId
  const fontSize = size === 'lg' ? 'text-base' : 'text-sm'

  return (
    <div className={['flex flex-col gap-1.5', wrapClassName].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={fieldId} className="text-[13px] font-semibold text-[var(--text-strong)]">
          {label}
        </label>
      )}
      <div
        className={[
          'flex items-center gap-2 px-3 rounded-[var(--radius-md)] border bg-[var(--surface-sunken)]',
          'transition-[border-color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-soft)]',
          'focus-within:shadow-[var(--ring-focus)]',
          error
            ? 'border-[var(--danger-border)]'
            : 'border-[var(--border-default)] focus-within:border-[var(--border-focus)]',
          HEIGHT_CLASS[size],
        ].join(' ')}
      >
        {icon && <span className="inline-flex shrink-0 text-[var(--text-subtle)]">{icon}</span>}
        {prefix && (
          <span className="font-price text-[var(--text-subtle)] shrink-0">{prefix}</span>
        )}
        <input
          id={fieldId}
          className={[
            'flex-1 min-w-0 h-full border-none outline-none bg-transparent',
            'text-[var(--text-strong)] placeholder:text-[var(--text-subtle)]',
            fontSize,
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
      </div>
      {(hint || error) && (
        <span
          className={[
            'text-[12px]',
            error ? 'text-[var(--danger-text)]' : 'text-[var(--text-subtle)]',
          ].join(' ')}
        >
          {error || hint}
        </span>
      )}
    </div>
  )
}

export default Input
