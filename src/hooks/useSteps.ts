import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * One authoritative step controller for every multi-step form.
 *
 * - The current step is a key in an ordered list (`sequence`). The list may
 *   depend on answers (e.g. no face check without an ID); that is the only way
 *   a step is left out, so nothing is skipped by accident.
 * - next() moves exactly one step forward, and only when `validate` (the
 *   current step's own check) passes; back() moves exactly one step back.
 * - Taps are ignored for a short moment after each move, so a double tap or a
 *   fast repeat can never move two steps, and a step can't be passed by
 *   pressing Next repeatedly.
 * - Entered data lives in the form's own state and is never reset by moving.
 */
export function useSteps<K extends string>(sequence: readonly K[], opts: { initial?: K; lockMs?: number; onChange?: (k: K) => void } = {}) {
  const [current, setCurrent] = useState<K>(opts.initial ?? sequence[0])
  const lock = useRef(false)
  const seqRef = useRef(sequence)
  seqRef.current = sequence
  // If the sequence changed and no longer contains the current step, stay on the last step before it.
  const index = Math.max(0, sequence.indexOf(current))
  useEffect(() => { if (!sequence.includes(current)) setCurrent(sequence[Math.max(0, Math.min(index, sequence.length - 1))]) }, [sequence, current, index])
  useEffect(() => {
    const t = window.setTimeout(() => { lock.current = false }, opts.lockMs ?? 450)
    return () => window.clearTimeout(t)
  }, [current, opts.lockMs])

  const move = useCallback((to: K) => {
    if (lock.current) return false
    lock.current = true
    setCurrent(to)
    opts.onChange?.(to)
    return true
  }, [opts])

  /** Exactly one step forward, after the current step's check passes. Returns true when it moved. */
  const next = useCallback((validate?: () => boolean) => {
    if (lock.current) return false
    if (validate && !validate()) return false
    const seq = seqRef.current
    const i = seq.indexOf(current)
    if (i < 0 || i >= seq.length - 1) return false
    return move(seq[i + 1])
  }, [current, move])

  /** Exactly one step back. */
  const back = useCallback(() => {
    const seq = seqRef.current
    const i = seq.indexOf(current)
    if (i <= 0) return false
    return move(seq[i - 1])
  }, [current, move])

  /** Jump to a step that is already reached (e.g. resuming a saved draft or "Edit" from a review). */
  const goTo = useCallback((k: K) => { if (seqRef.current.includes(k)) { setCurrent(k); lock.current = false } }, [])

  return { current, index, total: sequence.length, isFirst: index === 0, isLast: index === sequence.length - 1, next, back, goTo, sequence, locked: () => lock.current }
}
