import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { DRAFT_TTL, type DraftRecord, discardDraft, draftStorageKey, hasContent, loadDraft, newDraftId, saveDraft } from '@/lib/drafts'
import { formatDateTime } from '@/lib/format'
import { Button } from '@/components/ui/Button'

export type DraftStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Options<T> {
  /** Defaults to the signed-in user; 'guest' for public forms. */
  owner?: string
  ttlHours?: number
  /** Turn saving off (e.g. while reviewing a submitted record). */
  enabled?: boolean
  /** Treat as empty (nothing to save or recover). Defaults to "no typed content". */
  isEmpty?: (v: T) => boolean
  debounceMs?: number
}

/**
 * Auto-saves `value` for this form after the person stops typing, and offers
 * any earlier unsent draft back once ("Welcome back"). Saving pauses until the
 * person chooses Continue or Start over, so an old draft is never overwritten
 * by an empty form. `draftId` stays the same until the draft is cleared and is
 * used as the submission's idempotency key (a retry never creates a duplicate).
 */
export function useDraft<T>(form: string, value: T, opts: Options<T> = {}) {
  const { user } = useAuth()
  const owner = opts.owner ?? user?.id ?? ''
  const ttl = opts.ttlHours ?? DRAFT_TTL.default
  const isEmpty = opts.isEmpty ?? ((v: T) => !hasContent(v))
  const enabled = (opts.enabled ?? true) && !!owner

  const [recovered, setRecovered] = useState<DraftRecord<T> | null>(() => {
    if (!owner) return null
    const d = loadDraft<T>(owner, form)
    return d && !isEmpty(d.data) ? d : null
  })
  const [draftId, setDraftId] = useState(() => recovered?.id ?? newDraftId())
  const [status, setStatus] = useState<DraftStatus>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [conflict, setConflict] = useState<DraftRecord<T> | null>(null)
  const lastWritten = useRef<string>('')
  const first = useRef(true)

  // Debounced save.
  useEffect(() => {
    // While off or waiting for Continue / Start over, the next value shown becomes the new starting point.
    if (!enabled || recovered) { first.current = true; return }
    // The form as first shown (empty or pre-filled from records) is not a draft; only changes are saved.
    if (first.current) { first.current = false; lastWritten.current = JSON.stringify(value); return }
    const json = JSON.stringify(value)
    if (json === lastWritten.current) return
    if (isEmpty(value)) {
      discardDraft(owner, form)
      lastWritten.current = json
      setStatus('idle')
      return
    }
    setStatus('saving')
    const t = window.setTimeout(() => {
      const rec = saveDraft(owner, form, draftId, value, ttl)
      if (rec) { lastWritten.current = json; setSavedAt(rec.savedAt); setStatus('saved') } else setStatus('error')
    }, opts.debounceMs ?? 800)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled, recovered, owner, form, draftId])

  // Another tab or window changed this draft.
  useEffect(() => {
    if (!owner) return
    const key = draftStorageKey(owner, form)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || !e.newValue) return
      try {
        const rec = JSON.parse(e.newValue) as DraftRecord<T>
        if (rec.owner === owner && JSON.stringify(rec.data) !== lastWritten.current) setConflict(rec)
      } catch { /* ignore */ }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [owner, form])

  /** Use the earlier draft. Returns its data for the form to load. */
  const resume = useCallback((): T | null => {
    const d = recovered
    setRecovered(null)
    if (!d) return null
    lastWritten.current = JSON.stringify(d.data)
    setSavedAt(d.savedAt)
    setStatus('saved')
    return d.data
  }, [recovered])

  /** Throw the earlier draft away and start a fresh one. */
  const startOver = useCallback(() => {
    discardDraft(owner, form)
    setRecovered(null)
    setDraftId(newDraftId())
    setStatus('idle')
  }, [owner, form])

  /** After a successful submission (or Cancel/Discard): remove the draft. */
  const clear = useCallback(() => {
    discardDraft(owner, form)
    lastWritten.current = ''
    setDraftId(newDraftId())
    setStatus('idle')
  }, [owner, form])

  const takeOther = useCallback((): T | null => {
    const c = conflict
    setConflict(null)
    if (!c) return null
    lastWritten.current = JSON.stringify(c.data)
    return c.data
  }, [conflict])
  const keepMine = useCallback(() => { setConflict(null); lastWritten.current = '' }, [])

  return { status, savedAt, recovered, resume, startOver, clear, draftId, conflict, takeOther, keepMine }
}

/** Small, quiet save indicator for a form header or footer. */
export function DraftIndicator({ status, className }: { status: DraftStatus; className?: string }) {
  if (status === 'idle') return null
  const text = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved on this device' : 'Unable to save. Please check your connection or free up space on this device. Your entries are still on screen.'
  return (
    <p aria-live="polite" className={`text-[length:calc(14px*var(--fs))] ${status === 'error' ? 'font-semibold text-danger-ink' : 'text-ink-muted'} ${className ?? ''}`}>
      {status === 'saved' && <span aria-hidden className="mr-1 text-success">✓</span>}
      {text}
    </p>
  )
}

/** Shown once when an unsent draft exists. */
export function DraftRecoveryCard({ savedAt, onContinue, onStartOver, note }: { savedAt: string; onContinue: () => void; onStartOver: () => void; note?: string }) {
  return (
    <div role="region" aria-label="Saved progress" className="mb-4 rounded-md border border-info/40 bg-sky-50 px-4 py-4">
      <p className="text-[length:calc(17px*var(--fs))] font-bold text-navy-900">Welcome back!</p>
      <p className="mt-1 text-[length:calc(15.5px*var(--fs))] text-navy-900">We found your previously saved progress from {formatDateTime(savedAt)}. Would you like to continue where you left off?</p>
      {note && <p className="mt-1 text-[length:calc(14.5px*var(--fs))] text-ink-nav">{note}</p>}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:flex">
        <Button onClick={onContinue}>Continue where I left off</Button>
        <Button variant="secondary" onClick={onStartOver}>Start over</Button>
      </div>
    </div>
  )
}

/** Shown when the same draft was changed in another tab or window. */
export function DraftConflictNote({ onTake, onKeep }: { onTake: () => void; onKeep: () => void }) {
  return (
    <div role="alert" className="mb-4 rounded-md border border-warning/50 bg-warning-tint px-4 py-3 text-[length:calc(15px*var(--fs))] text-navy-900">
      This form was also changed in another tab or window.
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={onTake}>Use the other version</Button>
        <Button size="sm" variant="secondary" onClick={onKeep}>Keep this one</Button>
      </div>
    </div>
  )
}
