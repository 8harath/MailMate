import { supabaseAdmin } from './supabase'
import { AutomationAction, AutomationSettings } from '@/types'
import { DEFAULT_SETTINGS } from './automation-engine'

// ─── Action queue persistence ─────────────────────────────────

export async function saveActions(
  userId: string,
  actions: AutomationAction[]
): Promise<void> {
  if (!supabaseAdmin || actions.length === 0) return

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

  if (error) console.error('saveActions error:', error)
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
    console.error('getActions error:', error)
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
): Promise<void> {
  if (!supabaseAdmin) return

  const update: Record<string, unknown> = { status }
  if (status === 'executed') update.executed_at = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('automation_actions')
    .update(update)
    .eq('id', actionId)
    .eq('user_id', userId)

  if (error) console.error('updateActionStatus error:', error)
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
    console.error('getRecentActions error:', error)
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
): Promise<void> {
  if (!supabaseAdmin) return

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

  if (error) console.error('saveAutomationSettings error:', error)
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
