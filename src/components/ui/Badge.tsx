import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/**
 * Colour codes used everywhere a status is shown (one colour per meaning):
 *  success  green  done / verified / ready / active / analytics ready
 *  info     blue   in progress / scheduled / approved, waiting for the next step
 *  warning  amber  needs attention soon: pending, format or template pending, due soon
 *  danger   red    overdue, rejected, failed, not settled, locked
 *  neutral  grey   recorded / closed / cancelled / no action needed
 */
const tones: Record<BadgeTone, { box: string; dot: string }> = {
  success: { box: 'bg-success-tint text-success', dot: 'bg-success' },
  warning: { box: 'bg-warning-tint text-warning', dot: 'bg-warning' },
  danger: { box: 'bg-danger-tint text-danger-ink', dot: 'bg-danger' },
  info: { box: 'bg-info-tint text-info', dot: 'bg-info' },
  neutral: { box: 'bg-neutral-tint text-ink-nav', dot: 'bg-ink-muted' },
}

/** Status badge with a leading dot. Plain tags (sectors, counts) pass dot={false}. */
export function Badge({ tone = 'neutral', children, className, dot = true }: { tone?: BadgeTone; children: ReactNode; className?: string; dot?: boolean }) {
  const t = tones[tone]
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-[var(--radius-badge)] px-2 text-[13.5px] font-semibold whitespace-nowrap', t.box, className)}>
      {dot && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', t.dot)} />}
      {children}
    </span>
  )
}
