import { AutomationAction } from '@/types'
import {
  sendEmail,
  archiveThread,
  markAsRead,
} from './gmail'
import { createCalendarEvent } from './google-calendar'

/**
 * Execute a single automation action via the appropriate API.
 */
export async function executeAction(
  action: AutomationAction,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (action.type) {
      case 'auto_reply': {
        const { to, subject, body, threadId } = action.payload as {
          to: string
          subject: string
          body: string
          threadId?: string
        }
        await sendEmail(accessToken, to, subject, body, threadId)
        return { success: true }
      }

      case 'auto_archive': {
        await archiveThread(accessToken, action.threadId)
        return { success: true }
      }

      case 'auto_mark_read': {
        await markAsRead(accessToken, action.threadId)
        return { success: true }
      }

      case 'auto_calendar_add':
      case 'confirm_calendar_external': {
        const { title, date, time, duration, description, attendees } =
          action.payload as {
            title: string
            date: string
            time?: string
            duration?: number
            description?: string
            attendees?: string[]
          }
        await createCalendarEvent(accessToken, {
          title,
          date,
          time,
          duration,
          description,
          attendees,
        })
        return { success: true }
      }

      case 'confirm_send_reply': {
        const { to, subject, draftReply, threadId } = action.payload as {
          to: string
          subject: string
          draftReply: string
          threadId?: string
        }
        await sendEmail(accessToken, to, subject, draftReply, threadId)
        return { success: true }
      }

      case 'auto_label':
      case 'auto_snooze':
      case 'auto_task_extract': {
        // These are client-side only actions (localStorage labels, snooze state, task tracking)
        // No Gmail API call needed — the UI handles these
        return { success: true }
      }

      case 'confirm_trash': {
        // Not implemented in the top-5 automation — placeholder
        return { success: true }
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` }
    }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Execute all auto-tier and notify-tier actions.
 * Returns the list with updated statuses.
 */
export async function executeAutoActions(
  actions: AutomationAction[],
  accessToken: string
): Promise<AutomationAction[]> {
  const results: AutomationAction[] = []

  for (const action of actions) {
    if (action.riskLevel === 'confirm') {
      // Leave confirm-tier as pending
      results.push(action)
      continue
    }

    // Execute auto and notify tier
    const { success, error } = await executeAction(action, accessToken)
    results.push({
      ...action,
      status: success ? 'executed' : 'pending',
      executedAt: success ? new Date().toISOString() : undefined,
      reason: error ? `${action.reason} (Failed: ${error})` : action.reason,
    })
  }

  return results
}
