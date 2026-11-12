import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from '@/icons'
import { cn } from '@/lib/cn'

export interface Row {
  key: string
  title: ReactNode
  subtitle?: ReactNode
  /** Small status or value on the right (keep it short). */
  trailing?: ReactNode
  to?: string
  onClick?: () => void
}

/**
 * Phone list (Settings-style): one tappable row per record with only what is
 * needed to pick it; details open on the record's own page. Shown below `md`;
 * pages keep their table from `md` up.
 */
export function RowList({ rows, empty, className }: { rows: Row[]; empty?: ReactNode; className?: string }) {
  if (!rows.length) return empty ? <div className={cn('md:hidden', className)}>{empty}</div> : null
  return (
    <ul className={cn('divide-y divide-line-soft md:hidden', className)}>
      {rows.map((r) => {
        const body = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{r.title}</span>
              {r.subtitle && <span className="block truncate text-[length:calc(13.5px*var(--fs))] text-ink-muted">{r.subtitle}</span>}
            </span>
            {r.trailing && <span className="shrink-0">{r.trailing}</span>}
            {(r.to || r.onClick) && <ChevronRight className="size-4 shrink-0 text-ink-subtle" />}
          </>
        )
        const cls = 'flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-muted'
        return (
          <li key={r.key}>
            {r.to ? <Link to={r.to} className={cls}>{body}</Link> : r.onClick ? <button type="button" onClick={r.onClick} className={cls}>{body}</button> : <div className={cls}>{body}</div>}
          </li>
        )
      })}
    </ul>
  )
}
