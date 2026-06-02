import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * Safely read and validate a JSON request body.
 *
 * Guards against two classes of failure that previously surfaced as 500s:
 *  1. A malformed / empty body making `request.json()` throw.
 *  2. A well-formed body whose shape the route does not expect.
 *
 * Returns either the parsed, typed data or a ready-to-return 400 response.
 */
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }

export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<ParseResult<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }),
    }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path.join('.')
    const message = issue
      ? `${path ? `${path}: ` : ''}${issue.message}`
      : 'Invalid request body.'
    return { ok: false, response: NextResponse.json({ error: message }, { status: 400 }) }
  }

  return { ok: true, data: parsed.data }
}

// ─── Shared building blocks ───────────────────────────────────────

/**
 * A permissive thread schema. The full `Thread` type is large and built by
 * trusted server code; here we only enforce the invariants the routes rely on
 * (an id and a non-empty emails array) while passing the rest through.
 */
export const looseThreadSchema = z
  .object({
    id: z.string().min(1),
    emails: z.array(z.unknown()).min(1),
  })
  .passthrough()

const historySchema = z
  .array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  )
  .max(100)
  .optional()

// ─── Route schemas ────────────────────────────────────────────────

export const analyzeSchema = z.object({
  threadId: z.string().min(1).optional(),
  thread: looseThreadSchema.optional(),
})

export const chatSchema = z.object({
  message: z.string().trim().min(1, 'Message is required'),
  threadId: z.string().min(1).optional(),
  thread: looseThreadSchema.optional(),
})

export const composeSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required'),
  context: z.string().optional(),
})

export const rewriteSchema = z.object({
  text: z.string().trim().min(1, 'Text is required'),
  action: z.enum(['formalize', 'shorten', 'elaborate', 'fix-grammar']),
  senderName: z.string().optional(),
  recipientName: z.string().optional(),
})

export const gmailSendSchema = z.object({
  to: z.string().trim().min(1, 'Missing required field: to'),
  subject: z.string().trim().min(1, 'Missing required field: subject'),
  body: z.string().trim().min(1, 'Missing required field: body'),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
})

export const gmailModifySchema = z.object({
  threadId: z.string().min(1),
  action: z.enum(['read', 'unread', 'star', 'unstar', 'trash', 'archive']),
})

export const calendarCreateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  date: z.string().trim().min(1, 'Date is required'),
  time: z.string().optional(),
  duration: z.coerce.number().int().positive().optional(),
  description: z.string().optional(),
  attendees: z.array(z.string()).optional(),
})

export const labelCreateSchema = z.object({
  name: z.string().trim().min(1, 'name required'),
})

export const labelDeleteSchema = z.object({
  id: z.string().min(1, 'id required'),
})

export const threadMetaSchema = z
  .object({
    threadId: z.string().min(1, 'threadId required'),
  })
  .passthrough()

export const automateRunSchema = z.object({
  threads: z.array(looseThreadSchema).min(1, 'No threads provided.').max(50),
  analyses: z.record(z.string(), z.unknown()).optional(),
})

export const automateApproveSchema = z.object({
  actionId: z.string().min(1, 'actionId and decision are required.'),
  decision: z.enum(['approve', 'reject']),
})

export const agentMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message is required'),
  thread: looseThreadSchema.optional(),
  threadId: z.string().min(1).optional(),
  history: historySchema,
})

export const agentScheduleSchema = z.object({
  thread: looseThreadSchema,
})

export const memoryStoreSchema = z.object({
  category: z.enum([
    'sender_preference',
    'priority_rule',
    'scheduling_preference',
    'writing_style',
    'automation_rule',
    'general',
  ]),
  key: z.string().trim().min(1, 'category, key, and value are required'),
  value: z.string().trim().min(1, 'category, key, and value are required'),
})

export const memoryDeleteSchema = z.object({
  id: z.string().min(1, 'Memory id is required'),
})
