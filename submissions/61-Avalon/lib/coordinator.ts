import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { createCoordinatorTools } from './coordinator-tools'
import { formatMemoryContext, getMemories } from './memory'
import { Thread, AgentStep, CoordinatorResult, DelegationStep, MemoryCategory } from '@/types'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = 'llama-3.3-70b-versatile'

function formatSteps(steps: Awaited<ReturnType<typeof generateText>>['steps']): AgentStep[] {
  return steps.map((s) => ({
    toolCalls: s.toolCalls?.map((tc) => ({ name: tc.toolName, args: tc.args as Record<string, unknown> })),
    toolResults: s.toolResults?.map((tr) => ({ name: tr.toolName, result: tr.result as unknown })),
    text: s.text || undefined,
  }))
}

export async function runCoordinator(
  message: string,
  thread: Thread | null,
  accessToken: string | null,
  userId: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<CoordinatorResult> {
  // Load memory context for the user
  const memoryContext = await formatMemoryContext(userId)
  const memoriesUsed = await getMemories(userId)

  // Build thread context summary for the coordinator
  const threadContext = thread
    ? `Currently selected email thread:\n` +
      `  Subject: "${thread.subject}"\n` +
      `  From: ${thread.from.name} <${thread.from.email}>\n` +
      `  Messages: ${thread.emails.length}\n` +
      `  Latest message preview: ${thread.emails[thread.emails.length - 1]?.body.slice(0, 200) ?? 'N/A'}`
    : 'No email thread is currently selected.'

  const hasAuth = !!accessToken

  const systemPrompt = `You are MailMate Coordinator, the central orchestrator for an AI-powered email assistant.

## Your Role
You analyze user requests, consult your memory for relevant preferences, delegate to specialized sub-agents, and synthesize their results into clear, unified responses.

## Available Sub-Agents

1. **Email Assistant** (delegateToEmailAssistant) — Your general-purpose agent. Use for:
   - Drafting email replies
   - Searching the inbox
   - Sending emails (after user confirmation)
   - Reading specific threads
   - Managing threads (archive, star, trash, mark read)
   - Checking calendar events
   - Creating calendar events
   ${!hasAuth ? '⚠️ Currently in demo mode — no Gmail/Calendar access.' : ''}

2. **Triage Agent** (delegateToTriage) — Your inbox organizer. Use for:
   - Reviewing unread emails
   - Prioritizing inbox items
   - "What needs my attention?" queries
   ${!hasAuth ? '⚠️ Requires Gmail authentication.' : ''}

3. **Scheduling Agent** (delegateToScheduler) — Your meeting coordinator. Use for:
   - Extracting meeting requests from emails
   - Checking calendar conflicts
   - Suggesting available time slots
   - Coordinating meeting logistics
   ${!hasAuth ? '⚠️ Requires Gmail authentication and a selected thread.' : ''}

## Memory Tools

- **queryMemory** — Check stored user preferences before taking actions
- **storeMemory** — Save a new preference when the user EXPLICITLY states one
- **deleteMemory** — Remove a preference when the user asks to forget it

## Rules

1. **Simple questions**: If the user asks a simple question about the selected email that you can answer from the thread context, answer directly without delegating.
2. **Complex requests**: Break them into steps and delegate to the right sub-agent(s).
3. **Multi-agent tasks**: For requests like "organize my week" or "handle my inbox", invoke multiple sub-agents in sequence and synthesize their results.
4. **Memory-first**: When the request involves tone, priority, or preferences, check memory first.
5. **Preference detection**: When the user says "always...", "I prefer...", "from now on...", "don't...", "never...", store it as a memory.
6. **Synthesize**: Don't just pass through raw sub-agent responses. Combine, summarize, and present a coherent unified response.
7. **Be transparent**: Tell the user which sub-agents you're using and what preferences you're applying.
8. **Draft before send**: Never instruct an agent to send an email without explicit user confirmation.

## Context

${threadContext}
${memoryContext}
Today's date: ${new Date().toISOString().split('T')[0]}`

  const tools = createCoordinatorTools(
    accessToken,
    userId,
    thread,
    conversationHistory,
    memoryContext
  )

  const { text, steps } = await generateText({
    model: groq(MODEL),
    system: systemPrompt,
    messages: [
      ...conversationHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ],
    tools,
    maxSteps: 8,
  })

  // Extract delegation info and stored memories from the steps
  const delegations: DelegationStep[] = []
  const memoriesStored: { category: MemoryCategory; key: string; value: string }[] = []

  for (const step of steps) {
    if (step.toolResults) {
      for (const tr of step.toolResults) {
        const result = tr.result as Record<string, unknown>
        if (
          tr.toolName === 'delegateToEmailAssistant' ||
          tr.toolName === 'delegateToTriage' ||
          tr.toolName === 'delegateToScheduler'
        ) {
          const agentMap: Record<string, DelegationStep['agent']> = {
            delegateToEmailAssistant: 'writer',
            delegateToTriage: 'triage',
            delegateToScheduler: 'scheduler',
          }
          delegations.push({
            agent: agentMap[tr.toolName],
            action: tr.toolName,
            result:
              (result.reply as string) ??
              (result.summary as string) ??
              (result.error as string) ??
              'Completed',
          })
        }
        if (tr.toolName === 'storeMemory' && result.status === 'stored') {
          memoriesStored.push({
            category: result.category as MemoryCategory,
            key: result.key as string,
            value: result.value as string,
          })
        }
      }
    }
  }

  return {
    reply: text,
    steps: formatSteps(steps),
    delegations,
    memoriesUsed: memoriesUsed.length > 0 ? memoriesUsed : [],
    memoriesStored,
  }
}
