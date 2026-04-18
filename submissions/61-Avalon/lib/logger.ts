/**
 * Structured logger — lib/logger.ts
 *
 * Wraps pino to provide consistent JSON structured logging across all
 * API routes and server-side lib functions.
 *
 * WHY PINO?
 *   - Fastest Node.js logger (uses worker threads for transport)
 *   - Outputs newline-delimited JSON — works with all log aggregators
 *     (Datadog, Loki, CloudWatch, Elastic) without parsing config
 *   - pino-pretty gives human-readable colourised output in development
 *   - 'redact' strips sensitive header values before they reach log storage
 *
 * LOG LEVELS:
 *   Development: "debug" — includes all query logs, tool calls, LLM steps
 *   Production:  "info"  — business events only, no verbose internals
 *   Override via LOG_LEVEL env var (e.g. LOG_LEVEL=warn for noisy periods)
 *
 * STRUCTURED FIELDS:
 *   Every log line includes service: "mailmate-web" so log queries can
 *   filter by service when multiple services write to the same aggregator.
 *
 * REDACTION:
 *   Authorization headers and cookies are redacted (replaced with "[Redacted]")
 *   before the log is written. This prevents OAuth tokens and session cookies
 *   from appearing in log storage, which is a common compliance requirement.
 *
 * CHILD LOGGERS:
 *   Use requestLogger(requestId) to create a child logger that automatically
 *   includes the request ID in every log line. This enables request-scoped
 *   log filtering in aggregators.
 *
 * USAGE:
 *   import { logger } from '@/lib/logger'
 *   logger.info({ userId, threadId }, 'analysis.started')
 *   logger.error({ error: err.message }, 'groq.call.failed')
 *
 *   // Request-scoped child logger:
 *   const log = requestLogger(requestId)
 *   log.info('rate_limit.checked')
 */
import pino from 'pino'

const isDev = process.env.NODE_ENV === 'development'

export const logger = pino({
  // Allow LOG_LEVEL override; default to debug in dev, info in prod
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),

  // In development: pretty-print with colour and human-readable timestamps
  // In production: raw JSON newline-delimited (no transport overhead)
  ...(isDev
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),

  // Service identifier on every log line — useful for multi-service log queries
  base: { service: 'mailmate-web' },

  // Redact sensitive header values before they reach the log output
  // "req.headers.authorization" covers OAuth Bearer tokens
  // "req.headers.cookie" covers NextAuth session cookies
  redact: ['req.headers.authorization', 'req.headers.cookie'],
})

/**
 * Creates a child logger that automatically includes the requestId on
 * every log line emitted within the scope of a single HTTP request.
 *
 * @param requestId  A unique request identifier (e.g. from X-Request-Id header)
 *
 * @example
 * const log = requestLogger(req.headers['x-request-id'] ?? crypto.randomUUID())
 * log.info({ userId }, 'request.started')
 * log.error({ error: err.message }, 'analysis.failed')
 */
export function requestLogger(requestId: string) {
  return logger.child({ requestId })
}
