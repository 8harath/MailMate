interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Prune entries older than 1 hour to prevent memory leaks
function pruneStore() {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}

let pruneTimer: ReturnType<typeof setInterval> | null = null
if (typeof globalThis !== 'undefined' && !pruneTimer) {
  pruneTimer = setInterval(pruneStore, 60_000)
}

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number
  /** Window duration in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check and increment rate limit for a given key.
 * key should be something like `${userId}:${route}` or `${ip}:${route}`.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // Fresh window
    const resetAt = now + config.windowMs
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: config.limit - 1, resetAt }
  }

  if (entry.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count += 1
  return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt }
}

// Preset configs for different route tiers
export const RATE_LIMITS = {
  /** AI analysis: 20 requests per minute per user */
  analysis: { limit: 20, windowMs: 60_000 },
  /** Agent / orchestrator: 15 requests per minute per user */
  agent: { limit: 15, windowMs: 60_000 },
  /** Text rewrite: 30 requests per minute per user */
  rewrite: { limit: 30, windowMs: 60_000 },
  /** Automation: 10 requests per minute per user */
  automation: { limit: 10, windowMs: 60_000 },
  /** Gmail send: 10 per minute per user */
  send: { limit: 10, windowMs: 60_000 },
} as const
