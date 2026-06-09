'use client'

import { useEffect, useState } from 'react'
import { Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

interface Row {
  keys: string[]
  /** keys joined by "then" render as a sequence (G then I) */
  sequence?: boolean
  label: string
}

interface Section {
  title: string
  rows: Row[]
}

function buildSections(mod: string): Section[] {
  return [
    {
      title: 'Navigation',
      rows: [
        { keys: ['J', 'K'], label: 'Move down / up the list' },
        { keys: ['Enter'], label: 'Open the focused conversation' },
        { keys: ['Esc'], label: 'Close conversation · clear focus' },
        { keys: ['/'], label: 'Focus search' },
        { keys: [mod, 'K'], label: 'Open command palette' },
        { keys: ['G', 'I'], sequence: true, label: 'Go to Inbox' },
        { keys: ['G', 'S'], sequence: true, label: 'Go to Starred' },
        { keys: ['G', 'T'], sequence: true, label: 'Go to Sent' },
        { keys: ['G', 'C'], sequence: true, label: 'Go to Calendar' },
      ],
    },
    {
      title: 'On the open conversation',
      rows: [
        { keys: ['E'], label: 'Archive' },
        { keys: ['S'], label: 'Star / unstar' },
        { keys: ['#'], label: 'Move to trash' },
        { keys: ['U'], label: 'Mark as unread' },
        { keys: ['B'], label: 'Snooze' },
        { keys: ['A'], label: 'Toggle AI analysis' },
      ],
    },
    {
      title: 'General',
      rows: [
        { keys: ['C'], label: 'Compose a new email' },
        { keys: ['Shift', 'A'], label: 'Toggle the AI chat panel' },
        { keys: [mod, 'Enter'], label: 'Send (while composing)' },
        { keys: ['?'], label: 'Show this shortcuts panel' },
      ],
    },
  ]
}

function KeyCombo({ row }: { row: Row }) {
  return (
    <span className="flex items-center gap-1">
      {row.keys.map((k, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && row.sequence && (
            <span className="text-[10px] font-medium text-muted-foreground">then</span>
          )}
          <Kbd className="h-6 min-w-6 border border-border bg-card px-1.5 font-mono text-[11px] text-foreground shadow-sm">
            {k}
          </Kbd>
        </span>
      ))}
    </span>
  )
}

export function ShortcutsHelp({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [mod, setMod] = useState('Ctrl')
  useEffect(() => {
    if (typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)) {
      setMod('⌘')
    }
  }, [])

  const sections = buildSections(mod)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden rounded-2xl border-border p-0 shadow-2xl">
        <DialogHeader className="border-b border-border bg-secondary/40 px-6 py-5">
          <DialogTitle className="flex items-center gap-2.5 font-display text-xl">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Keyboard className="size-5" />
            </span>
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription className="mt-1">
            Move through your inbox without leaving the keyboard.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-x-10 gap-y-7 px-6 py-6 sm:grid-cols-2">
          {sections.map(section => (
            <div key={section.title} className={section.title === 'Navigation' ? 'sm:row-span-2' : ''}>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {section.title}
              </p>
              <ul className="space-y-2.5">
                {section.rows.map(row => (
                  <li key={row.label} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-foreground">{row.label}</span>
                    <KeyCombo row={row} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border bg-secondary/30 px-6 py-3 text-center text-xs text-muted-foreground">
          Press <Kbd className="mx-0.5 h-5 border border-border bg-card font-mono text-[10px]">?</Kbd> anytime to reopen this panel
        </div>
      </DialogContent>
    </Dialog>
  )
}
