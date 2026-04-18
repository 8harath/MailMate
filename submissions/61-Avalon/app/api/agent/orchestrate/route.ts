/**
 * POST /api/agent/orchestrate
 *
 * Main coordinator endpoint. Classifies user intent, routes to the correct
 * LangGraph sub-graph (triage / scheduling / general email help / simple
 * Q&A), synthesises a unified reply, and returns delegations + stored memories.
 *
 * When AGENT_SERVICE_URL is set, the request is forwarded to the Python
 * agent-service which runs the full LangGraph coordinator (Postgres-checkpointed,
 * horizontally scalable). Otherwise the in-process Vercel AI SDK coordinator
 * runs as a fallback (suitable for Vercel deploy / dev without sidecar).
 *
 * Body: { message, thread?, threadId?, history? }
 * Returns: CoordinatorResult shape expected by the inbox AI chat panel
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Thread } from '@/types'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  // Rate-limit by authenticated email, anonymous by route prefix
  const rateLimitKey = session?.user?.email
    ? `${session.user.email}:/api/agent/orchestrate`
    : `anon:/api/agent/orchestrate`
  const rl = await checkRateLimit(rateLimitKey, RATE_LIMITS.agent)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before sending another message.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  const { message, thread, threadId, history } = await request.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  // Resolve thread: inline object takes precedence over threadId lookup (demo mode)
  let threadData: Thread | null = null
  if (thread && thread.id && Array.isArray(thread.emails)) {
    threadData = thread as Thread
  } else if (typeof threadId === 'string') {
    const { mockThreads } = await import('@/data/emails')
    threadData = mockThreads.find((t) => t.id === threadId) ?? null
  }

  try {
    // ── LangGraph agent-service path (full enterprise mode) ──────────────────
    if (process.env.AGENT_SERVICE_URL && session?.user?.email) {
      const { callCoordinator } = await import('@/lib/agent-client')
      const result = await callCoordinator({
        message,
        thread: threadData,
        history: history ?? [],
        userId: session.user.email,
        accessToken: session.accessToken ?? undefined,
      })
      // Translate to the CoordinatorResult shape the inbox panel expects
      return NextResponse.json({
        reply: result.reply ?? '',
        steps: result.steps ?? [],
        delegations: result.delegations ?? [],
        memoriesUsed: result.memories_used ?? [],
        memoriesStored: result.memories_stored ?? [],
      })
    }

    // ── In-process fallback path (Vercel / demo / no sidecar) ───────────────
    if (session?.accessToken && session?.user?.email) {
      const { runCoordinator } = await import('@/lib/coordinator')
      const result = await runCoordinator(
        message,
        threadData,
        session.accessToken,
        session.user.email,
        history ?? []
      )
      return NextResponse.json(result)
    }

    // Demo mode: no auth, no memory, no delegation to sub-agents
    const { runEmailAssistant } = await import('@/lib/agents')
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
