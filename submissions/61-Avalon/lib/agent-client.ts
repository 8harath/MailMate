/**
 * Agent service HTTP client — lib/agent-client.ts
 *
 * PURPOSE:
 * Thin TypeScript wrapper around the Python FastAPI agent-service.
 * All API routes that need LangGraph capabilities import from here rather
 * than calling lib/agents.ts or lib/coordinator.ts directly.
 *
 * ROUTING STRATEGY:
 * When AGENT_SERVICE_URL is set (Docker / self-host), requests go to the
 * Python sidecar which runs full LangGraph StateGraphs with Postgres
 * checkpointing and human-in-the-loop interrupts.
 *
 * When AGENT_SERVICE_URL is absent (Vercel deploy / dev without Docker),
 * the API routes fall back to in-process Vercel AI SDK agents
 * (lib/agents.ts, lib/coordinator.ts). This fallback is handled in the
 * route files themselves — this module just provides the network calls.
 *
 * AUTHENTICATION:
 * Every request carries an X-Service-Token header with an HMAC-SHA256 signed
 * token. The signature is: HMAC(AGENT_SERVICE_TOKEN, unix_timestamp).
 * The agent-service verifies this and rejects tokens older than 60 seconds,
 * preventing replay attacks. If AGENT_SERVICE_TOKEN is not set, no header is
 * sent (auth is disabled — acceptable in local dev, not in production).
 *
 * TIMEOUT: 60 seconds per request (configurable via AbortSignal).
 *   Most agent calls complete in 3–15 seconds; 60s gives headroom for
 *   tool-heavy runs (multiple Gmail/Calendar API calls per step).
 *
 * ERROR HANDLING:
 * Non-2xx responses throw an Error with the HTTP status and body included.
 * The calling route is responsible for catching and returning 500/503.
 *
 * HUMAN-IN-THE-LOOP FLOW:
 *   1. callScheduling() or callCoordinator() returns { status: "interrupted", run_id, interrupt_data }
 *   2. The client shows the interrupt_data (e.g. "Confirm: create event at 3pm?") to the user
 *   3. The user approves/rejects → client POSTs to /api/agent/resume
 *   4. resumeRun() sends { run_id, resume_value: { approved: true/false } }
 *   5. The agent-service continues the graph from the checkpoint
 */
import crypto from 'crypto'

// ── Response types ─────────────────────────────────────────────────────────────

/** Standard response shape returned by all agent-service endpoints */
export interface AgentResponse {
  /** UUID assigned to this run (used for HITL resume) */
  run_id: string
  /** "completed" — run finished; "interrupted" — waiting for human approval */
  status: 'completed' | 'interrupted'
  /** Final text reply from the agent (null when interrupted) */
  reply?: string
  /** Payload shown to the user when status is "interrupted" */
  interrupt_data?: Record<string, unknown>
  /** List of sub-agent calls made by the coordinator */
  delegations: Array<{ agent: string; action: string; result: string }>
  /** Memories retrieved from the DB and injected into prompts */
  memories_used: unknown[]
  /** Memories newly stored during this run */
  memories_stored: Array<{ category: string; key: string; value: string }>
  /** Raw LangGraph step traces (useful for debugging) */
  steps: unknown[]
}

// ── HMAC service token ────────────────────────────────────────────────────────

/**
 * Generates a short-lived HMAC token for the X-Service-Token header.
 * Format: "<unix_seconds>:<hmac_hex>"
 * The agent-service rejects tokens where abs(now - ts) > 60 seconds.
 * Returns empty string when AGENT_SERVICE_TOKEN is not configured (dev mode).
 */
function buildServiceToken(): string {
  const secret = process.env.AGENT_SERVICE_TOKEN
  if (!secret) return ''
  const ts = Math.floor(Date.now() / 1000).toString()
  const sig = crypto.createHmac('sha256', secret).update(ts).digest('hex')
  return `${ts}:${sig}`
}

// ── Core HTTP helper ──────────────────────────────────────────────────────────

/**
 * POSTs JSON to the agent-service and parses the response.
 * Throws on non-2xx responses with a descriptive error message.
 *
 * @template T  Expected response body type
 * @param path  Endpoint path, e.g. "/v1/coordinator"
 * @param body  JSON-serialisable request payload
 */
async function post<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = process.env.AGENT_SERVICE_URL ?? 'http://localhost:8000'
  const token = buildServiceToken()

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Only send the auth header when a token is configured
      ...(token ? { 'X-Service-Token': token } : {}),
    },
    body: JSON.stringify(body),
    // Hard 60-second timeout — prevents agent calls from hanging indefinitely
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`agent-service ${path} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Calls the LangGraph coordinator graph.
 * Classifies intent, routes to the appropriate sub-graph, and returns a
 * synthesised reply with delegation info and updated memories.
 *
 * This is the main entry point for the inbox AI chat panel.
 */
export async function callCoordinator(params: {
  message: string
  thread?: unknown
  threadId?: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  userId: string
  accessToken?: string
}): Promise<AgentResponse> {
  return post<AgentResponse>('/v1/coordinator', {
    message: params.message,
    thread: params.thread ?? null,
    thread_id: params.threadId ?? null,
    history: params.history,
    user_id: params.userId,
    access_token: params.accessToken ?? null,
  })
}

/**
 * Calls the LangGraph triage graph.
 * Searches Gmail for unread threads, classifies each, and returns a
 * structured triage report (urgent / important / normal / low).
 */
export async function callTriage(params: {
  userId: string
  accessToken: string
}): Promise<AgentResponse> {
  return post<AgentResponse>('/v1/triage', {
    user_id: params.userId,
    access_token: params.accessToken,
  })
}

/**
 * Calls the LangGraph scheduling graph for a given email thread.
 * Extracts meeting requests, checks calendar conflicts, and proposes slots.
 * If the graph proposes creating a calendar event it pauses with
 * status: "interrupted" and interrupt_data describing the proposed event —
 * the client must call resumeRun() to approve or reject.
 */
export async function callScheduling(params: {
  thread: unknown
  userId: string
  accessToken: string
}): Promise<AgentResponse> {
  return post<AgentResponse>('/v1/schedule', {
    thread: params.thread,
    user_id: params.userId,
    access_token: params.accessToken,
  })
}

/**
 * Resumes a LangGraph run that was paused at an interrupt() node.
 * The run_id must match the value returned in a previous "interrupted" response.
 * resume_value is forwarded directly to the graph as Command(resume=...).
 *
 * Example usage:
 *   await resumeRun({ runId, resumeValue: { approved: true }, userId })
 */
export async function resumeRun(params: {
  runId: string
  resumeValue: Record<string, unknown>
  userId: string
}): Promise<AgentResponse> {
  return post<AgentResponse>('/v1/resume', {
    run_id: params.runId,
    resume_value: params.resumeValue,
    user_id: params.userId,
  })
}
