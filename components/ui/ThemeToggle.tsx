'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { type Theme, resolveInitialTheme, setTheme, toggleTheme } from '@/lib/theme'

/**
 * ThemeToggle — botón sol/luna para el tema claro/oscuro del panel.
 *
 * Aplica el tema guardado al montar (light-first por defecto) y togglea
 * data-theme="dark" en <html>, persistiendo en localStorage. En esta fase de
 * migración solo las superficies ya migradas (sidebar, primitivas) flipean; las
 * páginas internas todavía oscuras se migran en la próxima fase.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const initial = resolveInitialTheme()
    setTheme(initial)
    setThemeState(initial)
  }, [])

  function onClick() {
    setThemeState(toggleTheme())
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={isDark ? 'Tema claro' : 'Tema oscuro'}
      className={[
        'p-1.5 rounded-lg shrink-0 transition-colors',
        'text-[var(--text-subtle)] hover:text-[var(--text-strong)] hover:bg-[var(--surface-hover)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}

export default ThemeToggle
