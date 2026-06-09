'use client'

import { useEffect, useRef } from 'react'

/**
 * A single keyboard binding.
 *
 * `combo` syntax (case-insensitive):
 *   - single key:        "j", "e", "?", "escape"
 *   - modifier + key:    "mod+k"  (mod = ⌘ on macOS, Ctrl elsewhere), "shift+u"
 *   - two-key sequence:  "g i"    (press g, then i within 1s — Gmail style)
 *   - multiple aliases:  ["enter", "o"]
 */
export interface Shortcut {
  combo: string | string[]
  handler: (e: KeyboardEvent) => void
  /** Fire even while a text field is focused (e.g. ⌘K, Escape). Default: false. */
  allowInInput?: boolean
  /** Call preventDefault when matched. Default: true. */
  preventDefault?: boolean
  /** Temporarily disable without removing. Default: enabled. */
  enabled?: boolean
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

function comboMatches(combo: string, e: KeyboardEvent): boolean {
  const parts = combo.toLowerCase().split('+')
  const key = parts[parts.length - 1]
  const wantMod = parts.includes('mod')
  const wantShift = parts.includes('shift')
  const wantAlt = parts.includes('alt')
  const hasMod = e.metaKey || e.ctrlKey

  if (wantMod !== hasMod) return false
  if (wantAlt !== e.altKey) return false
  if (wantShift && !e.shiftKey) return false

  return e.key.toLowerCase() === key
}

/**
 * Registers global keyboard shortcuts for the lifetime of the component.
 * Bindings are read from a ref, so the listener is attached once and always
 * sees the latest handlers without re-binding on every render.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  const ref = useRef(shortcuts)
  ref.current = shortcuts
  const pending = useRef<{ key: string; at: number } | null>(null)

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(e: KeyboardEvent) {
      // Ignore lone modifier presses
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return

      const typing = isTypingTarget(e.target)
      const active = ref.current.filter(s => s.enabled !== false)

      const flat: { s: Shortcut; combo: string }[] = []
      for (const s of active) {
        const combos = Array.isArray(s.combo) ? s.combo : [s.combo]
        for (const c of combos) flat.push({ s, combo: c })
      }

      const sequences = flat.filter(f => f.combo.includes(' '))
      const singles = flat.filter(f => !f.combo.includes(' '))
      const now = Date.now()

      // Resolve an in-flight sequence (e.g. the "i" in "g i")
      if (pending.current && now - pending.current.at < 1000) {
        const seq = `${pending.current.key} ${e.key}`.toLowerCase()
        const match = sequences.find(f => f.combo.toLowerCase() === seq)
        pending.current = null
        if (match && (!typing || match.s.allowInInput)) {
          if (match.s.preventDefault !== false) e.preventDefault()
          match.s.handler(e)
          return
        }
      }

      // Begin a sequence if this key is a known prefix
      const startsSequence =
        !typing &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        sequences.some(f => f.combo.toLowerCase().split(' ')[0] === e.key.toLowerCase())

      if (startsSequence) {
        pending.current = { key: e.key, at: now }
        e.preventDefault()
        return
      }

      // Single-key / modifier combos
      for (const f of singles) {
        if (!comboMatches(f.combo, e)) continue
        if (typing && !f.s.allowInInput) continue
        if (f.s.preventDefault !== false) e.preventDefault()
        f.s.handler(e)
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
