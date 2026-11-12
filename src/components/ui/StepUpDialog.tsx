import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/auth/useAuth'
import { ServiceError } from '@/services/mockApi'
import { startChallenge, verifyChallenge } from '@/services/stepUp'

/**
 * Review → reason → password → apply. The confirmation is bound to exactly
 * the change shown (action + payload); the service checks it again.
 */
export function StepUpDialog({ title, children, action, payload, confirmLabel = 'Confirm change', onApply, onCancel }: {
  title: string
  children: ReactNode
  action: string
  payload: object
  confirmLabel?: string
  onApply: (reason: string, challengeId: string) => Promise<void>
  onCancel: () => void
}) {
  const { user } = useAuth()
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (busy) return
    setErr(null)
    if (reason.trim().length < 5) { setErr('Give the reason for this change.'); return }
    if (!password) { setErr('Enter your password to confirm.'); return }
    setBusy(true)
    try {
      const id = startChallenge(user!, action, payload)
      await verifyChallenge(id, password, user!)
      await onApply(reason, id)
    } catch (e) {
      setErr(e instanceof ServiceError ? e.message : 'The change could not be made.')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }
  const input = 'w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[length:calc(16px*var(--fs))] text-navy-900 focus:border-navy-600 focus:outline-none'
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-900/40 sm:items-center sm:px-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="stepup-title" className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <h2 id="stepup-title" className="font-display text-[length:calc(20px*var(--fs))] font-bold text-navy-900">{title}</h2>
        <div className="mt-3">{children}</div>
        <label className="mt-4 block text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">Reason
          <textarea className={`${input} mt-1 min-h-[72px] py-2`} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <label className="mt-3 block text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">Your password
          <input type="password" autoComplete="current-password" className={`${input} mt-1 h-12`} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run() }} />
        </label>
        {err && <p role="alert" className="mt-3 text-[length:calc(15px*var(--fs))] text-danger-ink">{err}</p>}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-[var(--radius-control)] border border-line px-4 text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900 hover:bg-surface-muted">Cancel</button>
          <button type="button" onClick={run} disabled={busy} className="min-h-12 rounded-[var(--radius-control)] bg-navy-900 px-4 text-[length:calc(16.5px*var(--fs))] font-semibold text-white hover:bg-navy-800 disabled:opacity-60">{busy ? 'Checking…' : confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
