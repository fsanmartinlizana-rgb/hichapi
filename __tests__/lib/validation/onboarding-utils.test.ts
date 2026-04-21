import { describe, it, expect } from 'vitest'

// ── Utility functions to test ─────────────────────────────────────────────────
// These mirror the implementations in the register page and API route

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, '-')             // Spaces to hyphens
    .replace(/[^a-z0-9-]/g, '')       // Remove special chars
    .replace(/-+/g, '-')              // Collapse multiple hyphens
    .replace(/^-|-$/g, '')            // Trim hyphens
}

const RULES = [
  { label: 'Al menos 12 caracteres',     test: (p: string) => p.length >= 12 },
  { label: 'Al menos un número',         test: (p: string) => /\d/.test(p) },
  { label: 'Al menos una mayúscula',     test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Al menos un símbolo (!@#$)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

function passwordsMatch(password: string, confirm: string): boolean {
  return password === confirm && confirm.length > 0
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('toSlug', () => {
  it('should convert basic restaurant name to slug', () => {
    expect(toSlug('El Rincón de Don José')).toBe('el-rincon-de-don-jose')
  })

  it('should remove accents from characters', () => {
    expect(toSlug('Café')).toBe('cafe')
    expect(toSlug('Niño')).toBe('nino')
    expect(toSlug('Peña')).toBe('pena')
    expect(toSlug('Corazón')).toBe('corazon')
  })

  it('should convert spaces to hyphens', () => {
    expect(toSlug('Pizza Palace')).toBe('pizza-palace')
    expect(toSlug('La Casa del Taco')).toBe('la-casa-del-taco')
  })

  it('should remove special characters', () => {
    expect(toSlug('Restaurant & Grill!')).toBe('restaurant-grill')
    expect(toSlug('Café @ 123')).toBe('cafe-123')
    expect(toSlug('Pizza (Italiana)')).toBe('pizza-italiana')
  })

  it('should collapse multiple hyphens', () => {
    expect(toSlug('Pizza   Palace')).toBe('pizza-palace')
    expect(toSlug('A - B - C')).toBe('a-b-c')
  })

  it('should trim leading and trailing hyphens', () => {
    expect(toSlug('-Restaurant-')).toBe('restaurant')
    expect(toSlug('!@#Restaurant#@!')).toBe('restaurant')
  })

  it('should handle empty string', () => {
    expect(toSlug('')).toBe('')
  })

  it('should handle very long names', () => {
    const longName = 'A'.repeat(200)
    const result = toSlug(longName)
    expect(result).toBe('a'.repeat(200))
  })

  it('should handle all special characters input', () => {
    expect(toSlug('!@#$%^&*()')).toBe('')
    expect(toSlug('---')).toBe('')
  })

  it('should handle mixed case with numbers', () => {
    expect(toSlug('Restaurant 123 ABC')).toBe('restaurant-123-abc')
  })
})

describe('Password Rules', () => {
  describe('Rule 1: At least 12 characters', () => {
    const rule = RULES[0]

    it('should pass for passwords with 12 or more characters', () => {
      expect(rule.test('123456789012')).toBe(true)
      expect(rule.test('verylongpassword')).toBe(true)
    })

    it('should fail for passwords with less than 12 characters', () => {
      expect(rule.test('short')).toBe(false)
      expect(rule.test('12345678901')).toBe(false) // 11 chars
    })

    it('should fail for empty password', () => {
      expect(rule.test('')).toBe(false)
    })
  })

  describe('Rule 2: At least one number', () => {
    const rule = RULES[1]

    it('should pass for passwords containing numbers', () => {
      expect(rule.test('password1')).toBe(true)
      expect(rule.test('123abc')).toBe(true)
      expect(rule.test('a1b2c3')).toBe(true)
    })

    it('should fail for passwords without numbers', () => {
      expect(rule.test('password')).toBe(false)
      expect(rule.test('ABCDEF')).toBe(false)
      expect(rule.test('!@#$%^')).toBe(false)
    })

    it('should fail for empty password', () => {
      expect(rule.test('')).toBe(false)
    })
  })

  describe('Rule 3: At least one uppercase letter', () => {
    const rule = RULES[2]

    it('should pass for passwords containing uppercase letters', () => {
      expect(rule.test('Password')).toBe(true)
      expect(rule.test('ABC123')).toBe(true)
      expect(rule.test('myPasswordA')).toBe(true)
    })

    it('should fail for passwords without uppercase letters', () => {
      expect(rule.test('password')).toBe(false)
      expect(rule.test('123456')).toBe(false)
      expect(rule.test('!@#$%^')).toBe(false)
    })

    it('should fail for empty password', () => {
      expect(rule.test('')).toBe(false)
    })
  })

  describe('Rule 4: At least one symbol', () => {
    const rule = RULES[3]

    it('should pass for passwords containing symbols', () => {
      expect(rule.test('password!')).toBe(true)
      expect(rule.test('test@123')).toBe(true)
      expect(rule.test('my#password')).toBe(true)
      expect(rule.test('pass$word')).toBe(true)
      expect(rule.test('test%123')).toBe(true)
      expect(rule.test('pass^word')).toBe(true)
      expect(rule.test('test&123')).toBe(true)
      expect(rule.test('pass*word')).toBe(true)
      expect(rule.test('test(123)')).toBe(true)
      expect(rule.test('pass,word')).toBe(true)
      expect(rule.test('test.123')).toBe(true)
      expect(rule.test('pass?word')).toBe(true)
      expect(rule.test('test"123')).toBe(true)
      expect(rule.test('pass:word')).toBe(true)
      expect(rule.test('test{123}')).toBe(true)
      expect(rule.test('pass|word')).toBe(true)
      expect(rule.test('test<123>')).toBe(true)
    })

    it('should fail for passwords without symbols', () => {
      expect(rule.test('password')).toBe(false)
      expect(rule.test('Password123')).toBe(false)
      expect(rule.test('ABCDEF123')).toBe(false)
    })

    it('should fail for empty password', () => {
      expect(rule.test('')).toBe(false)
    })
  })

  describe('All rules combined', () => {
    it('should pass when all rules are satisfied', () => {
      const password = 'MySecurePass123!'
      expect(RULES.every(rule => rule.test(password))).toBe(true)
    })

    it('should fail when no rules are satisfied', () => {
      const password = 'short'
      expect(RULES.every(rule => rule.test(password))).toBe(false)
    })

    it('should fail when only some rules are satisfied', () => {
      const password = 'verylongpassword' // Only satisfies length rule
      expect(RULES.every(rule => rule.test(password))).toBe(false)
    })

    it('should correctly count satisfied rules', () => {
      const password = 'MyPassword123!' // All 4 rules
      const passedCount = RULES.filter(rule => rule.test(password)).length
      expect(passedCount).toBe(4)

      const weakPassword = 'short' // 0 rules
      const weakPassedCount = RULES.filter(rule => rule.test(weakPassword)).length
      expect(weakPassedCount).toBe(0)

      const mediumPassword = 'verylongpassword123' // 2 rules (length + number)
      const mediumPassedCount = RULES.filter(rule => rule.test(mediumPassword)).length
      expect(mediumPassedCount).toBe(2)
    })
  })
})

describe('passwordsMatch', () => {
  it('should return true when passwords match and confirm is not empty', () => {
    expect(passwordsMatch('password123', 'password123')).toBe(true)
    expect(passwordsMatch('MySecurePass!', 'MySecurePass!')).toBe(true)
  })

  it('should return false when passwords do not match', () => {
    expect(passwordsMatch('password123', 'password456')).toBe(false)
    expect(passwordsMatch('MyPass', 'MyPassword')).toBe(false)
  })

  it('should return false when confirm password is empty', () => {
    expect(passwordsMatch('password123', '')).toBe(false)
  })

  it('should return false when both passwords are empty', () => {
    expect(passwordsMatch('', '')).toBe(false)
  })

  it('should return false when original password is empty but confirm is not', () => {
    expect(passwordsMatch('', 'password')).toBe(false)
  })

  it('should handle special characters and spaces', () => {
    expect(passwordsMatch('My Pass 123!', 'My Pass 123!')).toBe(true)
    expect(passwordsMatch('My Pass 123!', 'My Pass 123')).toBe(false)
  })
})