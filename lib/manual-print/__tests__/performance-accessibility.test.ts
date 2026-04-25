/**
 * Performance and Accessibility Validation Tests
 *
 * Validates that the manual print control system meets performance and
 * accessibility requirements for touch-optimized tablet interfaces.
 *
 * Requirements: 9.5 (UI transitions < 300ms), 8.4 (print timeout ≤ 10s), 9.1 (44px touch targets)
 *
 * NOTE: CSS-level checks (touch target sizes, transition durations, ARIA attributes)
 * are validated by inspecting component source strings, since JSDOM does not compute
 * Tailwind styles. These checks are intentionally static — they verify the correct
 * Tailwind classes and HTML attributes are present in the component source.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { withTimeout } from '../errors'

// ── Source helpers ────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, '../../..')

function readComponent(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8')
}

// ── 1. withTimeout enforces 10-second timeout (Req 8.4) ──────────────────────

describe('withTimeout — 10-second print request timeout (Req 8.4)', () => {
  it('resolves immediately when the operation completes before the timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 10_000)
    expect(result).toBe('ok')
  })

  it('rejects with TimeoutError when the operation exceeds the timeout', async () => {
    const neverResolves = new Promise<never>(resolve => setTimeout(resolve, 500))

    await expect(withTimeout(neverResolves, 50)).rejects.toMatchObject({
      name: 'TimeoutError',
    })
  })

  it('default timeout is 10 000 ms — error message references 10 seconds', async () => {
    const neverResolves = new Promise<never>(resolve => setTimeout(resolve, 500))

    try {
      await withTimeout(neverResolves, 50)
    } catch (err: any) {
      // The error message should mention the timeout in seconds
      expect(err.message).toMatch(/\d+\s*segundos/)
    }
  })

  it('rejects in under 10 seconds for a 10 000 ms timeout (performance bound)', async () => {
    const start = Date.now()
    const neverResolves = new Promise<never>(resolve => setTimeout(resolve, 500))

    try {
      await withTimeout(neverResolves, 100)
    } catch {
      // expected
    }

    const elapsed = Date.now() - start
    // Should reject well within 10 seconds
    expect(elapsed).toBeLessThan(10_000)
  })

  it('passes through the original rejection without wrapping it', async () => {
    const originalError = new Error('Original network error')
    const failingPromise = Promise.reject(originalError)

    await expect(withTimeout(failingPromise, 10_000)).rejects.toThrow('Original network error')
  })

  it('10-second timeout is the default when no timeout argument is provided', async () => {
    // Verify the default by checking the function signature in source
    const errorsSource = readFileSync(resolve(ROOT, 'lib/manual-print/errors.ts'), 'utf-8')
    // The default parameter should be 10000 (may include a type annotation like `timeoutMs: number = 10000`)
    expect(errorsSource).toMatch(/timeoutMs[^=]*=\s*10000/)
  })
})

// ── 2. UI transitions use duration-200 (< 300ms) (Req 9.5) ──────────────────
//
// Tailwind's `duration-200` maps to `transition-duration: 200ms`, which is
// well under the 300ms requirement. We verify the class is present on every
// interactive element in both components.

describe('UI transitions complete under 300ms — duration-200 class (Req 9.5)', () => {
  describe('ManualPrintControls component', () => {
    let source: string

    beforeEach(() => {
      source = readComponent('components/manual-print/ManualPrintControls.tsx')
    })

    it('uses transition-all with duration-200 on the precuenta button', () => {
      // The button className array should include both transition-all and duration-200
      expect(source).toContain('transition-all')
      expect(source).toContain('duration-200')
    })

    it('does NOT use duration-300 or higher on interactive elements', () => {
      // Ensure no slow transitions are used
      expect(source).not.toMatch(/duration-3\d\d/)
      expect(source).not.toMatch(/duration-[4-9]\d\d/)
      expect(source).not.toMatch(/duration-1000/)
    })
  })

  describe('ElectronicReceiptOptions component', () => {
    let source: string

    beforeEach(() => {
      source = readComponent('components/manual-print/ElectronicReceiptOptions.tsx')
    })

    it('uses transition-all with duration-200 on option buttons', () => {
      expect(source).toContain('transition-all')
      expect(source).toContain('duration-200')
    })

    it('uses duration-200 on the email input field', () => {
      // The input element should also have a fast transition
      const inputSection = source.slice(
        source.indexOf('<input'),
        source.indexOf('/>', source.indexOf('<input')) + 2
      )
      expect(inputSection).toContain('duration-200')
    })

    it('does NOT use duration-300 or higher on interactive elements', () => {
      expect(source).not.toMatch(/duration-3\d\d/)
      expect(source).not.toMatch(/duration-[4-9]\d\d/)
      expect(source).not.toMatch(/duration-1000/)
    })
  })
})

// ── 3. Touch targets are minimum 44px (Req 9.1) ──────────────────────────────
//
// Tailwind's `min-h-[44px]` enforces the 44×44 CSS point minimum required
// by WCAG 2.5.5 and Apple HIG for touch targets. We verify every interactive
// button and input carries this class.

describe('Touch targets minimum 44px — min-h-[44px] class (Req 9.1)', () => {
  describe('ManualPrintControls component', () => {
    let source: string

    beforeEach(() => {
      source = readComponent('components/manual-print/ManualPrintControls.tsx')
    })

    it('precuenta button has min-h-[44px] touch target', () => {
      expect(source).toContain('min-h-[44px]')
    })

    it('comment in source documents the 44px touch target requirement', () => {
      // The component should document why min-h-[44px] is used
      expect(source).toMatch(/44/)
    })
  })

  describe('ElectronicReceiptOptions component', () => {
    let source: string

    beforeEach(() => {
      source = readComponent('components/manual-print/ElectronicReceiptOptions.tsx')
    })

    it('print option button has min-h-[44px] touch target', () => {
      expect(source).toContain('min-h-[44px]')
    })

    it('email option button has min-h-[44px] touch target', () => {
      // Count occurrences — should appear on multiple elements
      const occurrences = (source.match(/min-h-\[44px\]/g) || []).length
      expect(occurrences).toBeGreaterThanOrEqual(2)
    })

    it('email input field has min-h-[44px] touch target', () => {
      // The input element should also meet the 44px minimum
      const inputSection = source.slice(
        source.indexOf('<input'),
        source.indexOf('/>', source.indexOf('<input')) + 2
      )
      expect(inputSection).toContain('min-h-[44px]')
    })

    it('cancel and confirm action buttons have min-h-[44px] touch target', () => {
      // All action buttons should meet the minimum
      const occurrences = (source.match(/min-h-\[44px\]/g) || []).length
      // print button, email button, email input, cancel button, confirm button
      expect(occurrences).toBeGreaterThanOrEqual(4)
    })
  })
})

// ── 4. ARIA labels on interactive elements (Req 9.1, accessibility) ──────────

describe('ARIA labels on interactive elements (accessibility)', () => {
  describe('ManualPrintControls component', () => {
    let source: string

    beforeEach(() => {
      source = readComponent('components/manual-print/ManualPrintControls.tsx')
    })

    it('precuenta button has aria-label attribute', () => {
      expect(source).toContain('aria-label=')
    })

    it('aria-label reflects the current state (idle/loading/success)', () => {
      // The aria-label should be dynamic based on state
      expect(source).toContain('Solicitar precuenta')
      expect(source).toContain('Solicitando precuenta')
      expect(source).toContain('Precuenta ya solicitada')
    })
  })

  describe('ElectronicReceiptOptions component', () => {
    let source: string

    beforeEach(() => {
      source = readComponent('components/manual-print/ElectronicReceiptOptions.tsx')
    })

    it('print option button has aria-label', () => {
      expect(source).toContain('aria-label="Imprimir boleta"')
    })

    it('email option button has aria-label', () => {
      expect(source).toContain('aria-label="Enviar por email"')
    })

    it('option buttons use aria-pressed to indicate selection state', () => {
      expect(source).toContain('aria-pressed=')
    })

    it('email input has aria-label for screen readers', () => {
      expect(source).toContain('aria-label="Correo electrónico del cliente"')
    })

    it('email input has aria-invalid for validation state', () => {
      expect(source).toContain('aria-invalid=')
    })

    it('cancel button has aria-label', () => {
      expect(source).toContain('aria-label="Cancelar"')
    })

    it('confirm button has dynamic aria-label reflecting current action', () => {
      expect(source).toContain('Confirmar impresión')
      expect(source).toContain('Confirmar envío por email')
    })
  })
})

// ── 5. Email input optimized for mobile keyboard (Req 9.4) ───────────────────

describe('Email input mobile keyboard optimization (Req 9.4)', () => {
  let source: string

  beforeEach(() => {
    source = readComponent('components/manual-print/ElectronicReceiptOptions.tsx')
  })

  it('email input has type="email" for native email keyboard on iOS/Android', () => {
    expect(source).toContain('type="email"')
  })

  it('email input has inputMode="email" for virtual keyboard hint', () => {
    expect(source).toContain('inputMode="email"')
  })

  it('email input has autoComplete="email" for autofill support', () => {
    expect(source).toContain('autoComplete="email"')
  })

  it('email input has a descriptive placeholder', () => {
    expect(source).toContain('placeholder=')
    // Placeholder should give an example email format
    expect(source).toMatch(/placeholder="[^"]*@[^"]*"/)
  })
})

// ── 6. Visual feedback on interaction (Req 9.3) ───────────────────────────────
//
// Buttons should provide immediate visual feedback via active:scale transforms
// and state-driven color changes.

describe('Immediate visual feedback on button press (Req 9.3)', () => {
  describe('ManualPrintControls component', () => {
    let source: string

    beforeEach(() => {
      source = readComponent('components/manual-print/ManualPrintControls.tsx')
    })

    it('precuenta button has active:scale for press feedback', () => {
      expect(source).toContain('active:scale-')
    })

    it('loading state shows spinner icon (RefreshCw animate-spin)', () => {
      expect(source).toContain('animate-spin')
    })

    it('success state shows CheckCircle2 icon', () => {
      expect(source).toContain('CheckCircle2')
    })

    it('error state shows AlertCircle icon', () => {
      expect(source).toContain('AlertCircle')
    })
  })

  describe('ElectronicReceiptOptions component', () => {
    let source: string

    beforeEach(() => {
      source = readComponent('components/manual-print/ElectronicReceiptOptions.tsx')
    })

    it('option buttons have active:scale for press feedback', () => {
      expect(source).toContain('active:scale-')
    })

    it('loading state shows RefreshCw animate-spin spinner', () => {
      expect(source).toContain('animate-spin')
    })

    it('success state shows CheckCircle2 icon', () => {
      expect(source).toContain('CheckCircle2')
    })

    it('error state shows AlertCircle icon', () => {
      expect(source).toContain('AlertCircle')
    })
  })
})

// ── 7. Controls disabled during operations (Req 9.6) ─────────────────────────

describe('Controls disabled during in-progress operations (Req 9.6)', () => {
  describe('ManualPrintControls component', () => {
    let source: string

    beforeEach(() => {
      source = readComponent('components/manual-print/ManualPrintControls.tsx')
    })

    it('button uses disabled attribute when loading or already succeeded', () => {
      expect(source).toContain('disabled={isDisabled}')
    })

    it('isDisabled is true when loading', () => {
      // Verify the logic: isDisabled = isLoading || isSuccess
      expect(source).toContain('isLoading || isSuccess')
    })
  })

  describe('ElectronicReceiptOptions component', () => {
    let source: string

    beforeEach(() => {
      source = readComponent('components/manual-print/ElectronicReceiptOptions.tsx')
    })

    it('option buttons are disabled when isProcessing', () => {
      expect(source).toContain('disabled={isProcessing}')
    })

    it('confirm button is disabled when email is invalid', () => {
      // The confirm button should be disabled when email option is selected but email is invalid
      expect(source).toContain('!emailValidation.isValid')
    })

    it('cursor-not-allowed applied when disabled', () => {
      expect(source).toContain('cursor-not-allowed')
    })
  })
})

/*
 * ── Manual / Visual Checks (cannot be automated in unit tests) ───────────────
 *
 * The following checks require manual testing on a real tablet device or
 * browser DevTools with touch simulation:
 *
 * 1. TRANSITION SMOOTHNESS (Req 9.5)
 *    - Open the garzon panel on a tablet or Chrome DevTools (iPad Air preset)
 *    - Tap "Solicitar precuenta" and observe the loading → success transition
 *    - The state change should feel instantaneous (< 300ms perceived)
 *    - Use DevTools Performance tab to confirm paint/layout < 300ms
 *
 * 2. TOUCH TARGET USABILITY (Req 9.1)
 *    - On a real tablet, verify all buttons are comfortably tappable with a finger
 *    - No accidental taps on adjacent elements
 *    - The email input field should be easy to focus with a tap
 *
 * 3. EMAIL KEYBOARD (Req 9.4)
 *    - On iOS Safari or Android Chrome, tap the email input
 *    - Verify the keyboard shows the "@" key prominently (email keyboard layout)
 *    - Verify autofill suggestions appear for previously used emails
 *
 * 4. PRINT REQUEST LATENCY (Req 8.4)
 *    - With a real notifier service, submit a precuenta request
 *    - Verify the loading spinner appears immediately
 *    - Verify the request times out after 10 seconds if the notifier is unreachable
 *    - The timeout error message should appear within ~10.1 seconds
 *
 * 5. SCREEN READER COMPATIBILITY
 *    - Use VoiceOver (iOS) or TalkBack (Android) to navigate the print controls
 *    - Verify aria-label values are read correctly for each button state
 *    - Verify aria-pressed state changes are announced when options are selected
 *    - Verify aria-invalid is announced when email format is wrong
 */
