import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** White bordered surface used for every content block. */
export function Card({ className, children, attention }: { className?: string; children: ReactNode; attention?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border',
        !/(^|\s)bg-/.test(className ?? '') && 'bg-surface',
        attention ? 'border-danger' : 'border-line',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Card with a titled header row (figma "Population by Purok", "Ayuda Planning"). */
export function Panel({
  title,
  subtitle,
  icon,
  actions,
  footer,
  className,
  bodyClassName,
  children,
  dark = true,
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
  /** Navy title bar (Figma "My Recent Activities"): the default for every container. */
  dark?: boolean
  /**
   * Subtitles are hidden by default to keep pages light. Set this only when the
   * subtitle tells the user how to do something (rules, what to attach, etc.).
   */
  keepSubtitle?: boolean
}) {
  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3.5', dark ? 'bg-bar border-b border-sky-300 text-navy-900' : 'border-b border-line-soft')}>
        <div className="flex min-w-0 items-start gap-3">
          {icon && <span className={cn('mt-0.5', 'text-navy-900')}>{icon}</span>}
          <div className="min-w-0">
            <h2 className={cn('font-display text-[17px] font-bold', 'text-navy-900')}>{title}</h2>
            {subtitle && keepSubtitle && <p className={cn('mt-0.5 text-[14px]', dark ? 'text-ink-nav' : 'text-ink-muted')}>{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={cn('flex-1 px-5 py-4', bodyClassName)}>{children}</div>
      {footer && <div className="border-t border-line-soft px-5 py-3">{footer}</div>}
    </Card>
  )
}
