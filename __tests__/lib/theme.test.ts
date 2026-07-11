// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getActiveTheme,
  getStoredTheme,
  nextTheme,
  resolveInitialTheme,
  setTheme,
  toggleTheme,
} from '@/lib/theme'

/**
 * Tests del toggle claro/oscuro del Design System light-first.
 * Verifica que se aplique/quite data-theme="dark" y que persista en localStorage.
 */
describe('lib/theme — toggle claro/oscuro', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    window.localStorage.clear()
  })

  it('applyTheme("dark") pone data-theme="dark" en <html>', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('applyTheme("light") remueve el atributo (vuelve a los defaults de :root)', () => {
    applyTheme('dark')
    applyTheme('light')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('getActiveTheme lee el tema aplicado en el documento', () => {
    expect(getActiveTheme()).toBe('light')
    applyTheme('dark')
    expect(getActiveTheme()).toBe('dark')
  })

  it('nextTheme devuelve el opuesto', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
  })

  it('setTheme aplica Y persiste en localStorage', () => {
    setTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('getStoredTheme: null si no hay nada, valor válido si existe', () => {
    expect(getStoredTheme()).toBeNull()
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(getStoredTheme()).toBe('dark')
    window.localStorage.setItem(THEME_STORAGE_KEY, 'basura')
    expect(getStoredTheme()).toBeNull()
  })

  it('resolveInitialTheme: light-first por defecto, respeta lo guardado', () => {
    expect(resolveInitialTheme()).toBe('light')
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('toggleTheme flipea claro↔oscuro sobre el estado actual y persiste', () => {
    expect(toggleTheme()).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    expect(toggleTheme()).toBe('light')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })
})
