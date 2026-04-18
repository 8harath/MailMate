/**
 * POST /api/agent/schedule
 *
 * Runs the scheduling agent for a given email thread.
 * Extracts meeting requests, checks calendar for conflicts, and proposes
 * time slots. When a calendar event creation is proposed and
 * AGENT_SERVICE_URL is set, the LangGraph graph uses interrupt() to pause
 * for human-in-the-loop approval before creating the event.
 *
 * Body: { thread: Thread }
 * Returns: { reply: string, steps: AgentStep[], run_id?: string, status?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Thread } from '@/types'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken || !session?.user?.email) {
    return NextResponse.json(
      { error: 'Sign in with Google to use the scheduling agent.' },
      { status: 401 }
    )
  }

  const { thread } = await request.json()
  if (!thread?.id || !Array.isArray(thread?.emails)) {
    return NextResponse.json({ error: 'Thread data is required.' }, { status: 400 })
  }

  try {
    // Route to LangGraph agent-service for HITL-capable scheduling
    if (process.env.AGENT_SERVICE_URL) {
      const { callScheduling } = await import('@/lib/agent-client')
      const result = await callScheduling({
        thread,
        userId: session.user.email,
        accessToken: session.accessToken,
      })
      // Expose run_id and status so the client can poll/resume interrupted runs
      return NextResponse.json({
        reply: result.reply ?? '',
        steps: result.steps ?? [],
        run_id: result.run_id,
        status: result.status,
        interrupt_data: result.interrupt_data,
      })
    }

    // In-process fallback (no HITL support)
    const { runSchedulingAgent } = await import('@/lib/agents')
    const result = await runSchedulingAgent(thread as Thread, session.accessToken)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Scheduling agent error:', error)
    return NextResponse.json({ error: 'Scheduling failed. Please try again.' }, { status: 500 })
  }
}
