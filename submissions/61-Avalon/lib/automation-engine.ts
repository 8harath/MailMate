import {
  Thread,
  ComprehensiveAnalysis,
  AutomationAction,
  AutomationSettings,
  AutomationActionType,
  ActionRiskLevel,
  DetectedMeeting,
} from '@/types'

const DEFAULT_SETTINGS: AutomationSettings = {
  enabled: true,
  autoReplyToAutomated: true,
  autoArchiveLowPriority: true,
  autoAddCalendarEvents: true,
  autoSnooze: true,
  autoLabel: true,
  autoExtractTasks: true,
  autoTriageOnLoad: true,
}

// ─── Sender detection ─────────────────────────────────────────

const AUTOMATED_SENDER_PATTERNS = [
  /^noreply@/i,
  /^no-reply@/i,
  /^no\.reply@/i,
  /^donotreply@/i,
  /^do-not-reply@/i,
  /^notifications?@/i,
  /^alerts?@/i,
  /^mailer-daemon@/i,
  /^automated@/i,
  /^updates?@/i,
  /^info@.*\.com$/i,
  /^support@.*noreply/i,
  /^billing@/i,
  /^receipts?@/i,
  /^newsletter@/i,
  /^digest@/i,
  /^team@.*\.(io|com|dev)$/i,
]

export function isAutomatedSender(email: string): boolean {
  return AUTOMATED_SENDER_PATTERNS.some((pattern) => pattern.test(email))
}

// ─── Classification helpers ───────────────────────────────────

function shouldAutoReply(
  thread: Thread,
  analysis: ComprehensiveAnalysis
): boolean {
  const senderEmail = thread.from.email
  const hints = analysis.automationHints

  // Must be automated sender
  if (!isAutomatedSender(senderEmail)) return false

  // If the LLM says it requires human response, don't auto-reply
  if (hints?.requiresHumanResponse) return false

  // Don't auto-reply to spam
  if (analysis.category === 'spam') return false

  // High confidence from LLM or clear automated pattern
  if (hints?.isAutomatedEmail && hints.confidenceScore >= 0.8) return true

  // Fallback: automated sender pattern is enough
  return true
}

function shouldAutoArchive(analysis: ComprehensiveAnalysis): boolean {
  return (
    analysis.priority === 'low' &&
    ['spam', 'updates'].includes(analysis.category) &&
    analysis.senderImportance === 'unknown' &&
    !analysis.followUpNeeded
  )
}

function shouldAutoSnooze(analysis: ComprehensiveAnalysis): boolean {
  return (
    analysis.priority === 'low' &&
    !analysis.followUpNeeded &&
    analysis.category !== 'spam' &&
    analysis.senderImportance !== 'vip'
  )
}

function shouldAutoMarkRead(
  thread: Thread,
  analysis: ComprehensiveAnalysis
): boolean {
  return (
    (analysis.category === 'spam' || analysis.category === 'updates') &&
    analysis.priority === 'low' &&
    isAutomatedSender(thread.from.email)
  )
}

/**
 * Split meetings into safe-to-auto-add vs needs-confirmation.
 * Auto-add if: no attendees, or all attendees match the user's email.
 */
function classifyMeetings(
  meetings: DetectedMeeting[],
  userEmail: string
): { autoAdd: DetectedMeeting[]; needsConfirmation: DetectedMeeting[] } {
  const autoAdd: DetectedMeeting[] = []
  const needsConfirmation: DetectedMeeting[] = []

  for (const meeting of meetings) {
    const hasExternalAttendees = meeting.attendees.some(
      (a) => a.toLowerCase() !== userEmail.toLowerCase() && a.trim() !== ''
    )
    if (!hasExternalAttendees || meeting.attendees.length === 0) {
      autoAdd.push(meeting)
    } else {
      needsConfirmation.push(meeting)
    }
  }

  return { autoAdd, needsConfirmation }
}

function generateAutoReplyText(
  thread: Thread,
  analysis: ComprehensiveAnalysis
): string {
  const hints = analysis.automationHints

  if (hints?.isNewsletter) {
    return `Thank you for the update. This has been noted.`
  }

  if (analysis.category === 'finance') {
    return `Thank you. This has been received and noted for our records.`
  }

  return `Thank you for your email regarding "${thread.subject}". This has been received and noted.`
}

// ─── Main classification function ─────────────────────────────

function makeAction(
  threadId: string,
  type: AutomationActionType,
  riskLevel: ActionRiskLevel,
  reason: string,
  payload: Record<string, unknown>,
  thread: Thread
): AutomationAction {
  return {
    id: crypto.randomUUID(),
    threadId,
    type,
    riskLevel,
    status: 'pending',
    payload,
    reason,
    createdAt: new Date().toISOString(),
    threadSubject: thread.subject,
    threadFrom: thread.from,
  }
}

