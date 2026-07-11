import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

/**
 * Guarda de regresión de la migración light-first del panel.
 *
 * El interior del panel (app/(restaurant) + componentes que renderiza) se migró
 * de oscuro a claro usando tokens semánticos. Estos tests fallan si alguien
 * reintroduce los patrones oscuros hardcodeados que la migración eliminó:
 *   - text-white/<n>  (texto blanco translúcido, ilegible sobre claro)
 *   - border-white/<n>
 *   - fondos navy oscuros como bg-[#0A0A14] / bg-[#161622] / …
 *
 * Los botones de marca (bg-[#FF6B35] text-white) SÍ conservan blanco — no se
 * chequean acá. Ver migración en app/globals.css (capa de tokens).
 */
const ROOT = path.resolve(__dirname, '../..')

// Mismos dirs que cubrió la migración (excluye layout.tsx hand-tuned, tests,
// y superficies fuera de scope: admin/landing/cuenta/discovery/public/chat).
const GLOBS = [
  'app/(restaurant)/*.tsx',
  'app/(restaurant)/**/*.tsx',
  'components/restaurant/**/*.tsx',
  'components/nueva-comanda/**/*.tsx',
  'components/bills/**/*.tsx',
  'components/dte/**/*.tsx',
  'components/carta/**/*.tsx',
  'components/manual-print/**/*.tsx',
]

function panelFiles(): string[] {
  const out = execSync(
    `git -C "${ROOT}" ls-files ${GLOBS.map((g) => `"${g}"`).join(' ')}`,
    { encoding: 'utf8' },
  )
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => !f.endsWith('layout.tsx') && !f.includes('.test.'))
}

const DARK_BG = /\bbg-\[#(0A0A14|0F0F1C|0F0F1A|0E0E14|0D0D1A|161622|1C1C2E|1A1A2E|13132A|12121E)\]/i

describe('Panel light-first — sin patrones oscuros hardcodeados', () => {
  const files = panelFiles()

  it('encuentra archivos del panel para chequear', () => {
    expect(files.length).toBeGreaterThan(40)
  })

  it('ningún text-white/<n> (texto blanco translúcido)', () => {
    const offenders: string[] = []
    for (const f of files) {
      const src = readFileSync(path.join(ROOT, f), 'utf8')
      if (/\btext-white\/\d+/.test(src)) offenders.push(f)
    }
    expect(offenders).toEqual([])
  })

  it('ningún border-white/<n>', () => {
    const offenders: string[] = []
    for (const f of files) {
      const src = readFileSync(path.join(ROOT, f), 'utf8')
      if (/\bborder-white\/\d+/.test(src)) offenders.push(f)
    }
    expect(offenders).toEqual([])
  })

  it('ningún fondo navy oscuro hardcodeado (bg-[#0A0A14] / #161622 / …)', () => {
    const offenders: string[] = []
    for (const f of files) {
      const src = readFileSync(path.join(ROOT, f), 'utf8')
      if (DARK_BG.test(src)) offenders.push(f)
    }
    expect(offenders).toEqual([])
  })
})

describe('Tokens light-first presentes en globals.css', () => {
  const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')

  it('define la capa semántica clara y el tema oscuro', () => {
    expect(css).toContain('--bg-canvas')
    expect(css).toContain('--surface-card')
    expect(css).toContain('--text-strong')
    expect(css).toContain('[data-theme="dark"]')
  })

  it('mantiene la marca (naranjo #FF6B35 y navy #1A1A2E)', () => {
    expect(css).toContain('#FF6B35')
    expect(css).toContain('#1A1A2E')
  })
})
