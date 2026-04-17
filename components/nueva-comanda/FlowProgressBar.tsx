import { FlowStep } from './types'

const STEPS = ['Mesa', 'Productos', 'Confirmar'] as const

interface FlowProgressBarProps {
  currentStep: FlowStep
}

export default function FlowProgressBar({ currentStep }: FlowProgressBarProps) {
  return (
    <div className="flex items-center justify-center gap-0 w-full">
      {STEPS.map((label, index) => {
        const isCompleted = index < currentStep
        const isActive    = index === currentStep
        const isFuture    = index > currentStep

        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                  isCompleted && 'bg-emerald-500 text-white',
                  isActive    && 'bg-indigo-500 text-white ring-2 ring-indigo-400/40',
                  isFuture    && 'bg-white/10 text-white/30',
                ].filter(Boolean).join(' ')}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              <span
                className={[
                  'text-xs whitespace-nowrap',
                  isActive    && 'font-bold text-indigo-400',
                  isCompleted && 'font-medium text-emerald-400',
                  isFuture    && 'text-white/30',
                ].filter(Boolean).join(' ')}
              >
                {label}
              </span>
            </div>

            {index < STEPS.length - 1 && (
              <div
                className={[
                  'h-0.5 w-16 mx-2 mb-5 transition-colors',
                  index < currentStep ? 'bg-emerald-500/60' : 'bg-white/10',
                ].filter(Boolean).join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
