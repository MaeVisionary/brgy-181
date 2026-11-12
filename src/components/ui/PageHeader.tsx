import type { ReactNode } from 'react'

/** Eyebrow + Manrope 800 26px title + subtitle + right-aligned actions (figma). */
export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: ReactNode
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[length:calc(12.5px*var(--fs))] font-semibold tracking-[0.08em] text-navy-600 uppercase">{eyebrow}</p>}
        <h1 className="font-display text-[length:calc(26px*var(--fs))] leading-tight font-extrabold text-navy-900 sm:text-[length:calc(30px*var(--fs))]">{title}</h1>
        {/* Subtitles are not shown: page titles speak for themselves. */}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
