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
const tones: Record<BadgeTone, string> = {
  success: 'bg-success-tint text-success',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger-ink',
  info: 'bg-info-tint text-info',
  neutral: 'bg-neutral-tint text-ink-nav',
}

/** Status shown as a small tinted label (no dot). `dot` is kept for compatibility. */
export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string; dot?: boolean }) {
  return <span className={cn('inline-flex h-6 items-center rounded px-1.5 text-[12.5px] font-semibold whitespace-nowrap', tones[tone], className)}>{children}</span>
}
