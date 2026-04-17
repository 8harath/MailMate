import { useCallback } from 'react'
import { ComprehensiveAnalysis, ThreadMeta } from '@/types'

export const STORAGE_KEYS = {
  ANALYSES: 'mailmate-analyses',
  META: 'mailmate-thread-meta',
  SIDEBAR_PINNED: 'mailmate-sidebar-pinned',
  LABELS: 'mailmate-user-labels',
} as const

export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or private browsing — fail silently
  }
}

export function removeJson(key: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function loadAnalyses(): Record<string, ComprehensiveAnalysis> {
  const data = loadJson<Record<string, ComprehensiveAnalysis>>(STORAGE_KEYS.ANALYSES, {})
  const first = Object.values(data)[0] as unknown as Record<string, unknown> | undefined
  if (first && !('summary' in first && 'smartReplies' in first)) {
    removeJson(STORAGE_KEYS.ANALYSES)
    return {}
  }
  return data
}

export const DEFAULT_META: ThreadMeta = {
  read: false,
  starred: false,
  snoozedUntil: null,
  archived: false,
  trashed: false,
  draft: '',
  userLabels: [],
}

export function useInboxStorage() {
  const getAnalysis = useCallback((threadId: string): ComprehensiveAnalysis | null => {
    const all = loadAnalyses()
    return all[threadId] ?? null
  }, [])

  const saveAnalysis = useCallback((threadId: string, analysis: ComprehensiveAnalysis) => {
    const all = loadAnalyses()
    saveJson(STORAGE_KEYS.ANALYSES, { ...all, [threadId]: analysis })
  }, [])

  const getAllMeta = useCallback((): Record<string, Partial<ThreadMeta>> => {
    return loadJson<Record<string, Partial<ThreadMeta>>>(STORAGE_KEYS.META, {})
  }, [])

  const getMeta = useCallback((threadId: string): ThreadMeta => {
    const all = loadJson<Record<string, Partial<ThreadMeta>>>(STORAGE_KEYS.META, {})
    return { ...DEFAULT_META, ...(all[threadId] ?? {}) }
  }, [])

  const saveMeta = useCallback((threadId: string, patch: Partial<ThreadMeta>) => {
    const all = loadJson<Record<string, Partial<ThreadMeta>>>(STORAGE_KEYS.META, {})
    const current = all[threadId] ?? {}
    saveJson(STORAGE_KEYS.META, { ...all, [threadId]: { ...current, ...patch } })
  }, [])

  const getLabels = useCallback((): string[] => {
    return loadJson<string[]>(STORAGE_KEYS.LABELS, [])
  }, [])

  const saveLabels = useCallback((labels: string[]) => {
    saveJson(STORAGE_KEYS.LABELS, labels)
  }, [])

  return { getAnalysis, saveAnalysis, getAllMeta, getMeta, saveMeta, getLabels, saveLabels }
}
