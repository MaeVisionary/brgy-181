import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

/**
 * Short, specific confirmation (Apple-style alert). Clicking outside does
 * nothing, so a stray tap never confirms. Escape cancels.
 */
export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Cancel', destructive, busy, onConfirm, onCancel }: {
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onCancel])
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-navy-900/40 px-4" role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-[380px] rounded-2xl bg-surface p-6 text-center shadow-2xl">
        <h2 id="confirm-title" className="font-display text-[length:calc(20px*var(--fs))] font-bold text-navy-900">{title}</h2>
        {children && <div className="mt-2 text-[length:calc(16px*var(--fs))] text-ink-nav">{children}</div>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-[var(--radius-control)] border border-line bg-surface px-4 text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900 hover:bg-surface-muted">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={cn('min-h-12 rounded-[var(--radius-control)] px-4 text-[length:calc(16.5px*var(--fs))] font-semibold text-white disabled:opacity-60', destructive ? 'bg-danger hover:brightness-95' : 'bg-navy-900 hover:bg-navy-800')}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
