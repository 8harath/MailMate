'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Send, Loader2, Network, Zap, ChevronDown, Brain, X, Trash2
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Thread, AIChatMessage, DelegationStep, AgentMemoryEntry } from '@/types'

// ─── Delegation badges ──────────────────────────────────────────

const DELEGATION_LABELS: Record<string, { label: string; color: string }> = {
  triage: { label: 'Triage Agent', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  scheduler: { label: 'Scheduling Agent', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  writer: { label: 'Email Assistant', color: 'bg-accent text-primary border-primary/20' },
  memory: { label: 'Memory', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
}

function DelegationBadges({ delegations }: { delegations?: DelegationStep[] }) {
  if (!delegations || delegations.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mb-1.5">
      {delegations.map((d, i) => {
        const info = DELEGATION_LABELS[d.agent] ?? DELEGATION_LABELS.writer
        return (
          <span key={i} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${info.color}`}>
            <Network className="w-2.5 h-2.5" />
            {info.label}
          </span>
        )
      })}
    </div>
  )
}

function AgentStepIndicator({ steps, delegations }: { steps?: AIChatMessage['steps']; delegations?: DelegationStep[] }) {
  const [expanded, setExpanded] = useState(false)
  const toolCalls = (steps ?? []).flatMap(s => s.toolCalls ?? [])
  const hasDelegations = delegations && delegations.length > 0
  if (toolCalls.length === 0 && !hasDelegations) return null
  return (
    <div className="mb-1">
      <DelegationBadges delegations={delegations} />
      {toolCalls.length > 0 && (
        <>
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 font-medium">
            <Zap className="w-3 h-3" />
            Used {toolCalls.length} tool{toolCalls.length > 1 ? 's' : ''}
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          {expanded && (
            <div className="mt-1.5 space-y-1">
              {toolCalls.map((tc, i) => (
                <div key={i} className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5 font-mono">
                  <span className="text-gray-700">{tc.name}</span>
                  {tc.args && Object.keys(tc.args).length > 0 && (
                    <span className="text-gray-400 ml-1">
                      ({Object.entries(tc.args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Memory panel ───────────────────────────────────────────────

export function MemoryPanel({ isGmail }: { isGmail?: boolean }) {
  const [memories, setMemories] = useState<AgentMemoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const loadMemories = useCallback(async () => {
    if (!isGmail) return
    setLoading(true)
    try {
      const res = await fetch('/api/agent/memory')
      const data = await res.json()
      setMemories(data.memories ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [isGmail])

  useEffect(() => {
    if (open) loadMemories()
  }, [open, loadMemories])

  const handleDelete = async (id: string) => {
    await fetch('/api/agent/memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setMemories(prev => prev.filter(m => m.id !== id))
    toast('Preference removed')
  }

  if (!isGmail) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        title="Agent Memory"
      >
        <Brain className={`w-4 h-4 ${memories.length > 0 ? 'text-emerald-500' : 'text-gray-400'}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-emerald-500" />
              Learned Preferences
            </span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-xs text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                Loading...
              </div>
            ) : memories.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">
                No preferences learned yet. Chat with the AI and tell it your preferences!
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {memories.map(m => (
                  <div key={m.id} className="group flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 mb-0.5">
                        {m.category.replace('_', ' ')}
                      </span>
                      <p className="text-gray-700 leading-tight">{m.value}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                      title="Remove preference"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AI Chat Panel ──────────────────────────────────────────────

export function AIChatPanel({ thread, isGmail }: { thread: Thread | null; isGmail?: boolean }) {
  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async () => {
    if (!input.trim() || loading) return
    const userMsg: AIChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        message: userMsg.content,
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      }
      if (thread) {
        if (isGmail) {
          payload.thread = thread
        } else {
          payload.threadId = thread.id
        }
      }
      const res = await fetch('/api/agent/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (data.memoriesStored && data.memoriesStored.length > 0) {
        for (const mem of data.memoriesStored) {
          toast('Preference learned', {
            description: mem.value,
            icon: <Brain className="w-4 h-4 text-emerald-500" />,
          })
        }
      }

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply ?? data.error ?? 'No response',
        timestamp: new Date().toISOString(),
        steps: data.steps,
        delegations: data.delegations,
        memoriesUsed: data.memoriesUsed,
        memoriesStored: data.memoriesStored,
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Failed to get response.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, thread, isGmail, messages])

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Network className="w-7 h-7 text-primary" />
            </div>
            <p className="font-medium text-muted-foreground">AI Orchestrator</p>
            <p className="text-xs mt-1 max-w-[200px] mx-auto">
              {isGmail
                ? 'Multi-agent system: triage inbox, schedule meetings, draft replies — with learned preferences'
                : 'Ask about this email'}
            </p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%]">
              {m.role === 'assistant' && (
                <AgentStepIndicator steps={m.steps} delegations={m.delegations} />
              )}
              <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-foreground'
              }`}>
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-2.5 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="text-xs text-gray-400">Orchestrator coordinating agents...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-gray-100 p-4 flex gap-2 shrink-0">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder={isGmail ? 'Search inbox, draft replies, check calendar...' : 'Ask about this email...'}
          className="text-sm rounded-xl"
        />
        <Button
          size="sm"
          onClick={send}
          disabled={loading || !input.trim()}
          className="rounded-xl bg-primary hover:bg-primary/90 px-3"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
