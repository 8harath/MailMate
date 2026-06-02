'use client'

import { useState } from 'react'
import {
  X, Check, XCircle, Loader2, Zap,
  Mail, Archive, Tag, Calendar, Clock,
  Send, Trash2, ListChecks, BookOpen,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AutomationAction } from '@/types'

const actionIcons: Record<string, typeof Mail> = {
  auto_reply: Send,
  auto_archive: Archive,
  auto_label: Tag,
  auto_mark_read: BookOpen,
  auto_calendar_add: Calendar,
  auto_snooze: Clock,
  auto_task_extract: ListChecks,
  confirm_send_reply: Send,
  confirm_calendar_external: Calendar,
  confirm_trash: Trash2,
}

const actionLabels: Record<string, string> = {
  auto_reply: 'Send Reply',
  auto_archive: 'Archive Thread',
  auto_label: 'Apply Label',
  auto_mark_read: 'Mark as Read',
  auto_calendar_add: 'Add to Calendar',
  auto_snooze: 'Snooze Thread',
  auto_task_extract: 'Extract Tasks',
  confirm_send_reply: 'Send Reply',
  confirm_calendar_external: 'Add Calendar Event',
  confirm_trash: 'Move to Trash',
}

const riskColors: Record<string, string> = {
  auto: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  confirm: 'border-amber-200 bg-amber-50 text-amber-700',
  notify: 'border-blue-200 bg-blue-50 text-blue-700',
}

interface ApprovalQueueProps {
  pendingActions: AutomationAction[]
  recentActions: AutomationAction[]
  onApprove: (actionId: string) => Promise<void>
  onReject: (actionId: string) => Promise<void>
  onClose: () => void
}

export function ApprovalQueue({
  pendingActions,
  recentActions,
  onApprove,
  onReject,
  onClose,
}: ApprovalQueueProps) {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const handleAction = async (actionId: string, action: 'approve' | 'reject') => {
    setProcessingIds(prev => new Set(prev).add(actionId))
    try {
      if (action === 'approve') {
        await onApprove(actionId)
      } else {
        await onReject(actionId)
      }
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(actionId)
        return next
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-96 max-w-full bg-white shadow-2xl border-l border-gray-200 flex flex-col h-full animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Automation Queue</h2>
              <p className="text-[11px] text-gray-500">
                {pendingActions.length} pending &middot; {recentActions.length} recent
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-5">
            {/* Pending Approvals */}
            {pendingActions.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 px-1">
                  Needs Your Approval
                </p>
                <div className="space-y-2.5">
                  {pendingActions.map(action => {
                    const Icon = actionIcons[action.type] ?? Zap
                    const isProcessing = processingIds.has(action.id)

                    return (
                      <div
                        key={action.id}
                        className="border border-gray-200 rounded-xl p-3.5 bg-white shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                            <Icon className="w-4 h-4 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-900">
                                {actionLabels[action.type] ?? action.type}
                              </span>
                              <Badge variant="outline" className={`rounded-full text-[9px] ${riskColors[action.riskLevel]}`}>
                                {action.riskLevel}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed mb-1.5">
                              {action.reason}
                            </p>
                            {action.threadSubject && (
                              <p className="text-[11px] text-gray-400 truncate">
                                Re: {action.threadSubject}
                              </p>
                            )}
                            {action.payload?.body ? (
                              <div className="mt-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                <p className="text-[11px] text-gray-600 line-clamp-3">
                                  {String(action.payload.body)}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3 pl-12">
                          <Button
                            size="sm"
                            onClick={() => handleAction(action.id, 'approve')}
                            disabled={isProcessing}
                            className="flex-1 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1" /> Approve
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(action.id, 'reject')}
                            disabled={isProcessing}
                            className="flex-1 h-8 rounded-lg text-xs font-semibold border-gray-200 text-gray-600 hover:bg-red-50 hover:border-red-200 hover:text-red-700"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {pendingActions.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-gray-700">All clear</p>
                <p className="text-xs text-gray-400 mt-1">No actions need your approval right now.</p>
              </div>
            )}

            {/* Recent Activity */}
            {recentActions.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 px-1">
                  Recent Activity
                </p>
                <div className="space-y-1.5">
                  {recentActions.slice(0, 15).map(action => {
                    const Icon = actionIcons[action.type] ?? Zap
                    const statusColors: Record<string, string> = {
                      executed: 'text-emerald-600 bg-emerald-50',
                      approved: 'text-emerald-600 bg-emerald-50',
                      rejected: 'text-red-500 bg-red-50',
                      pending: 'text-amber-600 bg-amber-50',
                      undone: 'text-gray-500 bg-gray-50',
                    }

                    return (
                      <div
                        key={action.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${statusColors[action.status] ?? 'text-gray-400 bg-gray-50'}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">
                            {actionLabels[action.type] ?? action.type}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">{action.reason}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`rounded-full text-[9px] shrink-0 ${
                            action.status === 'executed' || action.status === 'approved'
                              ? 'border-emerald-200 text-emerald-600'
                              : action.status === 'rejected'
                              ? 'border-red-200 text-red-500'
                              : 'border-gray-200 text-gray-500'
                          }`}
                        >
                          {action.status}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
