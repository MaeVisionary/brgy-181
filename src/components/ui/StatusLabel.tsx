import { cn } from '@/lib/cn'
import { RESIDENT_STATUS_TONE, type ResidentStatus } from '@/lib/residentStatus'
import type { BadgeTone } from './Badge'

const tones: Record<BadgeTone, string> = {
  success: 'bg-success-tint text-success',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger-ink',
  info: 'bg-info-tint text-info',
  neutral: 'bg-neutral-tint text-ink-nav',
}

/** Status shown as a small tinted label (no dot). */
export function StatusLabel({ status, tone, className }: { status: ResidentStatus | string; tone?: BadgeTone; className?: string }) {
  const t = tones[tone ?? RESIDENT_STATUS_TONE[status as ResidentStatus] ?? 'neutral']
  return <span className={cn('inline-flex h-6 items-center rounded px-1.5 text-[12.5px] font-semibold whitespace-nowrap', t, className)}>{status}</span>
}
