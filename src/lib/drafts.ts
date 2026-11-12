/**
 * FORM DRAFTS: auto-saved, unsent form entries.
 *
 * Prototype storage: this device's localStorage, one entry per (owner, form).
 * - owner is the signed-in user's id, or 'guest' for the public registration
 *   form. Another account on the same device never sees these entries: keys
 *   and the stored owner are both checked.
 * - Drafts expire (24 hours for registration, 7 days otherwise) and are removed
 *   when the person signs out, after a successful submission, or on Start over.
 * - Never stored here: passwords, ID numbers, ID photos, selfies, face data,
 *   session tokens. Forms pass only their non-sensitive fields.
 * - A draft is never a transaction: nothing here is sent, approved or published.
 *
 * With the backend this becomes the form_drafts table with row-level security
 * (docs/supabase/drafts.sql); the hook's interface stays the same.
 */

export interface DraftRecord<T = unknown> {
  v: 1
  /** Stable id for this draft; also the idempotency key when it is submitted. */
  id: string
  owner: string
  form: string
  data: T
  savedAt: string
  expiresAt: string
}

const PREFIX = 'bmis.draft.'
const keyOf = (owner: string, form: string) => `${PREFIX}${owner}.${form}`
export const DRAFT_TTL = { registration: 24, default: 24 * 7 } // hours

export const newDraftId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export function loadDraft<T>(owner: string, form: string): DraftRecord<T> | null {
  try {
    const raw = localStorage.getItem(keyOf(owner, form))
    if (!raw) return null
    const rec = JSON.parse(raw) as DraftRecord<T>
    if (rec.v !== 1 || rec.owner !== owner || rec.form !== form || new Date(rec.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(keyOf(owner, form))
      return null
    }
    return rec
  } catch {
    return null
  }
}

/** Saves the draft. Returns the stored record, or null when this device cannot save (storage full or blocked). */
export function saveDraft<T>(owner: string, form: string, id: string, data: T, ttlHours = DRAFT_TTL.default): DraftRecord<T> | null {
  const now = new Date()
  const rec: DraftRecord<T> = { v: 1, id, owner, form, data, savedAt: now.toISOString(), expiresAt: new Date(now.getTime() + ttlHours * 3_600_000).toISOString() }
  try {
    localStorage.setItem(keyOf(owner, form), JSON.stringify(rec))
    return rec
  } catch {
    return null
  }
}

export function discardDraft(owner: string, form: string) {
  try { localStorage.removeItem(keyOf(owner, form)) } catch { /* ignore */ }
}

/** All drafts of one account on this device (e.g. on sign-out). */
export function clearDraftsFor(owner: string) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(`${PREFIX}${owner}.`)) localStorage.removeItem(k)
  } catch { /* ignore */ }
}

/** Removes expired or unreadable drafts (run on app start). */
export function purgeExpiredDrafts() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(PREFIX)) continue
      try {
        const rec = JSON.parse(localStorage.getItem(k) ?? '') as DraftRecord
        if (new Date(rec.expiresAt).getTime() < Date.now()) localStorage.removeItem(k)
      } catch { localStorage.removeItem(k) }
    }
  } catch { /* ignore */ }
}

export const draftStorageKey = keyOf

/** True when a value holds something the person actually typed or chose. */
export function hasContent(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'number') return true
  if (v === true) return true
  if (Array.isArray(v)) return v.some(hasContent)
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some(hasContent)
  return false
}
