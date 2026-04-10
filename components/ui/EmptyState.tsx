import type { LucideIcon } from 'lucide-react'

// ── EmptyState ───────────────────────────────────────────────────────────────
//
// Reusable empty state for lists that have no rows yet. Keeps the wording and
// spacing consistent across modules: dashed icon container, title, helper text,
// and an optional CTA. Use it instead of one-off "no hay datos" markup.

interface EmptyStateProps {
  icon:        LucideIcon
  title:       string
  description?: string
  action?: {
    label:   string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-white/3 border border-dashed border-white/10 flex items-center justify-center mb-4">
        <Icon size={20} className="text-white/30" />
      </div>
      <p className="text-white/80 text-sm font-semibold">{title}</p>
      {description && (
        <p className="text-white/35 text-xs mt-1.5 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-4 py-2 rounded-xl bg-[#FF6B35]/15 border border-[#FF6B35]/35
                     text-[#FF6B35] text-xs font-semibold hover:bg-[#FF6B35]/25 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
