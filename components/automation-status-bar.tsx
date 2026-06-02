'use client'

import { Zap, CheckCheck, Clock, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface AutomationStatusBarProps {
  autoExecuted: number
  pendingCount: number
  isRunning: boolean
  onOpenQueue: () => void
}

export function AutomationStatusBar({
  autoExecuted,
  pendingCount,
  isRunning,
  onOpenQueue,
}: AutomationStatusBarProps) {
  if (!isRunning && autoExecuted === 0 && pendingCount === 0) return null

  return (
    <div className="px-4 py-2 border-b border-gray-100 bg-gradient-to-r from-violet-50/80 to-blue-50/80 flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-1.5">
        <Zap className={`w-3.5 h-3.5 ${isRunning ? 'text-violet-500 animate-pulse' : 'text-violet-400'}`} />
        <span className="text-xs font-semibold text-violet-700">
          {isRunning ? 'Automation running...' : 'Automation'}
        </span>
      </div>

      {autoExecuted > 0 && (
        <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] gap-1">
          <CheckCheck className="w-3 h-3" />
          {autoExecuted} auto-handled
        </Badge>
      )}

      {pendingCount > 0 && (
        <button
          onClick={onOpenQueue}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <Clock className="w-3 h-3" />
          {pendingCount} need{pendingCount === 1 ? 's' : ''} approval
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
