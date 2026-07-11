/**
 * Theme helper — tema claro/oscuro del Design System light-first.
 *
 * El tema oscuro es opt-in: se aplica poniendo `data-theme="dark"` en <html>.
 * En claro se REMUEVE el atributo (así valen los defaults de :root). La elección
 * se persiste en localStorage. Ver tokens en app/globals.css ([data-theme="dark"]).
 *
 * Funciones puras/aisladas para poder testearlas sin renderizar componentes.
 */
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'hichapi-theme'
export const THEME_ATTR = 'data-theme'

/** Lee el tema guardado en localStorage. null si no hay o no hay storage. */
export function getStoredTheme(): Theme | null {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

/** Aplica el tema al documento: dark → set attr; light → remove attr. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'dark') {
    root.setAttribute(THEME_ATTR, 'dark')
  } else {
    root.removeAttribute(THEME_ATTR)
  }
}

/** Lee el tema actualmente aplicado en el documento. */
export function getActiveTheme(root: HTMLElement = document.documentElement): Theme {
  return root.getAttribute(THEME_ATTR) === 'dark' ? 'dark' : 'light'
}

/** El opuesto del tema dado. */
export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}

/** Tema inicial: primero lo guardado; si no, claro (light-first). */
export function resolveInitialTheme(): Theme {
  return getStoredTheme() ?? 'light'
}

/** Aplica y persiste un tema. */
export function setTheme(theme: Theme, root: HTMLElement = document.documentElement): Theme {
  applyTheme(theme, root)
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
  return theme
}

/** Togglea claro↔oscuro sobre el tema actualmente aplicado, persiste y retorna. */
export function toggleTheme(root: HTMLElement = document.documentElement): Theme {
  return setTheme(nextTheme(getActiveTheme(root)), root)
}
