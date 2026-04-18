/**
 * Rate limiter — lib/rate-limit.ts
 *
 * ARCHITECTURE:
 * Two implementations are provided. The one that runs is determined at
 * runtime by whether REDIS_URL is set in the environment.
 *
 *   Redis path (production):
 *     Uses a sorted-set sliding-window algorithm implemented in a Lua script
 *     that executes atomically on the Redis server. Each request is recorded
 *     as a member of a sorted set keyed "rl:<key>" with score = timestamp.
 *     Old entries outside the window are pruned on every call (ZREMRANGEBYSCORE).
 *     Because the Lua script is atomic, there are no race conditions under
 *     concurrent requests from multiple web replicas.
 *
 *   In-memory fallback (dev / Vercel without Redis):
 *     A simple Map stores {count, resetAt} per key. A 60-second setInterval
 *     prunes expired entries to prevent unbounded growth. This is NOT safe
 *     for multi-replica deployments — use Redis in production.
 *
 * WHY SLIDING WINDOW vs FIXED WINDOW?
 *   Fixed windows allow a burst of 2× the limit at window boundaries (e.g.
 *   full quota at 00:59 + full quota at 01:00). Sliding windows prevent this
 *   by considering only the last windowMs milliseconds of requests.
 *
 * PUBLIC API (unchanged from original in-memory version):
 *   checkRateLimit(key, config) → Promise<RateLimitResult>
 *   RATE_LIMITS — preset configs for each route tier
 *
 * Key format convention: "<userId/ip>:<route>"
 *   e.g. "user@example.com:/api/analyze"
 *        "anon:/api/rewrite"
 */
import Redis from 'ioredis'

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  limit: number
  /** Sliding-window duration in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  /** Whether this request is permitted */
  allowed: boolean
  /** Requests remaining in the current window */
  remaining: number
  /** Unix millisecond timestamp when the window resets (used for Retry-After header) */
  resetAt: number
}

// ── Redis client (lazy singleton) ──────────────────────────────────────────────

let redis: Redis | null = null

/**
 * Returns a shared ioredis instance, creating it on first call.
 * Returns null when REDIS_URL is not set, triggering the in-memory fallback.
 * Errors from Redis (connection refused, etc.) are suppressed — the next call
 * to checkRateLimit will fall back to the in-memory implementation.
 */
function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false, // fail fast rather than queuing requests
    })
    // Suppress unhandled rejection; individual calls catch errors and fall back
    redis.on('error', () => {})
  }
  return redis
}

// ── In-memory fallback (single-instance only) ──────────────────────────────────

interface MemEntry { count: number; resetAt: number }
const memStore = new Map<string, MemEntry>()

// Prune expired entries every 60 seconds to prevent unbounded memory growth
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of memStore) if (v.resetAt < now) memStore.delete(k)
  }, 60_000)
}

/** Fixed-window in-memory check — simple but not multi-replica safe */
function memCheck(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = memStore.get(key)
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs
    memStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: config.limit - 1, resetAt }
  }
  if (entry.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }
  entry.count += 1
  return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt }
}

// ── Redis sliding-window Lua script ───────────────────────────────────────────

/**
 * Atomic sliding-window rate limiter implemented as a Redis Lua script.
 *
 * The script operates on a sorted set keyed "rl:<key>":
 *   1. Remove members older than now - windowMs (prune expired entries)
 *   2. Count remaining members (requests in current window)
 *   3. If count >= limit: return {blocked, 0, oldest_entry + window}
 *   4. Otherwise: add current timestamp as new member, set TTL, return {allowed, remaining}
 *
 * The random suffix in the member value ensures multiple requests within the
 * same millisecond don't overwrite each other (sorted sets deduplicate by member).
 *
 * KEYS[1] = "rl:<key>"
 * ARGV[1] = current timestamp (ms)
 * ARGV[2] = window duration (ms)
 * ARGV[3] = limit (max requests)
 * Returns: [allowed (0/1), remaining, resetAt (ms)]
 */
const SLIDING_WINDOW_LUA = `
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
local expire = math.ceil(window / 1000)

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = tonumber(redis.call('ZCARD', key))

if count >= limit then
  local oldest = tonumber(redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')[2]) or now
  return {0, 0, oldest + window}
end

redis.call('ZADD', key, now, now .. '-' .. math.random(1e9))
redis.call('EXPIRE', key, expire)
return {1, limit - count - 1, now + window}
`

/** Executes the Lua script on Redis; falls back to memCheck on any Redis error */
async function redisCheck(
  r: Redis,
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now()
  try {
    const res = (await r.eval(
      SLIDING_WINDOW_LUA,
      1,
      `rl:${key}`,
      now,
      config.windowMs,
      config.limit
    )) as [number, number, number]
    return { allowed: res[0] === 1, remaining: res[1], resetAt: res[2] }
  } catch {
    // Redis unavailable — degrade gracefully to in-memory check
    return memCheck(key, config)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check and increment the rate limit for the given key.
 * Always returns a Promise — callers must await the result.
 *
 * @param key    Unique identifier: "<userId>:<route>" or "anon:<route>"
 * @param config Limit and window from RATE_LIMITS or a custom config
 */
export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const r = getRedis()
  if (r) return redisCheck(r, key, config)
  return memCheck(key, config)
}

/**
 * Preset rate-limit configurations for each API tier.
 * Tuned for a typical single-user session — tighten in production if abused.
 */
export const RATE_LIMITS = {
  /** AI analysis: 20 per minute per user */
  analysis:   { limit: 20, windowMs: 60_000 },
  /** Agent / orchestrator chat: 15 per minute per user */
  agent:      { limit: 15, windowMs: 60_000 },
  /** Text rewrite: 30 per minute per user */
  rewrite:    { limit: 30, windowMs: 60_000 },
  /** Automation run: 10 per minute per user */
  automation: { limit: 10, windowMs: 60_000 },
  /** Gmail send: 10 per minute per user (matches Gmail's own abuse thresholds) */
  send:       { limit: 10, windowMs: 60_000 },
} as const
