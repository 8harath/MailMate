/**
 * Minimal structured logger.
 *
 * Wraps `console` so call sites have a single, consistent entry point that can
 * later be pointed at a real log drain (Datadog, Logtail, Sentry, …) without
 * touching every file. In production, debug/info lines are suppressed; warn and
 * error always emit so platform log collectors capture them.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

const isProduction = process.env.NODE_ENV === 'production'

function emit(level: Level, scope: string, message: string, meta?: unknown) {
  const prefix = scope ? `[${scope}]` : ''
  const args: unknown[] = meta === undefined ? [`${prefix} ${message}`.trim()] : [`${prefix} ${message}`.trim(), meta]

  switch (level) {
    case 'error':
      console.error(...args)
      break
    case 'warn':
      console.warn(...args)
      break
    default:
      if (!isProduction) console.log(...args)
  }
}

export interface Logger {
  debug(message: string, meta?: unknown): void
  info(message: string, meta?: unknown): void
  warn(message: string, meta?: unknown): void
  error(message: string, meta?: unknown): void
}

/** Create a logger bound to a scope, e.g. `createLogger('supabase')`. */
export function createLogger(scope = ''): Logger {
  return {
    debug: (message, meta) => emit('debug', scope, message, meta),
    info: (message, meta) => emit('info', scope, message, meta),
    warn: (message, meta) => emit('warn', scope, message, meta),
    error: (message, meta) => emit('error', scope, message, meta),
  }
}

export const logger = createLogger()
