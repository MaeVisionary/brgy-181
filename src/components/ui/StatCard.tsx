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
    <Card className={cn('flex h-full flex-col justify-between px-4 py-3.5 sm:px-5', to && 'transition-colors hover:bg-sky-50')}>
      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-nav">
        {attention && <span aria-label="Needs attention" className="size-1.5 shrink-0 rounded-full bg-danger" />}
        {label}
      </p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        {loading || value === null ? (
          <span className="h-[26px] w-16 animate-pulse rounded bg-surface-muted" />
        ) : (
          <span className="font-display text-[24px] leading-none font-extrabold text-navy-900">{formatNumber(value)}</span>
        )}
        {hint && <span className="text-[12px] text-ink-muted">{hint}</span>}
      </div>
    </Card>
  )
  return to ? (
    <Link to={to} className="block rounded-[var(--radius-card)]">
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
      <Card className="flex h-full items-center gap-3 rounded-[10px] px-4 py-3 transition-colors hover:bg-sky-50">
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-md',
            attention ? 'bg-danger-tint text-danger' : 'bg-sky-100 text-navy-900',
          )}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-[12px] leading-tight font-semibold text-navy-900">{label}</span>
          <span className="font-display text-[18px] leading-tight font-extrabold text-navy-900">
            {count === null ? '–' : formatNumber(count)}
          </span>
        </span>
      </Card>
    </Link>
  )
}
