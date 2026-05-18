/**
 * Error logging utility for HiChapi Mobile App.
 * Logs to console in development and to a remote service (Sentry-compatible) in production.
 * Rate-limited to a maximum of 10 errors per minute to prevent log flooding.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorContext {
  userId?: string;
  restaurantId?: string;
  screen?: string;
  action?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------

const MAX_ERRORS_PER_MINUTE = 10;
let errorCount = 0;
let windowStart = Date.now();

function isRateLimited(): boolean {
  const now = Date.now();
  // Reset counter every 60 seconds
  if (now - windowStart >= 60_000) {
    errorCount = 0;
    windowStart = now;
  }
  if (errorCount >= MAX_ERRORS_PER_MINUTE) {
    return true;
  }
  errorCount++;
  return false;
}

// ---------------------------------------------------------------------------
// Remote logging stub (Sentry-compatible interface)
// ---------------------------------------------------------------------------

interface RemoteLogger {
  captureException(error: Error, context?: ErrorContext): void;
  captureMessage(message: string, level: 'warning' | 'info', context?: ErrorContext): void;
}

/**
 * Stub remote logger. Replace with actual Sentry integration:
 * import * as Sentry from '@sentry/react-native';
 */
const remoteLogger: RemoteLogger = {
  captureException(error: Error, context?: ErrorContext): void {
    // TODO: Replace with Sentry.captureException(error, { extra: context });
    if (__DEV__) {
      console.debug('[RemoteLogger] captureException stub called', error.message, context);
    }
  },
  captureMessage(message: string, level: 'warning' | 'info', context?: ErrorContext): void {
    // TODO: Replace with Sentry.captureMessage(message, { level, extra: context });
    if (__DEV__) {
      console.debug('[RemoteLogger] captureMessage stub called', level, message, context);
    }
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Logs an error to console (dev) and remote service (prod).
 * Rate-limited to max 10 errors per minute.
 *
 * @param error - The error to log (Error instance or unknown thrown value)
 * @param context - Optional context metadata (userId, screen, action, etc.)
 */
export function logError(error: Error | unknown, context?: ErrorContext): void {
  const err = error instanceof Error ? error : new Error(String(error));

  if (__DEV__) {
    console.error('[HiChapi Error]', err.message, context ?? '', err.stack);
  }

  if (isRateLimited()) {
    if (__DEV__) {
      console.warn('[errorLogger] Rate limit reached — error suppressed');
    }
    return;
  }

  remoteLogger.captureException(err, context);
}

/**
 * Logs a warning (non-fatal) to console and remote service.
 *
 * @param message - Warning message
 * @param context - Optional context metadata
 */
export function logWarning(message: string, context?: ErrorContext): void {
  if (__DEV__) {
    console.warn('[HiChapi Warning]', message, context ?? '');
  }

  remoteLogger.captureMessage(message, 'warning', context);
}

/**
 * Logs an informational event (e.g. for analytics or debugging).
 *
 * @param message - Info message
 * @param context - Optional context metadata
 */
export function logInfo(message: string, context?: ErrorContext): void {
  if (__DEV__) {
    console.info('[HiChapi Info]', message, context ?? '');
  }

  remoteLogger.captureMessage(message, 'info', context);
}
