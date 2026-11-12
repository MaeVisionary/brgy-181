import { cn } from '@/lib/cn'
import { RESIDENT_STATUS_TONE, type ResidentStatus } from '@/lib/residentStatus'
import type { BadgeTone } from './Badge'

const tones: Record<BadgeTone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger-ink',
  info: 'text-info',
  neutral: 'text-ink-nav',
}

/** Status shown as coloured text (no dot, no pill). */
export function StatusLabel({ status, tone, className }: { status: ResidentStatus | string; tone?: BadgeTone; className?: string }) {
  const t = tones[tone ?? RESIDENT_STATUS_TONE[status as ResidentStatus] ?? 'neutral']
  return <span className={cn('inline-flex items-center text-[14.5px] font-semibold whitespace-nowrap', t, className)}>{status}</span>
}
