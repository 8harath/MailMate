import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runEmailAssistant } from '@/lib/agents'
import { Thread } from '@/types'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const { message, thread, threadId, history } = await request.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  // Build thread context — accept full thread object or threadId for mock data
  let threadData: Thread | null = null
  if (thread && thread.id && thread.emails) {
    threadData = thread as Thread
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
