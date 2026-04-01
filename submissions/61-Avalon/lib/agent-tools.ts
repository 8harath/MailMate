import { tool } from 'ai'
import { z } from 'zod'
import {
  getFullThreads,
  getThread,
  sendEmail,
  markAsRead,
  archiveThread,
  starThread,
  trashThread,
} from './gmail'
import { listUpcomingEvents, createCalendarEvent } from './google-calendar'

/**
 * Creates the tool set for MailMate agents.
 * Each tool wraps a Gmail or Calendar API call and returns
 * a JSON-serializable result the LLM can reason about.
 */
export function createAgentTools(accessToken: string) {
  return {
    searchInbox: tool({
      description:
        'Search the user\'s Gmail inbox. Supports Gmail search syntax (from:, subject:, after:, before:, has:attachment, is:unread, etc.).',
      parameters: z.object({
        query: z.string().describe('Gmail search query'),
      }),
      execute: async ({ query }: { query: string }) => {
        try {
          const threads = await getFullThreads(accessToken, 10, query)
          return {
            results: threads
              .filter((t): t is NonNullable<typeof t> => t !== null)
              .map((t) => ({
                id: t.id,
                subject: t.subject,
                from: t.from,
                preview: String(t.preview ?? '').slice(0, 120),
                timestamp: t.timestamp,
                unreadCount: t.unreadCount,
              })),
          }
        } catch (err) {
          return { error: `Search failed: ${(err as Error).message}`, results: [] }
        }
      },
    }),

    readThread: tool({
      description:
        'Read the full email content of a specific thread by its ID. Returns all messages with sender, body, and timestamp.',
      parameters: z.object({
        threadId: z.string().describe('The Gmail thread ID'),
      }),
      execute: async ({ threadId }: { threadId: string }) => {
        try {
          const full = await getThread(accessToken, threadId)
          if (!full || !full.messages) return { error: 'Thread not found' }

          return {
            id: threadId,
            messageCount: full.messages.length,
            messages: full.messages.slice(-5).map((msg) => {
              const headers = msg.payload.headers
              const from =
                headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? 'Unknown'
              const subject =
                headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? ''
              let body = ''
              if (msg.payload.parts) {
                const textPart = msg.payload.parts.find((p) => p.mimeType === 'text/plain')
                if (textPart?.body?.data) {
                  body = Buffer.from(
                    textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'),
                    'base64'
                  )
                    .toString('utf-8')
                    .slice(0, 500)
                }
              } else if (msg.payload.body?.data) {
                body = Buffer.from(
                  msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'),
                  'base64'
                )
                  .toString('utf-8')
                  .slice(0, 500)
              }
              return { from, subject, body, date: new Date(parseInt(msg.internalDate)).toISOString() }
            }),
          }
        } catch (err) {
          return { error: `Failed to read thread: ${(err as Error).message}` }
        }
      },
    }),

    listCalendarEvents: tool({
      description:
        'List the user\'s upcoming calendar events to check availability and scheduling conflicts.',
      parameters: z.object({
        maxResults: z
          .number()
          .optional()
          .describe('Number of events to return, default 10'),
      }),
      execute: async ({ maxResults }: { maxResults?: number }) => {
        try {
          const events = await listUpcomingEvents(accessToken, maxResults ?? 10)
          return { events }
        } catch (err) {
          return { error: `Calendar access failed: ${(err as Error).message}`, events: [] }
        }
      },
    }),

    createCalendarEvent: tool({
      description:
        'Create a new calendar event. Only use when the user has confirmed they want to create it.',
      parameters: z.object({
        title: z.string().describe('Event title'),
        date: z.string().describe('Date in YYYY-MM-DD format'),
        time: z.string().optional().describe('Start time in HH:mm format, omit for all-day'),
        duration: z.number().optional().describe('Duration in minutes, default 60'),
        description: z.string().optional().describe('Event description'),
        attendees: z.array(z.string()).optional().describe('Attendee email addresses'),
      }),
      execute: async (params: { title: string; date: string; time?: string; duration?: number; description?: string; attendees?: string[] }) => {
        try {
          const result = await createCalendarEvent(accessToken, params)
          return { status: 'created' as const, ...result }
        } catch (err) {
          return { error: `Failed to create event: ${(err as Error).message}` }
        }
      },
    }),

    draftReply: tool({
      description:
        'Compose a reply email draft. Returns the draft for the user to review — does NOT send it automatically.',
      parameters: z.object({
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Email subject line'),
        body: z.string().describe('The full email body text'),
        threadId: z.string().optional().describe('Thread ID to reply in'),
      }),
      execute: async ({ to, subject, body, threadId }: { to: string; subject: string; body: string; threadId?: string }) => {
        return {
          status: 'draft_ready' as const,
          to,
          subject,
          body,
          threadId,
          note: 'This draft is ready for the user to review. Ask if they want to send it.',
        }
      },
    }),

    sendEmail: tool({
      description:
        'Send an email through Gmail. ONLY use when the user has explicitly confirmed they want to send.',
      parameters: z.object({
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Email subject'),
        body: z.string().describe('Email body text'),
        threadId: z.string().optional().describe('Thread ID for replies'),
      }),
      execute: async ({ to, subject, body, threadId }: { to: string; subject: string; body: string; threadId?: string }) => {
        try {
          const result = await sendEmail(accessToken, to, subject, body, threadId)
          return { status: 'sent' as const, messageId: result.id }
        } catch (err) {
          return { error: `Failed to send: ${(err as Error).message}` }
        }
      },
    }),

    modifyThread: tool({
      description:
        'Modify a Gmail thread: mark as read, archive, star, or trash.',
      parameters: z.object({
        threadId: z.string().describe('The thread ID to modify'),
        action: z.enum(['read', 'archive', 'star', 'trash']).describe('The action to perform'),
      }),
      execute: async ({ threadId, action }: { threadId: string; action: 'read' | 'archive' | 'star' | 'trash' }) => {
        try {
          const actions: Record<string, (token: string, id: string) => Promise<void>> = {
            read: markAsRead,
            archive: archiveThread,
            star: starThread,
            trash: trashThread,
          }
          await actions[action](accessToken, threadId)
          return { status: 'done' as const, action, threadId }
        } catch (err) {
          return { error: `Failed to ${action}: ${(err as Error).message}` }
        }
      },
    }),
  }
}
