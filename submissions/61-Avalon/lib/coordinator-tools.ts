import { tool } from 'ai'
import { z } from 'zod'
import { runEmailAssistant, runTriageAgent, runSchedulingAgent } from './agents'
import { getMemories, storeMemory, deleteMemory } from './memory'
import { classifyActions } from './automation-engine'
import { executeAutoActions } from './automation-executor'
import { saveActions, getAutomationSettings, getPendingApprovals, updateActionStatus } from './automation-store'
import { executeAction } from './automation-executor'
import { comprehensiveAnalyze } from './groq'
import { Thread, MemoryCategory } from '@/types'

const MEMORY_CATEGORIES: MemoryCategory[] = [
  'sender_preference',
  'priority_rule',
  'scheduling_preference',
  'writing_style',
  'automation_rule',
  'general',
]

/**
 * Creates the meta-tool set for the Coordinator agent.
 * These tools delegate to specialized sub-agents and manage memory.
 */
export function createCoordinatorTools(
  accessToken: string | null,
  userId: string,
  thread: Thread | null,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  memoryContext: string
) {
  return {
    delegateToEmailAssistant: tool({
      description:
        'Delegate a task to the Email Assistant agent. Use for: drafting replies, searching inbox, sending emails, reading threads, managing threads (archive/star/trash), checking calendar, creating events. Pass a clear instruction describing what the assistant should do.',
      parameters: z.object({
        instruction: z
          .string()
          .describe('The specific task to delegate to the email assistant'),
      }),
      execute: async ({ instruction }: { instruction: string }) => {
        try {
          const result = await runEmailAssistant(
            instruction,
            thread,
            accessToken,
            conversationHistory,
            memoryContext
          )
          return {
            agent: 'email_assistant' as const,
            reply: result.reply,
            toolsUsed: result.steps
              .flatMap((s) => s.toolCalls ?? [])
              .map((tc) => tc.name),
          }
        } catch (err) {
          return {
            agent: 'email_assistant' as const,
            error: `Email assistant failed: ${(err as Error).message}`,
          }
        }
      },
    }),

    delegateToTriage: tool({
      description:
        'Delegate inbox triage to the Triage agent. Use when the user asks to review their inbox, check what needs attention, prioritize emails, or get an overview of unread messages. Requires Gmail authentication.',
      parameters: z.object({
        reason: z
          .string()
          .describe('Brief reason for triggering triage'),
      }),
      execute: async () => {
        if (!accessToken) {
          return {
            agent: 'triage' as const,
            error: 'Gmail authentication required for inbox triage.',
          }
        }
        try {
          const result = await runTriageAgent(accessToken, memoryContext)
          return {
            agent: 'triage' as const,
            summary: result.summary,
            toolsUsed: result.steps
              .flatMap((s) => s.toolCalls ?? [])
              .map((tc) => tc.name),
          }
        } catch (err) {
          return {
            agent: 'triage' as const,
            error: `Triage failed: ${(err as Error).message}`,
          }
        }
      },
    }),

    delegateToScheduler: tool({
      description:
        'Delegate scheduling tasks to the Scheduling agent. Use when the user asks about meetings, scheduling, time slots, calendar conflicts, or wants to coordinate a meeting. Requires a selected email thread and Gmail authentication.',
      parameters: z.object({
        reason: z
          .string()
          .describe('Brief reason for triggering the scheduler'),
      }),
      execute: async () => {
        if (!accessToken) {
          return {
            agent: 'scheduler' as const,
            error: 'Gmail authentication required for scheduling.',
          }
        }
        if (!thread) {
          return {
            agent: 'scheduler' as const,
            error:
              'No email thread selected. The user needs to select an email thread to use the scheduling agent.',
          }
        }
        try {
          const result = await runSchedulingAgent(
            thread,
            accessToken,
            memoryContext
          )
          return {
            agent: 'scheduler' as const,
            reply: result.reply,
            toolsUsed: result.steps
              .flatMap((s) => s.toolCalls ?? [])
              .map((tc) => tc.name),
          }
        } catch (err) {
          return {
            agent: 'scheduler' as const,
            error: `Scheduling failed: ${(err as Error).message}`,
          }
        }
      },
    }),

    queryMemory: tool({
      description:
        'Retrieve stored user preferences and learned behaviors from memory. Use this before taking actions to check if the user has preferences relevant to the task (e.g., tone, priority rules, scheduling preferences).',
      parameters: z.object({
        category: z
          .enum(MEMORY_CATEGORIES as [string, ...string[]])
          .optional()
          .describe(
            'Filter by category. Omit to get all preferences.'
          ),
      }),
      execute: async ({ category }: { category?: string }) => {
        try {
          const memories = await getMemories(
            userId,
            category as MemoryCategory | undefined
          )
          if (memories.length === 0) {
            return {
              memories: [],
              message: 'No stored preferences found.',
            }
          }
          return {
            memories: memories.map((m) => ({
              id: m.id,
              category: m.category,
              key: m.key,
              value: m.value,
              confidence: m.confidence,
            })),
          }
        } catch (err) {
          return { error: `Memory query failed: ${(err as Error).message}` }
        }
      },
    }),

    storeMemory: tool({
      description:
        'Save a new user preference or update an existing one. Only store when the user EXPLICITLY states a preference (e.g., "always...", "I prefer...", "from now on...", "don\'t ever..."). Do NOT infer preferences from single interactions.',
      parameters: z.object({
        category: z
          .enum(MEMORY_CATEGORIES as [string, ...string[]])
          .describe('The category this preference falls under'),
        key: z
          .string()
          .describe(
            'Short descriptor for the preference (e.g., "professor-chen-tone", "morning-meetings")'
          ),
        value: z
          .string()
          .describe(
            'The actual preference or rule to remember (e.g., "Always reply formally to Professor Chen")'
          ),
      }),
      execute: async ({
        category,
        key,
        value,
      }: {
        category: string
        key: string
        value: string
      }) => {
        try {
          const result = await storeMemory(userId, {
            category: category as MemoryCategory,
            key,
            value,
          })
          if (result) {
            return {
              status: 'stored' as const,
              category,
              key,
              value,
            }
          }
          return {
            status: 'stored_locally' as const,
            note: 'Database not configured, but preference noted for this session.',
            category,
            key,
            value,
          }
        } catch (err) {
          return { error: `Failed to store: ${(err as Error).message}` }
        }
      },
    }),

    deleteMemory: tool({
      description:
        'Remove a stored user preference. Use when the user says "forget that", "stop doing X", or "remove that preference".',
      parameters: z.object({
        memoryId: z
          .string()
          .describe('The ID of the memory entry to delete'),
      }),
      execute: async ({ memoryId }: { memoryId: string }) => {
        try {
          const success = await deleteMemory(userId, memoryId)
          return {
            status: success ? ('deleted' as const) : ('not_found' as const),
          }
        } catch (err) {
          return { error: `Failed to delete: ${(err as Error).message}` }
        }
      },
    }),

    runAutomation: tool({
      description:
        'Run the automation engine on the current email thread. Analyzes the email, classifies actions by risk level, auto-executes safe actions (archive, label, calendar), and queues high-stakes actions for user approval. Use when the user asks to "handle this email", "automate my inbox", or "process this thread".',
      parameters: z.object({
        reason: z
          .string()
          .describe('Brief reason for running automation'),
      }),
      execute: async () => {
        if (!accessToken || !thread) {
          return {
            error: 'Requires Gmail authentication and a selected email thread.',
          }
        }
        try {
          const analysis = await comprehensiveAnalyze(thread)
          const settings = await getAutomationSettings(userId)
          const actions = classifyActions(thread, analysis, userId, settings)
          const processed = await executeAutoActions(actions, accessToken)
          await saveActions(userId, processed)

          const executed = processed.filter((a) => a.status === 'executed')
          const pending = processed.filter(
            (a) => a.status === 'pending' && a.riskLevel === 'confirm'
          )

          return {
            executed: executed.map((a) => ({
              type: a.type,
              reason: a.reason,
            })),
            pendingApproval: pending.map((a) => ({
              id: a.id,
              type: a.type,
              reason: a.reason,
            })),
            summary: `Auto-executed ${executed.length} action(s). ${pending.length} action(s) need your approval.`,
          }
        } catch (err) {
          return { error: `Automation failed: ${(err as Error).message}` }
        }
      },
    }),

    approveAction: tool({
      description:
        'Approve or reject a pending automation action. Use when the user confirms ("yes", "go ahead", "send it", "approve") or rejects ("no", "don\'t send", "skip") a pending action shown to them.',
      parameters: z.object({
        actionId: z.string().describe('The ID of the pending action'),
        decision: z
          .enum(['approve', 'reject'])
          .describe('Whether to approve or reject the action'),
      }),
      execute: async ({
        actionId,
        decision,
      }: {
        actionId: string
        decision: 'approve' | 'reject'
      }) => {
        try {
          if (decision === 'reject') {
            await updateActionStatus(userId, actionId, 'rejected')
            return { status: 'rejected' as const, actionId }
          }

          const pending = await getPendingApprovals(userId)
          const action = pending.find((a) => a.id === actionId)
          if (!action) {
            return { error: 'Action not found or already processed.' }
          }

          if (!accessToken) {
            return { error: 'Gmail authentication required to execute.' }
          }

          const { success, error } = await executeAction(action, accessToken)
          if (success) {
            await updateActionStatus(userId, actionId, 'executed')
            return { status: 'executed' as const, actionId, type: action.type }
          }
          return { error: error ?? 'Execution failed.' }
        } catch (err) {
          return { error: `Approval failed: ${(err as Error).message}` }
        }
      },
    }),
  }
}
