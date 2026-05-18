/**
 * Unit tests for utils/formatters.ts
 * Covers formatCLP, formatDate, formatTime, and formatRelativeTime.
 */

import { formatCLP, formatDate, formatTime, formatRelativeTime } from '../../utils/formatters';

// ---------------------------------------------------------------------------
// formatCLP
// ---------------------------------------------------------------------------

describe('formatCLP', () => {
  describe('zero', () => {
    it('formats 0 as "$0"', () => {
      expect(formatCLP(0)).toBe('$0');
    });
  });

  describe('positive numbers', () => {
    it('formats 1000 as "$1.000"', () => {
      expect(formatCLP(1000)).toBe('$1.000');
    });

    it('formats 15000 as "$15.000"', () => {
      expect(formatCLP(15000)).toBe('$15.000');
    });

    it('formats 100000 as "$100.000"', () => {
      expect(formatCLP(100000)).toBe('$100.000');
    });

    it('formats 1000000 as "$1.000.000"', () => {
      expect(formatCLP(1000000)).toBe('$1.000.000');
    });

    it('formats 999 (no thousands separator) as "$999"', () => {
      expect(formatCLP(999)).toBe('$999');
    });

    it('formats 1 as "$1"', () => {
      expect(formatCLP(1)).toBe('$1');
    });

    it('formats 9999999 as "$9.999.999"', () => {
      expect(formatCLP(9999999)).toBe('$9.999.999');
    });
  });

  describe('negative numbers', () => {
    it('formats -5000 as "-$5.000"', () => {
      expect(formatCLP(-5000)).toBe('-$5.000');
    });

    it('formats -1 as "-$1"', () => {
      expect(formatCLP(-1)).toBe('-$1');
    });

    it('formats -1000000 as "-$1.000.000"', () => {
      expect(formatCLP(-1000000)).toBe('-$1.000.000');
    });
  });

  describe('decimal inputs (rounds to integer)', () => {
    it('rounds 15000.9 to "$15.001"', () => {
      expect(formatCLP(15000.9)).toBe('$15.001');
    });

    it('rounds 15000.4 to "$15.000"', () => {
      expect(formatCLP(15000.4)).toBe('$15.000');
    });

    it('rounds -5000.5 to "-$5.001"', () => {
      expect(formatCLP(-5000.5)).toBe('-$5.001');
    });
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('formats "2025-01-15T12:00:00Z" as "15/01/2025"', () => {
    // Use a fixed local date to avoid timezone issues in tests
    const date = new Date(2025, 0, 15, 12, 0, 0); // Jan 15, 2025 local time
    expect(formatDate(date.toISOString())).toBe('15/01/2025');
  });

  it('pads single-digit day and month with leading zeros', () => {
    const date = new Date(2025, 2, 5, 10, 0, 0); // Mar 5, 2025
    expect(formatDate(date.toISOString())).toBe('05/03/2025');
  });

  it('formats December 31 correctly', () => {
    const date = new Date(2025, 11, 31, 23, 59, 0); // Dec 31, 2025
    expect(formatDate(date.toISOString())).toBe('31/12/2025');
  });
});

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------

describe('formatTime', () => {
  it('formats time with leading zeros for single-digit hours and minutes', () => {
    const date = new Date(2025, 0, 15, 9, 5, 0); // 09:05
    expect(formatTime(date.toISOString())).toBe('09:05');
  });

  it('formats midnight as "00:00"', () => {
    const date = new Date(2025, 0, 15, 0, 0, 0);
    expect(formatTime(date.toISOString())).toBe('00:00');
  });

  it('formats 23:59 correctly', () => {
    const date = new Date(2025, 0, 15, 23, 59, 0);
    expect(formatTime(date.toISOString())).toBe('23:59');
  });
});

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

describe('formatRelativeTime', () => {
  it('returns "hace X segundos" for times less than 60 seconds ago', () => {
    const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('hace 30 segundos');
  });

  it('returns "hace 1 segundo" (singular) for 1 second ago', () => {
    const oneSecondAgo = new Date(Date.now() - 1_000).toISOString();
    expect(formatRelativeTime(oneSecondAgo)).toBe('hace 1 segundo');
  });

  it('returns "hace X minutos" for times between 1 and 59 minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('hace 5 minutos');
  });

  it('returns "hace 1 minuto" (singular) for 1 minute ago', () => {
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    expect(formatRelativeTime(oneMinuteAgo)).toBe('hace 1 minuto');
  });

  it('returns "hace X horas" for times between 1 and 23 hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe('hace 3 horas');
  });

  it('returns "hace 1 hora" (singular) for 1 hour ago', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    expect(formatRelativeTime(oneHourAgo)).toBe('hace 1 hora');
  });

  it('returns "hace X días" for times more than 24 hours ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(twoDaysAgo)).toBe('hace 2 días');
  });

  it('returns "hace 1 día" (singular) for 1 day ago', () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(oneDayAgo)).toBe('hace 1 día');
  });
});
