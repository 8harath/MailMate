/**
 * POST /api/agent/triage
 *
 * Runs the inbox triage agent. When AGENT_SERVICE_URL is configured the
 * request is forwarded to the LangGraph Python agent-service (callTriage).
 * Without it the legacy Vercel-AI-SDK runTriageAgent runs in-process.
 *
 * Requires a live Google OAuth session (access token used to read Gmail).
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken || !session?.user?.email) {
    return NextResponse.json(
      { error: 'Sign in with Google to use inbox triage.' },
      { status: 401 }
    )
  }

  try {
    // Route to LangGraph agent-service when available; fall back to in-process
    if (process.env.AGENT_SERVICE_URL) {
      const { callTriage } = await import('@/lib/agent-client')
      const result = await callTriage({
        userId: session.user.email,
        accessToken: session.accessToken,
      })
      // Normalise response shape to match the original { summary, steps } contract
      return NextResponse.json({ summary: result.reply ?? '', steps: result.steps ?? [] })
    }

    // In-process fallback (Vercel / dev without sidecar)
    const { runTriageAgent } = await import('@/lib/agents')
    const result = await runTriageAgent(session.accessToken)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Triage agent error:', error)
    return NextResponse.json(
      { error: 'Triage failed. Please try again.' },
      { status: 500 }
    )
  }
}
