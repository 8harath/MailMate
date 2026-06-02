import { describe, it, expect } from 'vitest'
import { isAutomatedSender, classifyActions } from '../lib/automation-engine'
import { Thread, ComprehensiveAnalysis, AutomationSettings } from '../types'

// ─── isAutomatedSender ──────────────────────────────────────────

describe('isAutomatedSender', () => {
  it('detects noreply addresses', () => {
    expect(isAutomatedSender('noreply@github.com')).toBe(true)
    expect(isAutomatedSender('no-reply@stripe.com')).toBe(true)
    expect(isAutomatedSender('no.reply@service.io')).toBe(true)
  })

  it('detects notification/alert addresses', () => {
    expect(isAutomatedSender('notifications@slack.com')).toBe(true)
    expect(isAutomatedSender('alerts@pagerduty.com')).toBe(true)
    expect(isAutomatedSender('newsletter@company.com')).toBe(true)
  })

  it('does not flag regular human addresses', () => {
    expect(isAutomatedSender('john.doe@company.com')).toBe(false)
    expect(isAutomatedSender('alice@gmail.com')).toBe(false)
    expect(isAutomatedSender('manager@startup.io')).toBe(false)
  })
})

// ─── classifyActions ────────────────────────────────────────────

const baseThread: Thread = {
  id: 'thread-test',
  from: { name: 'GitHub', email: 'noreply@github.com' },
  subject: 'Your PR was merged',
  preview: 'Pull request #123 was merged',
  timestamp: new Date().toISOString(),
  unreadCount: 1,
  emails: [
    {
      id: 'msg-1',
      threadId: 'thread-test',
      from: { name: 'GitHub', email: 'noreply@github.com' },
      to: [{ name: 'User', email: 'user@example.com' }],
      subject: 'Your PR was merged',
      body: 'Pull request #123 was merged into main.',
      timestamp: new Date().toISOString(),
      isRead: false,
    },
  ],
  category: 'updates',
}

const baseAnalysis: ComprehensiveAnalysis = {
  summary: ['PR was merged'],
  priority: 'low',
  category: 'updates',
  smartReplies: [],
  draftReply: '',
  meetings: [],
  tasks: [],
  deadlines: [],
  keyInfo: { dates: [], links: [], contacts: [], amounts: [] },
  labels: ['github', 'pr'],
  followUpNeeded: false,
  followUpSuggestion: '',
  senderImportance: 'unknown',
  automationHints: {
    isAutomatedEmail: true,
    isNewsletter: false,
    requiresHumanResponse: false,
    suggestedAutoAction: 'archive',
    confidenceScore: 0.95,
  },
}

const defaultSettings: AutomationSettings = {
  enabled: true,
  autoReplyToAutomated: true,
  autoArchiveLowPriority: true,
  autoAddCalendarEvents: true,
  autoSnooze: true,
  autoLabel: true,
  autoExtractTasks: true,
  autoTriageOnLoad: true,
}

describe('classifyActions', () => {
  it('returns empty array when automation is disabled', () => {
    const settings = { ...defaultSettings, enabled: false }
    const actions = classifyActions(baseThread, baseAnalysis, 'user@example.com', settings)
    expect(actions).toHaveLength(0)
  })

  it('classifies auto-archive for low-priority automated email', () => {
    const actions = classifyActions(baseThread, baseAnalysis, 'user@example.com', defaultSettings)
    const archiveAction = actions.find(a => a.type === 'auto_archive')
    expect(archiveAction).toBeDefined()
    // auto_archive uses notify risk (executes + notifies user) not silent auto
    expect(archiveAction?.riskLevel).toBe('notify')
  })

  it('classifies auto-mark-read for automated sender', () => {
    const actions = classifyActions(baseThread, baseAnalysis, 'user@example.com', defaultSettings)
    const readAction = actions.find(a => a.type === 'auto_mark_read')
    expect(readAction).toBeDefined()
    expect(readAction?.riskLevel).toBe('auto')
  })

  it('assigns unique IDs to each action', () => {
    const actions = classifyActions(baseThread, baseAnalysis, 'user@example.com', defaultSettings)
    const ids = actions.map(a => a.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('all generated actions reference the correct thread', () => {
    const actions = classifyActions(baseThread, baseAnalysis, 'user@example.com', defaultSettings)
    for (const action of actions) {
      expect(action.threadId).toBe(baseThread.id)
    }
  })

  it('does not auto-reply when setting is disabled', () => {
    const settings = { ...defaultSettings, autoReplyToAutomated: false }
    const actions = classifyActions(baseThread, baseAnalysis, 'user@example.com', settings)
    const replyAction = actions.find(a => a.type === 'auto_reply')
    expect(replyAction).toBeUndefined()
  })
})
