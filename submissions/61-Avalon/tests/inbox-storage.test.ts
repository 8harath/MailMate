import { describe, it, expect, beforeEach } from 'vitest'
import { loadJson, saveJson, removeJson, loadAnalyses, DEFAULT_META, STORAGE_KEYS } from '../hooks/use-inbox-storage'
import { ComprehensiveAnalysis, ThreadMeta } from '../types'

// jsdom provides localStorage — reset it between tests
beforeEach(() => {
  localStorage.clear()
})

describe('loadJson / saveJson', () => {
  it('returns fallback when key does not exist', () => {
    expect(loadJson('nonexistent', 42)).toBe(42)
    expect(loadJson<string[]>('array-key', [])).toEqual([])
  })

  it('round-trips JSON correctly', () => {
    const data = { foo: 'bar', num: 123 }
    saveJson('test-key', data)
    expect(loadJson('test-key', null)).toEqual(data)
  })

  it('returns fallback when stored value is malformed JSON', () => {
    localStorage.setItem('bad-key', '{not valid json}')
    expect(loadJson('bad-key', 'fallback')).toBe('fallback')
  })
})

describe('removeJson', () => {
  it('removes a key from localStorage', () => {
    saveJson('to-remove', 'value')
    removeJson('to-remove')
    expect(localStorage.getItem('to-remove')).toBeNull()
  })

  it('does not throw when key does not exist', () => {
    expect(() => removeJson('nonexistent')).not.toThrow()
  })
})

describe('loadAnalyses', () => {
  it('returns empty object when nothing stored', () => {
    expect(loadAnalyses()).toEqual({})
  })

  it('returns stored analyses when schema is valid', () => {
    const validAnalysis: Partial<ComprehensiveAnalysis> = {
      summary: ['bullet'],
      smartReplies: ['ok'],
      priority: 'normal',
      category: 'work',
    }
    localStorage.setItem(
      STORAGE_KEYS.ANALYSES,
      JSON.stringify({ 'thread-1': validAnalysis })
    )
    const result = loadAnalyses()
    expect(result['thread-1']).toBeDefined()
  })

  it('clears and returns empty when schema is stale (missing required fields)', () => {
    // Old schema without smartReplies
    localStorage.setItem(
      STORAGE_KEYS.ANALYSES,
      JSON.stringify({ 'thread-1': { summary: ['old format only'] } })
    )
    const result = loadAnalyses()
    expect(result).toEqual({})
    expect(localStorage.getItem(STORAGE_KEYS.ANALYSES)).toBeNull()
  })
})

describe('DEFAULT_META', () => {
  it('has all required ThreadMeta fields', () => {
    const requiredKeys: (keyof ThreadMeta)[] = [
      'read', 'starred', 'snoozedUntil', 'archived', 'trashed', 'draft', 'userLabels',
    ]
    for (const key of requiredKeys) {
      expect(DEFAULT_META).toHaveProperty(key)
    }
  })

  it('has safe defaults', () => {
    expect(DEFAULT_META.read).toBe(false)
    expect(DEFAULT_META.starred).toBe(false)
    expect(DEFAULT_META.archived).toBe(false)
    expect(DEFAULT_META.trashed).toBe(false)
    expect(DEFAULT_META.snoozedUntil).toBeNull()
    expect(DEFAULT_META.draft).toBe('')
    expect(DEFAULT_META.userLabels).toEqual([])
  })
})
