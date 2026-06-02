import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runEmailAssistant } from '@/lib/agents'
import { Thread } from '@/types'
import { parseBody, agentMessageSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const parsed = await parseBody(request, agentMessageSchema)
  if (!parsed.ok) return parsed.response
  const { message, thread, threadId, history } = parsed.data

  // Build thread context — accept full thread object or threadId for mock data
  let threadData: Thread | null = null
  if (thread) {
    threadData = thread as unknown as Thread
  } else if (threadId) {
    // Fall back to mock data for demo mode
    const { mockThreads } = await import('@/data/emails')
    threadData = mockThreads.find((t) => t.id === threadId) ?? null
  }

  try {
    const result = await runEmailAssistant(
      message,
      threadData,
      session?.accessToken ?? null,
      history ?? []
    )
    return NextResponse.json(result)
  } catch (error) {
    console.error('Agent chat error:', error)
    return NextResponse.json({
      reply: 'Sorry, something went wrong. Please try again.',
      steps: [],
    })
  }
}
