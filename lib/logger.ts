// ── Structured logger for API routes ────────────────────────────────────────
// Outputs structured JSON for easy parsing by log aggregators (Vercel, Datadog, etc.)

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  route?: string
  method?: string
  status?: number
  duration_ms?: number
  restaurant_id?: string
  user_id?: string
  ip?: string
  error?: string
  meta?: Record<string, unknown>
}

function log(entry: LogEntry) {
  const output = JSON.stringify(entry)

  switch (entry.level) {
    case 'error':
      console.error(output)
      break
    case 'warn':
      console.warn(output)
      break
    case 'debug':
      if (process.env.NODE_ENV === 'development') console.log(output)
      break
    default:
      console.log(output)
  }
}

export const logger = {
  info: (message: string, meta?: Partial<LogEntry>) =>
    log({ level: 'info', message, timestamp: new Date().toISOString(), ...meta }),

  warn: (message: string, meta?: Partial<LogEntry>) =>
    log({ level: 'warn', message, timestamp: new Date().toISOString(), ...meta }),

  error: (message: string, meta?: Partial<LogEntry>) =>
    log({ level: 'error', message, timestamp: new Date().toISOString(), ...meta }),

  debug: (message: string, meta?: Partial<LogEntry>) =>
    log({ level: 'debug', message, timestamp: new Date().toISOString(), ...meta }),

  /** Log an API request with timing */
  apiRequest: (opts: {
    route: string
    method: string
    status: number
    duration_ms: number
    ip?: string
    restaurant_id?: string
    user_id?: string
    error?: string
  }) => {
    const level: LogLevel = opts.status >= 500 ? 'error' : opts.status >= 400 ? 'warn' : 'info'
    log({
      level,
      message: `${opts.method} ${opts.route} ${opts.status} (${opts.duration_ms}ms)`,
      timestamp: new Date().toISOString(),
      ...opts,
    })
  },
}
