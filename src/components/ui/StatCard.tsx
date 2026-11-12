import { toneForPath } from '@/icons/tones'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { Card } from './Panel'

/**
 * Figma "Stat Card": 15px radius, 1px border, padding 18/24,
 * uppercase label, Manrope 800 30px value. Red border = needs attention.
 * Trend indicators are omitted until historical data exists.
 */
export function StatCard({
  label,
  value,
  hint,
  attention,
  to,
  loading,
}: {
  label: ReactNode
  value: number | null
  hint?: ReactNode
  attention?: boolean
  to?: string
  loading?: boolean
}) {
  const body = (
    <Card className={cn('flex h-full min-h-[112px] flex-col justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5', to && 'transition-colors hover:bg-sky-50 active:bg-sky-100')}>
      <p className="flex items-center gap-1.5 text-[length:calc(16px*var(--fs))] leading-snug font-medium text-ink-nav">
        {label}
      </p>
      <div className="flex items-end justify-between gap-2">
        {loading || value === null ? (
          <span className="h-[26px] w-16 animate-pulse rounded bg-surface-muted" />
        ) : (
          <span className={cn('font-display text-[length:calc(34px*var(--fs))] leading-none font-extrabold tabular-nums', attention && value ? 'text-danger-ink' : 'text-navy-900')}>{formatNumber(value)}</span>
        )}
        {hint && <span className="text-[length:calc(14px*var(--fs))] text-ink-muted">{hint}</span>}
      </div>
    </Card>
  )
  return to ? (
    <Link to={to} className="block h-full rounded-[var(--radius-card)]">
      {body}
    </Link>
  ) : (
    body
  )
}

/** Compact task counter (figma bottom row: icon tile, label, count). */
export function TaskTile({
  icon,
  label,
  count,
  to,
  attention,
}: {
  icon: ReactNode
  label: string
  count: number | null
  to: string
  attention?: boolean
}) {
  return (
    <Link to={to} className="block h-full rounded-[var(--radius-control)]">
      <Card className="flex h-full items-center gap-3 rounded-md px-4 py-3 transition-colors hover:bg-sky-50">
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-[8px]',
            attention ? 'bg-danger-tint text-danger' : toneForPath(to),
          )}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-[length:calc(15.5px*var(--fs))] leading-tight font-semibold text-navy-900">{label}</span>
          <span className="font-display text-[length:calc(24px*var(--fs))] leading-tight font-extrabold text-navy-900">
            {count === null ? '–' : formatNumber(count)}
          </span>
        </span>
      </Card>
    </Link>
  )
}
