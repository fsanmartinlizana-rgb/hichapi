'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

// ── Modal ────────────────────────────────────────────────────────────────────
//
// Centered overlay with consistent dark surface, backdrop click-to-close, and
// ESC handler. Use for any blocking dialog (open/close caja, add expense,
// confirm destructive action, show generated token, …). Replaces the half-
// dozen ad-hoc modal shells scattered across module pages.

interface ModalProps {
  open:        boolean
  onClose:     () => void
  title:       string
  description?: string
  size?:       'sm' | 'md' | 'lg'
  children:    React.ReactNode
  /** Optional sticky footer (typically buttons). */
  footer?:     React.ReactNode
}

const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
} as const

export function Modal({ open, onClose, title, description, size = 'md', children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`bg-[#161622] border border-white/10 rounded-2xl w-full ${SIZE_CLASS[size]} max-h-[90vh] flex flex-col shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-white/5 shrink-0">
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm">{title}</p>
            {description && (
              <p className="text-white/40 text-xs mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="p-5 pt-4 border-t border-white/5 shrink-0 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
