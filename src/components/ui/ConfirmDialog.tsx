import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { buttonClass } from './Button'

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
    <div className="fixed inset-0 z-[60] grid place-items-center bg-navy-900/40 px-4 py-4" role="presentation">
      {/* Never taller than the screen: the message scrolls inside, the title and buttons stay visible (phones in landscape too). */}
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[440px] flex-col rounded-2xl bg-surface p-6 text-center shadow-2xl">
        <h2 id="confirm-title" className="shrink-0 font-display text-[length:calc(20px*var(--fs))] font-bold text-navy-900">{title}</h2>
        {children && <div className="-mx-1 mt-2 min-h-0 overflow-y-auto px-1 text-[length:calc(16px*var(--fs))] text-ink-nav">{children}</div>}
        <div className="mt-6 grid shrink-0 grid-cols-2 gap-3">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className={buttonClass('secondary', 'md', 'w-full')}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={buttonClass(destructive ? 'danger-solid' : 'primary', 'md', 'w-full')}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
