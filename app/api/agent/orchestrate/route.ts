import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runCoordinator } from '@/lib/coordinator'
import { runEmailAssistant } from '@/lib/agents'
import { Thread } from '@/types'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { parseBody, agentMessageSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  const rateLimitKey = session?.user?.email
    ? `${session.user.email}:/api/agent/orchestrate`
    : `anon:/api/agent/orchestrate`
  const rl = checkRateLimit(rateLimitKey, RATE_LIMITS.agent)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before sending another message.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  const parsed = await parseBody(request, agentMessageSchema)
  if (!parsed.ok) return parsed.response
  const { message, thread, threadId, history } = parsed.data

  let threadData: Thread | null = null
  if (thread) {
    threadData = thread as unknown as Thread
  } else if (threadId) {
    const { mockThreads } = await import('@/data/emails')
    threadData = mockThreads.find((t) => t.id === threadId) ?? null
  }

  try {
    if (session?.accessToken && session?.user?.email) {
      const userId = session.user.email
      const result = await runCoordinator(
        message,
        threadData,
        session.accessToken,
        userId,
        history ?? []
      )
      return NextResponse.json(result)
    }

    // Demo mode: no memory, no delegation
    const result = await runEmailAssistant(message, threadData, null, history ?? [])
    return NextResponse.json({
      ...result,
      delegations: [],
      memoriesUsed: [],
      memoriesStored: [],
    })
  } catch (error) {
    console.error('[orchestrate] error:', error instanceof Error ? error.message : error)
    return NextResponse.json({
      reply: 'Sorry, something went wrong. Please try again.',
      steps: [],
      delegations: [],
      memoriesUsed: [],
      memoriesStored: [],
    })
  }
}
