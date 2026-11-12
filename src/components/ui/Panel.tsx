import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Open layout: sections are separated by headings and thin rules, not boxes.
 * A container keeps a box only when it means something (a tinted notice,
 * a table, a form field). cn() does not merge conflicting classes, so the
 * helpers below remove the padding a box would have needed.
 */

/** Removes horizontal padding and rounding (content lines up with the page edge). */
function openUp(className: string) {
  return className
    .split(/\s+/)
    .filter((c) => c && !/^(?:[a-z0-9]+:)*(?:px|pl|pr|rounded)(?:-|$)/.test(c))
    .map((c) => c.replace(/^((?:[a-z0-9]+:)*)p-(\S+)$/, '$1py-$2'))
    .join(' ')
}

/** Rows inside a flush list: text on the page edge, a little room for the hover tint. */
export const FLUSH_ROWS =
  '[&>ul>li]:!px-0 [&>ul>li>a]:!-mx-2 [&>ul>li>a]:!px-2 [&>ul>li>button]:!-mx-2 [&>ul>li>button]:!px-2 [&>ul>li>button]:!w-[calc(100%+1rem)] [&>p]:!px-0'

/** Heading row shared by every section. */
export const SECTION_HEAD = 'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line pb-2.5'
export const SECTION_TITLE = 'font-display text-[18px] font-bold text-navy-900'

/**
 * A block of content. Tinted ones (className with bg-…) stay boxed notices;
 * the rest are open, divided from what comes before by a thin top rule.
 */
export function Card({ className, children, attention }: { className?: string; children: ReactNode; attention?: boolean }) {
  const cls = className ?? ''
  const tinted = /(^|\s)bg-/.test(cls)
  return (
    <div
      className={cn(
        tinted ? 'rounded-[var(--radius-card)] border' : attention ? 'border-t-2' : 'border-t',
        attention ? 'border-danger' : 'border-line',
        tinted ? cls : openUp(cls),
      )}
    >
      {children}
    </div>
  )
}

/** Section with a heading row (title, optional subtitle and actions) and its content. */
export function Panel({
  title,
  subtitle,
  icon,
  actions,
  footer,
  className,
  bodyClassName,
  children,
  keepSubtitle,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
  /** Kept for compatibility; every section now uses the same heading style. */
  dark?: boolean
  /**
   * Subtitles are hidden by default to keep pages light. Set this only when the
   * subtitle tells the user how to do something (rules, what to attach, etc.).
   */
  keepSubtitle?: boolean
}) {
  const body = bodyClassName ?? ''
  const flush = /(^|\s)(px-0|p-0)(\s|$)/.test(body)
  return (
    <section className={cn('flex min-w-0 flex-col pb-4', openUp(className ?? ''))}>
      <div className={SECTION_HEAD}>
        <div className="flex min-w-0 items-start gap-2.5">
          {icon && <span className="mt-1 text-navy-900">{icon}</span>}
          <div className="min-w-0">
            <h2 className={SECTION_TITLE}>{title}</h2>
            {subtitle && keepSubtitle && <p className="mt-0.5 text-[14px] text-ink-muted">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={cn('flex-1', flush ? FLUSH_ROWS : 'pt-3', openUp(body).replace(/(^|\s)py-0(\s|$)/, ' '))}>{children}</div>
      {footer && <div className="mt-3 border-t border-line-soft pt-3">{footer}</div>}
    </section>
  )
}
