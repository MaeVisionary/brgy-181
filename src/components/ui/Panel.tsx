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
  dark,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
  /**
   * Navy title bar (Figma "My Recent Activities"). Use only on the containers a
   * user should look at first, so the page is not overwhelming.
   */
  dark?: boolean
}) {
  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      <div className={cn('flex items-start justify-between gap-3 px-5 py-4', dark ? 'bg-navy-900 text-white [&_a]:text-white' : 'border-b border-line-soft')}>
        <div className="flex min-w-0 items-start gap-3">
          {icon && <span className={cn('mt-0.5', dark ? 'text-white' : 'text-navy-900')}>{icon}</span>}
          <div className="min-w-0">
            <h2 className={cn('font-display text-[15px] font-bold', dark ? 'text-white' : 'text-navy-900')}>{title}</h2>
            {subtitle && <p className={cn('mt-0.5 text-[12px]', dark ? 'text-white/75' : 'text-ink-muted')}>{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={cn('flex-1 px-5 py-4', bodyClassName)}>{children}</div>
      {footer && <div className="border-t border-line-soft px-5 py-3">{footer}</div>}
    </Card>
  )
}
