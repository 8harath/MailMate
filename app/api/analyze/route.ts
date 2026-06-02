import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { comprehensiveAnalyze } from '@/lib/groq'
import { mockThreads } from '@/data/emails'
import { Thread } from '@/types'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { parseBody, analyzeSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  // Rate limit: authenticated users by email, anonymous by route
  const session = await getServerSession(authOptions)
  const rateLimitKey = session?.user?.email
    ? `${session.user.email}:/api/analyze`
    : `anon:/api/analyze`
  const rl = checkRateLimit(rateLimitKey, RATE_LIMITS.analysis)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many analysis requests. Please wait before retrying.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  const parsed = await parseBody(request, analyzeSchema)
  if (!parsed.ok) return parsed.response
  const { threadId, thread: inlineThread } = parsed.data

  let thread: Thread | undefined
  if (inlineThread) {
    thread = inlineThread as unknown as Thread
  } else if (threadId) {
    thread = mockThreads.find((t) => t.id === threadId)
  }

  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  try {
    const analysis = await comprehensiveAnalyze(thread)
    return NextResponse.json(analysis)
  } catch (error) {
    console.error('[analyze] error:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: 'Analysis failed. Check your GROQ_API_KEY.' },
      { status: 500 }
    )
  }
}
