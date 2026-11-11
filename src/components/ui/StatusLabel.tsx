import { cn } from '@/lib/cn'
import { RESIDENT_STATUS_TONE, type ResidentStatus } from '@/lib/residentStatus'
import type { BadgeTone } from './Badge'

const tones: Record<BadgeTone, { box: string; dot: string }> = {
  success: { box: 'bg-success-tint text-success', dot: 'bg-success' },
  warning: { box: 'bg-warning-tint text-warning', dot: 'bg-warning' },
  danger: { box: 'bg-danger-tint text-danger-ink', dot: 'bg-danger' },
  info: { box: 'bg-info-tint text-info', dot: 'bg-info' },
  neutral: { box: 'bg-neutral-tint text-ink-nav', dot: 'bg-ink-muted' },
}

/** Status label with a leading dot (Figma component "Status label"). */
export function StatusLabel({ status, tone, className }: { status: ResidentStatus | string; tone?: BadgeTone; className?: string }) {
  const t = tones[tone ?? RESIDENT_STATUS_TONE[status as ResidentStatus] ?? 'neutral']
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-[var(--radius-badge)] px-2 text-[13.5px] font-semibold whitespace-nowrap', t.box, className)}>
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', t.dot)} />
      {status}
    </span>
  )
}
