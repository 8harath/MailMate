import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkRateLimit } from '../lib/rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Clear module-level store between tests by advancing time
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows the first request', () => {
    const result = checkRateLimit('user1:test-route', { limit: 5, windowMs: 60_000 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('allows requests up to the limit', () => {
    const key = 'user2:test-route'
    const config = { limit: 3, windowMs: 60_000 }
    checkRateLimit(key, config)
    checkRateLimit(key, config)
    const third = checkRateLimit(key, config)
    expect(third.allowed).toBe(true)
    expect(third.remaining).toBe(0)
  })

  it('blocks requests beyond the limit', () => {
    const key = 'user3:test-route'
    const config = { limit: 2, windowMs: 60_000 }
    checkRateLimit(key, config)
    checkRateLimit(key, config)
    const third = checkRateLimit(key, config)
    expect(third.allowed).toBe(false)
    expect(third.remaining).toBe(0)
  })

  it('resets after the window expires', () => {
    const key = 'user4:test-route'
    const config = { limit: 1, windowMs: 60_000 }
    checkRateLimit(key, config)
    const blocked = checkRateLimit(key, config)
    expect(blocked.allowed).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(61_000)
    const afterReset = checkRateLimit(key, config)
    expect(afterReset.allowed).toBe(true)
  })

  it('tracks different keys independently', () => {
    const config = { limit: 1, windowMs: 60_000 }
    const a = checkRateLimit('userA:route', config)
    const b = checkRateLimit('userB:route', config)
    expect(a.allowed).toBe(true)
    expect(b.allowed).toBe(true)
  })
})
