// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'

/**
 * Render de las primitivas base del Design System light-first.
 * Verifica que rendericen y que cableen los tokens nuevos (utilidades Tailwind
 * respaldadas por @theme + CSS vars semánticas), no hexes oscuros hardcodeados.
 */
afterEach(cleanup)

describe('Button', () => {
  it('renderiza children y type=button por defecto', () => {
    const { getByRole } = render(<Button>Nueva comanda</Button>)
    const btn = getByRole('button')
    expect(btn.textContent).toContain('Nueva comanda')
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('variant primary usa el token de marca (bg-orange-500), no un hex oscuro', () => {
    const { getByRole } = render(<Button variant="primary">Guardar</Button>)
    const cls = getByRole('button').className
    expect(cls).toContain('bg-orange-500')
    expect(cls).toContain('text-white')
    expect(cls).not.toMatch(/#0A0A14|#161622|#0F0F1C/i)
  })

  it('variant secondary usa superficie/tinta por token', () => {
    const { getByRole } = render(<Button variant="secondary">Cancelar</Button>)
    const cls = getByRole('button').className
    expect(cls).toContain('bg-surface')
    expect(cls).toContain('text-ink-900')
  })

  it('disabled desactiva el botón y renderiza el ícono', () => {
    const { getByRole } = render(
      <Button disabled icon={<svg data-testid="icon" />}>Eliminar</Button>,
    )
    const btn = getByRole('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.querySelector('[data-testid="icon"]')).not.toBeNull()
  })
})

describe('Card', () => {
  it('reposa en superficie blanca + borde + sombra por token', () => {
    const { container } = render(<Card>contenido</Card>)
    const cls = (container.firstChild as HTMLElement).className
    expect(cls).toContain('bg-surface')
    expect(cls).toContain('border-line')
    expect(cls).toContain('shadow-[var(--shadow-sm)]')
  })

  it('accent agrega el borde superior naranjo', () => {
    const { container } = render(<Card accent>x</Card>)
    expect((container.firstChild as HTMLElement).className).toContain('border-t-orange-500')
  })

  it('interactive habilita el lift al hover', () => {
    const { container } = render(<Card interactive>x</Card>)
    expect((container.firstChild as HTMLElement).className).toContain('hover:-translate-y-0.5')
  })
})

describe('Badge', () => {
  it('renderiza el label', () => {
    const { getByText } = render(<Badge tone="success" label="Lista" />)
    expect(getByText('Lista')).not.toBeNull()
  })

  it('el tono cablea los tokens semánticos de estado (no bright-on-black)', () => {
    const { getByText } = render(<Badge tone="success" label="Lista" />)
    const style = getByText('Lista').getAttribute('style') || ''
    expect(style).toContain('var(--success-surface)')
    expect(style).toContain('var(--success-text)')
  })

  it('dot renderiza el punto de estado', () => {
    const { container } = render(<Badge tone="info" dot label="Recibida" />)
    // span raíz + span del dot
    expect(container.querySelectorAll('span').length).toBeGreaterThanOrEqual(2)
  })
})

describe('Input', () => {
  it('asocia label con el input y renderiza placeholder', () => {
    const { getByLabelText } = render(
      <Input label="Nombre del restaurante" placeholder="Osteria del Porto" />,
    )
    const input = getByLabelText('Nombre del restaurante') as HTMLInputElement
    expect(input.tagName).toBe('INPUT')
    expect(input.getAttribute('placeholder')).toBe('Osteria del Porto')
  })

  it('error muestra el mensaje y aplica el borde de peligro por token', () => {
    const { getByText, container } = render(<Input label="Email" error="Email inválido" />)
    expect(getByText('Email inválido')).not.toBeNull()
    const html = container.innerHTML
    expect(html).toContain('var(--danger-border)')
  })

  it('prefix renderiza en DM Mono (.font-price)', () => {
    const { getByText } = render(<Input label="Precio" prefix="$" />)
    expect(getByText('$').className).toContain('font-price')
  })
})
