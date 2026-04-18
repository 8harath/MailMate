/**
 * POST /api/agent/resume
 *
 * Resumes a LangGraph run that was paused at a human-in-the-loop interrupt()
 * node (e.g. scheduling agent waiting for calendar event approval, or the
 * automation graph waiting for approval of a risky action).
 *
 * The client POSTs the run_id obtained from the interrupted response, plus
 * the resume_value (e.g. { approved: true/false }). This route forwards the
 * request to the Python agent-service /v1/resume endpoint which calls
 * graph.invoke(Command(resume=...), config=...) to continue execution from
 * the checkpoint.
 *
 * Body: { run_id: string, resume_value: Record<string, unknown> }
 * Returns: AgentResponse (status: "completed", reply: string)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  // Agent-service required for HITL resume (in-process fallback has no checkpoints)
  if (!process.env.AGENT_SERVICE_URL) {
    return NextResponse.json(
      { error: 'Agent service not configured. HITL resume is unavailable.' },
      { status: 503 }
    )
  }

  const body = await request.json()
  const { run_id, resume_value } = body

  if (!run_id || typeof run_id !== 'string') {
    return NextResponse.json({ error: 'run_id is required.' }, { status: 400 })
  }
  if (!resume_value || typeof resume_value !== 'object') {
    return NextResponse.json({ error: 'resume_value must be an object.' }, { status: 400 })
  }

  try {
    const { resumeRun } = await import('@/lib/agent-client')
    const result = await resumeRun({
      runId: run_id,
      resumeValue: resume_value,
      userId: session.user.email,
    })
    return NextResponse.json({
      reply: result.reply ?? '',
      steps: result.steps ?? [],
      run_id: result.run_id,
      status: result.status,
    })
  } catch (error) {
    console.error('[agent/resume] error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Resume failed. Please try again.' }, { status: 500 })
  }
}
