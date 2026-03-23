'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Mail, Search, Loader2, X, Inbox, Bot, Send, Sparkles,
  Calendar, ListChecks, Clock, AlertTriangle, Tag, Star,
  Copy, Check, MessageSquare, FileText, Link2, Users, DollarSign
} from 'lucide-react'
import NextLink from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { mockThreads } from '@/data/emails'
import {
  Thread, ComprehensiveAnalysis, ThreadAnalysisState,
  EmailCategory, Priority, AIChatMessage
} from '@/types'

// --- Helpers ---

const LS_KEY = 'mailmate-analyses'

function loadAnalyses(): Record<string, ComprehensiveAnalysis> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    // Validate shape — if stale from old format, discard
    const first = Object.values(parsed)[0] as Record<string, unknown> | undefined
    if (first && !('summary' in first && 'smartReplies' in first)) {
      localStorage.removeItem(LS_KEY)
      return {}
    }
    return parsed
  } catch { return {} }
}

function saveAnalyses(data: Record<string, ComprehensiveAnalysis>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch {}
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// --- Badge Components ---

const priorityConfig: Record<Priority, { label: string; cls: string }> = {
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700 border-red-200' },
  important: { label: 'Important', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  normal: { label: 'Normal', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  low: { label: 'Low', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
}

const categoryConfig: Record<EmailCategory, { label: string; cls: string }> = {
  work: { label: 'Work', cls: 'bg-blue-50 text-blue-700' },
  personal: { label: 'Personal', cls: 'bg-purple-50 text-purple-700' },
  finance: { label: 'Finance', cls: 'bg-emerald-50 text-emerald-700' },
  updates: { label: 'Updates', cls: 'bg-cyan-50 text-cyan-700' },
  spam: { label: 'Spam', cls: 'bg-gray-100 text-gray-500' },
}

function PriorityBadge({ priority }: { priority: string }) {
  const c = priorityConfig[priority as Priority] ?? priorityConfig.normal
  return <span className={`inline-flex items-center border rounded-full text-[11px] font-medium px-2 py-px ${c.cls}`}>{c.label}</span>
}

function CategoryBadge({ category }: { category: string }) {
  const c = categoryConfig[category as EmailCategory] ?? categoryConfig.work
  return <span className={`inline-flex items-center rounded-full text-[11px] font-medium px-2 py-px ${c.cls}`}>{c.label}</span>
}

function SenderBadge({ importance }: { importance: 'vip' | 'regular' | 'unknown' }) {
  if (importance === 'vip') return <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600"><Star className="w-3 h-3" /> VIP</span>
  return null
}

// --- Thread List Item ---

function ThreadListItem({ thread, selected, analysis, onClick }: {
  thread: Thread; selected: boolean; analysis?: ComprehensiveAnalysis | null; onClick: () => void
}) {
  const dotColor: Record<Priority, string> = {
    urgent: 'bg-red-500', important: 'bg-amber-500', normal: 'bg-gray-300', low: 'bg-slate-200'
  }

  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
        selected ? 'bg-blue-50/70 border-l-blue-600' : 'border-l-transparent hover:bg-gray-50'
      }`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5 ${
          thread.unreadCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {thread.from.avatar || thread.from.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm truncate ${thread.unreadCount > 0 ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
              {thread.from.name}
            </span>
            <span className="text-[11px] text-gray-400 shrink-0">{timeAgo(thread.timestamp)}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-px">
            {analysis && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor[analysis.priority as Priority] ?? 'bg-gray-300'}`} />}
            <p className={`text-sm truncate ${thread.unreadCount > 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
              {thread.subject}
            </p>
          </div>
          <p className="text-xs text-gray-400 truncate mt-0.5">{thread.preview}</p>
          {analysis && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <CategoryBadge category={analysis.category} />
              {analysis.followUpNeeded && <span className="text-[11px] text-orange-600 font-medium flex items-center gap-0.5"><Clock className="w-3 h-3" /> Follow-up</span>}
            </div>
          )}
        </div>
        {thread.unreadCount > 0 && (
          <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-1">
            {thread.unreadCount}
          </span>
        )}
      </div>
    </button>
  )
}

// --- Analysis Panel Sections ---

function SummarySection({ analysis }: { analysis: ComprehensiveAnalysis }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={analysis.priority} />
          <CategoryBadge category={analysis.category} />
          <SenderBadge importance={analysis.senderImportance} />
        </div>
        {analysis.labels.length > 0 && (
          <div className="flex items-center gap-1">
            {analysis.labels.map(l => (
              <span key={l} className="inline-flex items-center gap-0.5 text-[11px] bg-gray-100 text-gray-600 rounded px-1.5 py-px">
                <Tag className="w-2.5 h-2.5" />{l}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">AI Summary</p>
        <ul className="space-y-1">
          {analysis.summary.map((s, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>{s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function SmartRepliesSection({ replies }: { replies: string[] }) {
  const [copied, setCopied] = useState<number | null>(null)

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  if (replies.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" /> Smart Replies
      </p>
      <div className="space-y-1.5">
        {replies.map((r, i) => (
          <button key={i} onClick={() => handleCopy(r, i)}
            className="w-full text-left text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-blue-300 hover:bg-blue-50/50 transition-all flex items-center justify-between group">
            <span className="text-gray-700">{r}</span>
            {copied === i
              ? <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
              : <Copy className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 shrink-0" />
            }
          </button>
        ))}
      </div>
    </div>
  )
}

function DraftReplySection({ draft }: { draft: string }) {
  const [copied, setCopied] = useState(false)

  if (!draft) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> Draft Reply
      </p>
      <div className="bg-white border border-gray-200 rounded-lg p-3 relative">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{draft}</p>
        <button onClick={() => { navigator.clipboard.writeText(draft); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-gray-100 transition-colors">
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
        </button>
      </div>
    </div>
  )
}

function MeetingsSection({ meetings }: { meetings: ComprehensiveAnalysis['meetings'] }) {
  if (meetings.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5" /> Detected Meetings
      </p>
      <div className="space-y-2">
        {meetings.map((m, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-900">{m.title}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{m.date}</span>
              {m.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.time}</span>}
            </div>
            {m.attendees.length > 0 && (
              <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                <Users className="w-3 h-3" />{m.attendees.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TasksSection({ tasks }: { tasks: ComprehensiveAnalysis['tasks'] }) {
  if (tasks.length === 0) return null
  const taskPriorityColor = { high: 'text-red-600', medium: 'text-amber-600', low: 'text-gray-500' }
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <ListChecks className="w-3.5 h-3.5" /> Extracted Tasks
      </p>
      <div className="space-y-1.5">
        {tasks.map((t, i) => (
          <div key={i} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <div className="w-4 h-4 rounded border-2 border-gray-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{t.title}</p>
              <p className="text-xs text-gray-400">{t.deadline && `Due: ${t.deadline}`}</p>
            </div>
            <span className={`text-[11px] font-medium ${taskPriorityColor[t.priority] ?? 'text-gray-500'}`}>{t.priority}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DeadlinesSection({ deadlines }: { deadlines: ComprehensiveAnalysis['deadlines'] }) {
  if (deadlines.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" /> Deadlines
      </p>
      <div className="space-y-1.5">
        {deadlines.map((d, i) => (
          <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            d.urgent ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-white border border-gray-200 text-gray-700'
          }`}>
            {d.urgent && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
            <span className="flex-1">{d.description}</span>
            <span className="text-xs text-gray-500 shrink-0">{d.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function KeyInfoSection({ keyInfo }: { keyInfo: ComprehensiveAnalysis['keyInfo'] }) {
  const hasData = keyInfo.dates.length > 0 || keyInfo.links.length > 0 || keyInfo.contacts.length > 0 || keyInfo.amounts.length > 0
  if (!hasData) return null

  const sections = [
    { icon: Calendar, label: 'Dates', items: keyInfo.dates },
    { icon: Link2, label: 'Links', items: keyInfo.links },
    { icon: Users, label: 'Contacts', items: keyInfo.contacts },
    { icon: DollarSign, label: 'Amounts', items: keyInfo.amounts },
  ].filter(s => s.items.length > 0)

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5" /> Key Information
      </p>
      <div className="grid grid-cols-2 gap-2">
        {sections.map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-2.5">
            <p className="text-[11px] font-medium text-gray-400 flex items-center gap-1 mb-1">
              <s.icon className="w-3 h-3" />{s.label}
            </p>
            {s.items.map((item, i) => (
              <p key={i} className="text-xs text-gray-700 truncate">{item}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function FollowUpSection({ needed, suggestion }: { needed: boolean; suggestion: string }) {
  if (!needed) return null
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
      <Clock className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-orange-800">Follow-up needed</p>
        {suggestion && <p className="text-xs text-orange-600 mt-0.5">{suggestion}</p>}
      </div>
    </div>
  )
}

// --- Chat Component ---

function AIChatPanel({ thread }: { thread: Thread | null }) {
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return
    const userMsg: AIChatMessage = {
      id: crypto.randomUUID(), role: 'user', content: input.trim(), timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, threadId: thread?.id ?? null })
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant', content: data.reply ?? data.error ?? 'No response',
        timestamp: new Date().toISOString()
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant', content: 'Failed to get response. Please try again.',
        timestamp: new Date().toISOString()
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, thread])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Ask me anything about {thread ? 'this email' : 'your emails'}
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-gray-100 p-3 flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask about this email..."
          className="text-sm"
        />
        <Button size="sm" onClick={sendMessage} disabled={loading || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

// --- Main Inbox Page ---

export default function InboxPage() {
  const [threads] = useState<Thread[]>(mockThreads)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<Record<string, ComprehensiveAnalysis>>({})
  const [loadingThreads, setLoadingThreads] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | EmailCategory>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all')
  const [showChat, setShowChat] = useState(false)
  const [activeTab, setActiveTab] = useState<'analysis' | 'emails'>('analysis')

  const selectedThread = threads.find(t => t.id === selectedId) ?? null

  // Load cached analyses
  useEffect(() => { setAnalyses(loadAnalyses()) }, [])

  // Analyze on select
  const analyzeThread = useCallback(async (threadId: string) => {
    if (analyses[threadId] || loadingThreads.has(threadId)) return
    setLoadingThreads(prev => new Set(prev).add(threadId))

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId })
      })
      if (!res.ok) throw new Error('Analysis failed')
      const data: ComprehensiveAnalysis = await res.json()
      setAnalyses(prev => {
        const updated = { ...prev, [threadId]: data }
        saveAnalyses(updated)
        return updated
      })
    } catch (err) {
      console.error('Analysis error:', err)
    } finally {
      setLoadingThreads(prev => {
        const next = new Set(prev)
        next.delete(threadId)
        return next
      })
    }
  }, [analyses, loadingThreads])

  const handleSelectThread = useCallback((threadId: string) => {
    setSelectedId(threadId)
    setActiveTab('analysis')
    analyzeThread(threadId)
  }, [analyzeThread])

  // Filtered threads
  const filteredThreads = threads.filter(t => {
    if (search) {
      const q = search.toLowerCase()
      if (!t.subject.toLowerCase().includes(q) && !t.from.name.toLowerCase().includes(q) && !t.preview.toLowerCase().includes(q)) return false
    }
    if (categoryFilter !== 'all') {
      const a = analyses[t.id]
      const cat = a ? a.category : t.category
      if (cat !== categoryFilter) return false
    }
    if (priorityFilter !== 'all') {
      const a = analyses[t.id]
      if (!a || a.priority !== priorityFilter) return false
    }
    return true
  })

  const selectedAnalysis = selectedId ? analyses[selectedId] : null
  const isLoadingSelected = selectedId ? loadingThreads.has(selectedId) : false

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top bar */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm h-14 flex items-center px-4 gap-4 shrink-0">
        <NextLink href="/" className="hover:opacity-80 transition-opacity">
          <Logo size="sm" />
        </NextLink>

        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search emails..."
            className="pl-9 text-sm h-9 bg-gray-50 border-gray-200"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value as 'all' | EmailCategory)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="work">Work</option>
            <option value="personal">Personal</option>
            <option value="finance">Finance</option>
            <option value="updates">Updates</option>
            <option value="spam">Spam</option>
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value as 'all' | Priority)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="important">Important</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          <Button variant="outline" size="sm" onClick={() => setShowChat(!showChat)}
            className={showChat ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}>
            <Bot className="w-4 h-4 mr-1" /> AI Chat
          </Button>
        </div>
      </header>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thread list */}
        <aside className="w-80 border-r border-gray-100 flex flex-col shrink-0">
          <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">
              {filteredThreads.length} conversation{filteredThreads.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filteredThreads.map(t => (
              <ThreadListItem
                key={t.id}
                thread={t}
                selected={t.id === selectedId}
                analysis={analyses[t.id]}
                onClick={() => handleSelectThread(t.id)}
              />
            ))}
            {filteredThreads.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm">
                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No emails match your filters
              </div>
            )}
          </div>
        </aside>

        {/* Content area */}
        <main className="flex-1 flex overflow-hidden">
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select an email to analyze</p>
                <p className="text-xs mt-1">MailMate will extract insights with AI</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Thread header */}
              <div className="px-6 py-4 border-b border-gray-100 shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">{selectedThread.subject}</h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {selectedThread.from.name} &middot; {selectedThread.emails.length} message{selectedThread.emails.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {selectedAnalysis && (
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={selectedAnalysis.priority} />
                      <SenderBadge importance={selectedAnalysis.senderImportance} />
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mt-3">
                  <button onClick={() => setActiveTab('analysis')}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                      activeTab === 'analysis' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}>
                    <Sparkles className="w-3.5 h-3.5 inline mr-1" />AI Analysis
                  </button>
                  <button onClick={() => setActiveTab('emails')}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                      activeTab === 'emails' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}>
                    <Mail className="w-3.5 h-3.5 inline mr-1" />Emails ({selectedThread.emails.length})
                  </button>
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'analysis' ? (
                  <div className="p-6 space-y-5 max-w-3xl">
                    {isLoadingSelected ? (
                      <div className="py-16 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Analyzing email with AI...</p>
                        <p className="text-xs text-gray-400 mt-1">Extracting insights, tasks, meetings, and more</p>
                      </div>
                    ) : selectedAnalysis ? (
                      <>
                        <SummarySection analysis={selectedAnalysis} />
                        <FollowUpSection needed={selectedAnalysis.followUpNeeded} suggestion={selectedAnalysis.followUpSuggestion} />
                        <SmartRepliesSection replies={selectedAnalysis.smartReplies} />
                        <DraftReplySection draft={selectedAnalysis.draftReply} />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          <MeetingsSection meetings={selectedAnalysis.meetings} />
                          <TasksSection tasks={selectedAnalysis.tasks} />
                        </div>
                        <DeadlinesSection deadlines={selectedAnalysis.deadlines} />
                        <KeyInfoSection keyInfo={selectedAnalysis.keyInfo} />
                      </>
                    ) : (
                      <div className="py-16 text-center text-gray-400">
                        <p className="text-sm">Analysis unavailable. Try refreshing.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 space-y-4 max-w-3xl">
                    {selectedThread.emails.map((email, idx) => (
                      <div key={email.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                              email.from.email.includes('you@') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {email.from.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{email.from.name}</p>
                              <p className="text-xs text-gray-400">{email.from.email}</p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-400">{timeAgo(email.timestamp)}</span>
                        </div>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{email.body}</div>
                        {email.attachments && email.attachments.length > 0 && (
                          <div className="mt-3 flex gap-2">
                            {email.attachments.map(a => (
                              <span key={a.name} className="inline-flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600">
                                <FileText className="w-3 h-3" />{a.name} <span className="text-gray-400">({a.size})</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Chat sidebar */}
          {showChat && (
            <aside className="w-80 border-l border-gray-100 flex flex-col shrink-0">
              <div className="h-12 border-b border-gray-100 flex items-center justify-between px-4">
                <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-blue-600" /> AI Assistant
                </span>
                <button onClick={() => setShowChat(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <AIChatPanel thread={selectedThread} />
            </aside>
          )}
        </main>
      </div>
    </div>
  )
}
