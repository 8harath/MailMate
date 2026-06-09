'use client'

import type { LucideIcon } from 'lucide-react'
import { Mail } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'

export interface PaletteAction {
  id: string
  label: string
  group: string
  icon: LucideIcon
  hint?: string
  keywords?: string
  disabled?: boolean
  perform: () => void
}

export interface PaletteThread {
  id: string
  subject: string
  from: string
  unread?: boolean
}

export function CommandPalette({
  open,
  onOpenChange,
  actions,
  threads,
  onOpenThread,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: PaletteAction[]
  threads: PaletteThread[]
  onOpenThread: (id: string) => void
}) {
  // Group actions in declared order
  const groups: { name: string; items: PaletteAction[] }[] = []
  for (const action of actions) {
    let group = groups.find(g => g.name === action.group)
    if (!group) {
      group = { name: action.group, items: [] }
      groups.push(group)
    }
    group.items.push(action)
  }

  const run = (fn: () => void) => {
    onOpenChange(false)
    // Defer so the dialog can close before focus moves / state changes
    requestAnimationFrame(fn)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Search for a command or jump to a conversation"
      className="max-w-xl rounded-2xl border-border shadow-2xl"
    >
      <CommandInput placeholder="Type a command or search conversations…" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>No matches found.</CommandEmpty>

        {groups.map((group, i) => (
          <div key={group.name}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={group.name}>
              {group.items.map(action => (
                <CommandItem
                  key={action.id}
                  value={`${action.label} ${action.keywords ?? ''}`}
                  disabled={action.disabled}
                  onSelect={() => run(action.perform)}
                  className="gap-3 rounded-lg"
                >
                  <action.icon className="size-4 text-muted-foreground" />
                  <span className="font-medium">{action.label}</span>
                  {action.hint && <CommandShortcut>{action.hint}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}

        {threads.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Jump to conversation">
              {threads.map(thread => (
                <CommandItem
                  key={thread.id}
                  value={`thread ${thread.subject} ${thread.from}`}
                  onSelect={() => run(() => onOpenThread(thread.id))}
                  className="gap-3 rounded-lg"
                >
                  <Mail className={`size-4 ${thread.unread ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="flex min-w-0 flex-col">
                    <span className={`truncate ${thread.unread ? 'font-semibold' : 'font-medium'}`}>
                      {thread.subject || '(no subject)'}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{thread.from}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
