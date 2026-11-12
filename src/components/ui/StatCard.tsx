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
    <Card className="flex h-full flex-col justify-between py-3">
      <p className={cn('flex items-center gap-1.5 text-[14.5px] text-ink-nav', to && 'group-hover:text-navy-900 group-hover:underline')}>
        {label}
      </p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        {loading || value === null ? (
          <span className="h-[26px] w-16 animate-pulse rounded bg-surface-muted" />
        ) : (
          <span className={cn('font-display text-[26px] leading-none font-extrabold', attention && value ? 'text-danger-ink' : 'text-navy-900')}>{formatNumber(value)}</span>
        )}
        {hint && <span className="text-[14px] text-ink-muted">{hint}</span>}
      </div>
    </Card>
  )
  return to ? (
    <Link to={to} className="group block">
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
    <Link to={to} className="group block h-full">
      <Card className="flex h-full items-center gap-3 py-3">
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-md',
            attention ? 'bg-danger-tint text-danger' : 'bg-sky-100 text-navy-900',
          )}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] leading-tight font-semibold text-navy-900 group-hover:underline">{label}</span>
          <span className="font-display text-[20px] leading-tight font-extrabold text-navy-900">
            {count === null ? '–' : formatNumber(count)}
          </span>
        </span>
      </Card>
    </Link>
  )
}
