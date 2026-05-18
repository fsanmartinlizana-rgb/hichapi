/**
 * Formatting utilities for HiChapi Mobile App.
 * Handles CLP currency, dates, times, and relative time strings in Spanish.
 */

/**
 * Formats a number as Chilean Pesos (CLP).
 * Uses period as thousands separator, no decimal places.
 *
 * @example
 * formatCLP(15000)  // "$15.000"
 * formatCLP(0)      // "$0"
 * formatCLP(-5000)  // "-$5.000"
 */
export function formatCLP(amount: number): string {
  const isNegative = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Formats an ISO 8601 date string to "DD/MM/YYYY".
 *
 * @example
 * formatDate("2025-01-15T12:00:00Z")  // "15/01/2025"
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formats an ISO 8601 date string to "HH:MM" (24-hour format).
 *
 * @example
 * formatTime("2025-01-15T14:30:00Z")  // "14:30"
 */
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Returns a human-readable relative time string in Spanish.
 * Compares the given ISO 8601 timestamp to the current time.
 *
 * @example
 * formatRelativeTime(recentIso)  // "hace 5 minutos"
 * formatRelativeTime(oldIso)     // "hace 3 días"
 */
export function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) {
    return `hace ${diffSeconds} segundo${diffSeconds !== 1 ? 's' : ''}`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `hace ${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
}
