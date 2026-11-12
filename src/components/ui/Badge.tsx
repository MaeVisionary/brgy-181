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
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger-ink',
  info: 'text-info',
  neutral: 'text-ink-nav',
}

/** Status shown as coloured text (no dot, no pill). `dot` is kept for compatibility. */
export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string; dot?: boolean }) {
  return <span className={cn('inline-flex items-center text-[14.5px] font-semibold whitespace-nowrap', tones[tone], className)}>{children}</span>
}
