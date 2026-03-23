// --- Core Email Types ---

export interface EmailSender {
  name: string
  email: string
  avatar?: string
}

export interface Attachment {
  name: string
  size: string
  type: string
}

export interface Email {
  id: string
  threadId: string
  from: EmailSender
  to: EmailSender[]
  subject: string
  body: string
  timestamp: string
  isRead: boolean
  attachments?: Attachment[]
}

export type EmailCategory = 'work' | 'personal' | 'finance' | 'updates' | 'spam'

export interface Thread {
  id: string
  from: EmailSender
  subject: string
  preview: string
  timestamp: string
  unreadCount: number
  emails: Email[]
  category: EmailCategory
}

// --- Comprehensive Analysis ---

export type Priority = 'urgent' | 'important' | 'normal' | 'low'

export interface DetectedMeeting {
  title: string
  date: string
  time: string
  attendees: string[]
}

export interface ExtractedTask {
  title: string
  deadline: string
  priority: 'high' | 'medium' | 'low'
}

export interface DetectedDeadline {
  description: string
  date: string
  urgent: boolean
}

export interface KeyInfo {
  dates: string[]
  links: string[]
  contacts: string[]
  amounts: string[]
}

export interface ComprehensiveAnalysis {
  summary: string[]
  priority: Priority
  category: EmailCategory
  smartReplies: string[]
  draftReply: string
  meetings: DetectedMeeting[]
  tasks: ExtractedTask[]
  deadlines: DetectedDeadline[]
  keyInfo: KeyInfo
  labels: string[]
  followUpNeeded: boolean
  followUpSuggestion: string
  senderImportance: 'vip' | 'regular' | 'unknown'
}

// --- UI State Types ---

export interface ThreadAnalysisState {
  data: ComprehensiveAnalysis | null
  loading: boolean
  error: string | null
}

export interface AIChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}