export function classifyActions(
  thread: Thread,
  analysis: ComprehensiveAnalysis,
  userEmail: string,
  settings: AutomationSettings = DEFAULT_SETTINGS
): AutomationAction[] {
  if (!settings.enabled) return []

  const actions: AutomationAction[] = []

  // 1. Auto-label
  if (settings.autoLabel && analysis.labels.length > 0) {
    actions.push(
      makeAction(
        thread.id,
        'auto_label',
        'auto',
        `Labeling as: ${analysis.labels.join(', ')}`,
        { labels: analysis.labels, category: analysis.category },
        thread
      )
    )
  }

  // 2. Auto-mark read
  if (shouldAutoMarkRead(thread, analysis)) {
    actions.push(
      makeAction(
        thread.id,
        'auto_mark_read',
        'auto',
        `Low-priority automated email from ${thread.from.email}`,
        {},
        thread
      )
    )
  }

  // 3. Auto-archive
  if (settings.autoArchiveLowPriority && shouldAutoArchive(analysis)) {
    actions.push(
      makeAction(
        thread.id,
        'auto_archive',
        'notify',
        `Low-priority ${analysis.category} from unknown sender — auto-archived`,
        {},
        thread
      )
    )
  }

  // 4. Auto-snooze (only if not already archived)
  if (
    settings.autoSnooze &&
    shouldAutoSnooze(analysis) &&
    !shouldAutoArchive(analysis)
  ) {
    actions.push(
      makeAction(
        thread.id,
        'auto_snooze',
        'auto',
        `Low-priority email — snoozed for later`,
        { snoozeUntil: getSnoozeDate() },
        thread
      )
    )
  }

  // 5. Auto-reply to automated senders
  if (settings.autoReplyToAutomated && shouldAutoReply(thread, analysis)) {
    const replyText = generateAutoReplyText(thread, analysis)
    actions.push(
      makeAction(
        thread.id,
        'auto_reply',
        'notify',
        `Auto-acknowledged email from automated sender ${thread.from.email}`,
        {
          to: thread.from.email,
          subject: `Re: ${thread.subject}`,
          body: replyText,
          threadId: thread.id,
        },
        thread
      )
    )
  }

  // 6. Calendar events
  if (
    settings.autoAddCalendarEvents &&
    analysis.meetings.length > 0
  ) {
    const { autoAdd, needsConfirmation } = classifyMeetings(
      analysis.meetings,
      userEmail
    )

    for (const meeting of autoAdd) {
      actions.push(
        makeAction(
          thread.id,
          'auto_calendar_add',
          'notify',
          `Auto-adding "${meeting.title}" on ${meeting.date} at ${meeting.time} to calendar`,
          {
            title: meeting.title,
            date: meeting.date,
            time: meeting.time || undefined,
            attendees: meeting.attendees,
            description: `Auto-added from email: ${thread.subject}`,
          },
          thread
        )
      )
    }

    for (const meeting of needsConfirmation) {
      actions.push(
        makeAction(
          thread.id,
          'confirm_calendar_external',
          'confirm',
          `Meeting "${meeting.title}" has external attendees: ${meeting.attendees.join(', ')} — needs your approval to send invites`,
          {
            title: meeting.title,
            date: meeting.date,
            time: meeting.time || undefined,
            attendees: meeting.attendees,
            description: `From email: ${thread.subject}`,
          },
          thread
        )
      )
    }
  }

  // 7. Task extraction
  if (settings.autoExtractTasks && analysis.tasks.length > 0) {
    actions.push(
      makeAction(
        thread.id,
        'auto_task_extract',
        'auto',
        `Extracted ${analysis.tasks.length} task(s): ${analysis.tasks.map((t) => t.title).join(', ')}`,
        { tasks: analysis.tasks, deadlines: analysis.deadlines },
        thread
      )
    )
  }

  // 8. Confirm-tier: reply needed to important senders
  if (
    analysis.followUpNeeded &&
    (analysis.senderImportance === 'vip' ||
      analysis.priority === 'urgent' ||
      analysis.priority === 'important')
  ) {
    actions.push(
      makeAction(
        thread.id,
        'confirm_send_reply',
        'confirm',
        `${analysis.priority === 'urgent' ? 'URGENT: ' : ''}Follow-up needed for ${analysis.senderImportance === 'vip' ? 'VIP ' : ''}sender ${thread.from.name}`,
        {
          to: thread.from.email,
          subject: `Re: ${thread.subject}`,
          draftReply: analysis.draftReply,
          smartReplies: analysis.smartReplies,
        },
        thread
      )
    )
  }

  return actions
}

// ─── Helpers ──────────────────────────────────────────────────

function getSnoozeDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

export { DEFAULT_SETTINGS }
