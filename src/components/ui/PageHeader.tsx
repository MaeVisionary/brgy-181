import type { ReactNode } from 'react'

/** Eyebrow + Manrope 800 26px title + subtitle + right-aligned actions (figma). */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[12.5px] font-semibold tracking-[0.08em] text-navy-600 uppercase">{eyebrow}</p>}
        <h1 className="font-display text-[24px] leading-tight font-extrabold text-navy-900 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
