import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { checkRateLimit, RateLimitConfig } from './rate-limit'

export interface GuardedSession {
  accessToken: string
  userId: string
  email: string
}

interface GuardOptions {
  /** Require Gmail access token (defaults to true) */
  requireAccessToken?: boolean
  /** Rate limit config to apply — keyed per user email */
  rateLimit?: RateLimitConfig
}

type GuardSuccess = { ok: true; session: GuardedSession; userId: string }
type GuardFailure = { ok: false; response: NextResponse }
type GuardResult = GuardSuccess | GuardFailure

/**
 * Validates authentication and optional rate limiting for an API route.
 * Returns either a typed session or a ready-to-return error response.
 */
export async function guardRoute(
  request: NextRequest,
  options: GuardOptions = {}
): Promise<GuardResult> {
  const { requireAccessToken = true, rateLimit } = options

  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }),
    }
  }

  if (requireAccessToken && !session.accessToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Gmail access token required. Please sign in again.' },
        { status: 401 }
      ),
    }
  }

  if (rateLimit) {
    const key = `${session.user.email}:${request.nextUrl.pathname}`
    const result = await checkRateLimit(key, rateLimit)
    if (!result.allowed) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Too many requests. Please slow down.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
              'X-RateLimit-Reset': String(result.resetAt),
            },
          }
        ),
      }
    }
  }

  return {
    ok: true,
    session: {
      accessToken: session.accessToken as string,
      userId: session.userId as string,
      email: session.user.email,
    },
    userId: session.user.email,
  }
}
