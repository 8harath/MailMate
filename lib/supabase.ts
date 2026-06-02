import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from './logger'

const log = createLogger('supabase')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Only create clients if env vars are set
let supabase: SupabaseClient | null = null
let supabaseAdmin: SupabaseClient | null = null

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
  supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : supabase
}

export { supabase, supabaseAdmin }

// ─── Database helpers ──────────────────────────────────────────
//
// Writers return `true` on success (including the no-op case when Supabase is
// not configured, since there is nothing to persist) and `false` when a
// configured Supabase call actually fails, so callers can surface the failure.

export async function upsertUser(user: { id: string; email: string; name: string; image?: string }): Promise<boolean> {
  if (!supabaseAdmin) return true
  const { error } = await supabaseAdmin.from('users').upsert({
    id: user.id, email: user.email, name: user.name,
    avatar_url: user.image ?? null, updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (error) {
    log.error('upsertUser failed', error)
    return false
  }
  return true
}

export async function saveAnalysis(userId: string, threadId: string, gmailThreadId: string, analysis: Record<string, unknown>): Promise<boolean> {
  if (!supabaseAdmin) return true
  const { error } = await supabaseAdmin.from('analyses').upsert({
    user_id: userId, thread_id: threadId, gmail_thread_id: gmailThreadId,
    analysis_data: analysis, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,thread_id' })
  if (error) {
    log.error('saveAnalysis failed', error)
    return false
  }
  return true
}

export async function getAnalysis(userId: string, threadId: string) {
  if (!supabaseAdmin) return null
  const { data } = await supabaseAdmin.from('analyses')
    .select('analysis_data').eq('user_id', userId).eq('thread_id', threadId).single()
  return data?.analysis_data ?? null
}

export async function saveThreadMeta(userId: string, threadId: string, meta: Record<string, unknown>): Promise<boolean> {
  if (!supabaseAdmin) return true
  const { error } = await supabaseAdmin.from('thread_meta').upsert({
    user_id: userId, thread_id: threadId, ...meta, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,thread_id' })
  if (error) {
    log.error('saveThreadMeta failed', error)
    return false
  }
  return true
}

export async function getThreadMetas(userId: string) {
  if (!supabaseAdmin) return []
  const { data } = await supabaseAdmin.from('thread_meta').select('*').eq('user_id', userId)
  return data ?? []
}

export async function getUserLabels(userId: string) {
  if (!supabaseAdmin) return []
  const { data } = await supabaseAdmin.from('user_labels').select('*').eq('user_id', userId).order('name')
  return data ?? []
}

export async function createUserLabel(userId: string, name: string) {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin.from('user_labels').insert({ user_id: userId, name }).select().single()
  if (error) log.error('createUserLabel failed', error)
  return data
}

export async function deleteUserLabel(userId: string, labelId: string): Promise<boolean> {
  if (!supabaseAdmin) return true
  const { error } = await supabaseAdmin.from('user_labels').delete().eq('id', labelId).eq('user_id', userId)
  if (error) {
    log.error('deleteUserLabel failed', error)
    return false
  }
  return true
}
