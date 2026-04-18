import { AgentMemoryEntry, MemoryCategory } from '@/types'

// Use Prisma when DATABASE_URL is set, fall back to Supabase adapter.
async function getAdapter() {
  if (process.env.DATABASE_URL) {
    const { prisma } = await import('./db')
    return { type: 'prisma' as const, db: prisma }
  }
  const { supabaseAdmin } = await import('./supabase')
  return { type: 'supabase' as const, db: supabaseAdmin }
}

export async function getMemories(
  userId: string,
  category?: MemoryCategory
): Promise<AgentMemoryEntry[]> {
  const adapter = await getAdapter()

  if (adapter.type === 'prisma') {
    const rows = await adapter.db.agentMemory.findMany({
      where: { userId, ...(category ? { category } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    })
    return rows.map(rowToEntry)
  }

  if (!adapter.db) return []
  let query = adapter.db
    .from('agent_memory')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(30)
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) { console.error('getMemories error:', error); return [] }
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
  const adapter = await getAdapter()

  if (adapter.type === 'prisma') {
    const row = await adapter.db.agentMemory.upsert({
      where: { userId_category_key: { userId, category: entry.category, key: entry.key } },
      create: {
        userId, category: entry.category, key: entry.key, value: entry.value,
        confidence: entry.confidence ?? 1.0, sourceMessage: entry.source_message ?? null,
      },
      update: {
        value: entry.value, confidence: entry.confidence ?? 1.0,
        sourceMessage: entry.source_message ?? null,
      },
    })
    return rowToEntry(row)
  }

  if (!adapter.db) return null
  const { data, error } = await adapter.db
    .from('agent_memory')
    .upsert({
      user_id: userId, category: entry.category, key: entry.key, value: entry.value,
      confidence: entry.confidence ?? 1.0, source_message: entry.source_message ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,category,key' })
    .select().single()
  if (error) { console.error('storeMemory error:', error); return null }
  return data as AgentMemoryEntry
}

export async function deleteMemory(userId: string, memoryId: string): Promise<boolean> {
  const adapter = await getAdapter()

  if (adapter.type === 'prisma') {
    await adapter.db.agentMemory.deleteMany({ where: { id: memoryId, userId } })
    return true
  }

  if (!adapter.db) return false
  const { error } = await adapter.db
    .from('agent_memory').delete().eq('id', memoryId).eq('user_id', userId)
  if (error) { console.error('deleteMemory error:', error); return false }
  return true
}

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  sender_preference: 'Sender Preference',
  priority_rule: 'Priority Rule',
  scheduling_preference: 'Scheduling Preference',
  writing_style: 'Writing Style',
  automation_rule: 'Automation Rule',
  general: 'General Preference',
}

export async function formatMemoryContext(userId: string): Promise<string> {
  const memories = await getMemories(userId)
  if (memories.length === 0) return ''
  const lines = memories.map((m) => `- [${CATEGORY_LABELS[m.category]}] ${m.key}: ${m.value}`)
  return `\n## Learned user preferences (use these to personalize your responses):\n${lines.join('\n')}\n`
}

function rowToEntry(row: {
  id: string; userId: string; category: string; key: string; value: string;
  confidence: number; sourceMessage: string | null; createdAt: Date; updatedAt: Date;
}): AgentMemoryEntry {
  return {
    id: row.id,
    user_id: row.userId,
    category: row.category as MemoryCategory,
    key: row.key,
    value: row.value,
    confidence: row.confidence,
    source_message: row.sourceMessage ?? undefined,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}
