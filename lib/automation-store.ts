import { supabaseAdmin } from './supabase'
import { AutomationAction, AutomationSettings } from '@/types'
import { DEFAULT_SETTINGS } from './automation-engine'
import { createLogger } from './logger'

const log = createLogger('automation-store')

// ─── Action queue persistence ─────────────────────────────────
//
// Writers return `true` on success (including the no-op case when Supabase is
// not configured) and `false` when a configured call fails, so callers can
// surface the failure rather than assume the write landed.

export async function saveActions(
  userId: string,
  actions: AutomationAction[]
): Promise<boolean> {
  if (!supabaseAdmin || actions.length === 0) return true

  const rows = actions.map((a) => ({
    id: a.id,
    user_id: userId,
    thread_id: a.threadId,
    type: a.type,
    risk_level: a.riskLevel,
    status: a.status,
    payload: a.payload,
    reason: a.reason,
    thread_subject: a.threadSubject ?? null,
    thread_from: a.threadFrom ?? null,
    created_at: a.createdAt,
    executed_at: a.executedAt ?? null,
  }))

  const { error } = await supabaseAdmin
    .from('automation_actions')
    .upsert(rows, { onConflict: 'id' })

  if (error) {
    log.error('saveActions failed', error)
    return false
  }
  return true
}

export async function getActions(
  userId: string,
  filter?: { status?: string; riskLevel?: string }
): Promise<AutomationAction[]> {
  if (!supabaseAdmin) return []

  let query = supabaseAdmin
    .from('automation_actions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (filter?.status) query = query.eq('status', filter.status)
  if (filter?.riskLevel) query = query.eq('risk_level', filter.riskLevel)

  const { data, error } = await query
  if (error) {
    log.error('getActions failed', error)
    return []
  }

  return (data ?? []).map(mapRowToAction)
}

export async function getPendingApprovals(
  userId: string
): Promise<AutomationAction[]> {
  return getActions(userId, { status: 'pending', riskLevel: 'confirm' })
}

export async function updateActionStatus(
  userId: string,
  actionId: string,
  status: 'approved' | 'rejected' | 'executed' | 'undone'
): Promise<boolean> {
  if (!supabaseAdmin) return true

  const update: Record<string, unknown> = { status }
  if (status === 'executed') update.executed_at = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('automation_actions')
    .update(update)
    .eq('id', actionId)
    .eq('user_id', userId)

  if (error) {
    log.error('updateActionStatus failed', error)
    return false
  }
  return true
}

export async function getRecentActions(
  userId: string,
  limit = 20
): Promise<AutomationAction[]> {
  if (!supabaseAdmin) return []

  const { data, error } = await supabaseAdmin
    .from('automation_actions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['executed', 'approved', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    log.error('getRecentActions failed', error)
    return []
  }

  return (data ?? []).map(mapRowToAction)
}

// ─── Settings persistence ─────────────────────────────────────

export async function getAutomationSettings(
  userId: string
): Promise<AutomationSettings> {
  if (!supabaseAdmin) return DEFAULT_SETTINGS

  const { data } = await supabaseAdmin
    .from('automation_settings')
    .select('settings')
    .eq('user_id', userId)
    .single()

  if (!data?.settings) return DEFAULT_SETTINGS
  return { ...DEFAULT_SETTINGS, ...(data.settings as Partial<AutomationSettings>) }
}

export async function saveAutomationSettings(
  userId: string,
  settings: AutomationSettings
): Promise<boolean> {
  if (!supabaseAdmin) return true

  const { error } = await supabaseAdmin
    .from('automation_settings')
    .upsert(
      {
        user_id: userId,
        settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    log.error('saveAutomationSettings failed', error)
    return false
  }
  return true
}

// ─── Row mapper ───────────────────────────────────────────────

function mapRowToAction(row: Record<string, unknown>): AutomationAction {
  return {
    id: row.id as string,
    threadId: row.thread_id as string,
    type: row.type as AutomationAction['type'],
    riskLevel: row.risk_level as AutomationAction['riskLevel'],
    status: row.status as AutomationAction['status'],
    payload: (row.payload ?? {}) as Record<string, unknown>,
    reason: row.reason as string,
    createdAt: row.created_at as string,
    executedAt: (row.executed_at as string) ?? undefined,
    threadSubject: (row.thread_subject as string) ?? undefined,
    threadFrom: (row.thread_from as AutomationAction['threadFrom']) ?? undefined,
  }
}
