import { supabaseAdmin } from './supabase'
import { AgentMemoryEntry, MemoryCategory } from '@/types'

// ─── CRUD for agent_memory table ──────────────────────────────

export async function getMemories(
  userId: string,
  category?: MemoryCategory
): Promise<AgentMemoryEntry[]> {
  if (!supabaseAdmin) return []

  let query = supabaseAdmin
    .from('agent_memory')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(30)

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) {
    console.error('getMemories error:', error)
    return []
  }
  return (data ?? []) as AgentMemoryEntry[]
}

export async function storeMemory(
  userId: string,
  entry: {
    category: MemoryCategory
    key: string
    value: string
    confidence?: number
    source_message?: string
  }
): Promise<AgentMemoryEntry | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('agent_memory')
    .upsert(
      {
        user_id: userId,
        category: entry.category,
        key: entry.key,
        value: entry.value,
        confidence: entry.confidence ?? 1.0,
        source_message: entry.source_message ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,category,key' }
    )
    .select()
    .single()

  if (error) {
    console.error('storeMemory error:', error)
    return null
  }
  return data as AgentMemoryEntry
}

export async function deleteMemory(
  userId: string,
  memoryId: string
): Promise<boolean> {
  if (!supabaseAdmin) return false

  const { error } = await supabaseAdmin
    .from('agent_memory')
    .delete()
    .eq('id', memoryId)
    .eq('user_id', userId)

  if (error) {
    console.error('deleteMemory error:', error)
    return false
  }
  return true
}

// ─── Format memories into a context string for LLM prompts ────

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  sender_preference: 'Sender Preference',
  priority_rule: 'Priority Rule',
  scheduling_preference: 'Scheduling Preference',
  writing_style: 'Writing Style',
  general: 'General Preference',
}

export async function formatMemoryContext(userId: string): Promise<string> {
  const memories = await getMemories(userId)
  if (memories.length === 0) return ''

  const lines = memories.map(
    (m) => `- [${CATEGORY_LABELS[m.category]}] ${m.key}: ${m.value}`
  )

  return `\n## Learned user preferences (use these to personalize your responses):\n${lines.join('\n')}\n`
}
