import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Shared layout for a group of related action buttons (one standard for the whole BMIS).
 *
 * Phones: always one column, full width, 48px+ tall, 8px apart, so every label fits and every
 * button is easy to tap. From tablet width up it depends on the group:
 *
 *  - `row` (default): side by side, 12px apart, wrapping only when there is no room. Buttons keep
 *    their natural width (at least 140px) instead of stretching. Use for form actions, step
 *    navigation (Next / Back), approval pairs and most detail-page actions.
 *  - `panel`: stacked, full width of a narrow side panel (the panel's main actions).
 *  - `pair`: two equal columns (two related secondary actions in a panel, e.g. Change priority /
 *    Merge issue).
 *
 * Keep unrelated actions in separate groups; put a destructive action (Cancel, Reject) after an
 * <ActionDivider /> so it is never mistaken for the main step. Button colours come from the
 * Button variants; this component only arranges them.
 */
export function ActionStack({ children, className, layout = 'row' }: { children: ReactNode; className?: string; layout?: 'row' | 'panel' | 'pair'; /** @deprecated kept for older call sites; same as the default */ row?: boolean }) {
  return (
    <div
      className={cn(
        'grid w-full grid-cols-1 gap-2 [&>:not(p)]:min-h-12 [&>:not(p)]:w-full [&>:not(p)]:justify-center [&>:not(p)]:text-center',
        layout === 'row' && 'sm:flex sm:flex-wrap sm:items-stretch sm:gap-3 sm:[&>:not(p)]:w-auto sm:[&>:not(p)]:min-w-[140px] [&>p]:basis-full',
        layout === 'panel' && 'gap-2.5',
        layout === 'pair' && 'gap-2.5 sm:grid-cols-2 [&>p]:sm:col-span-2',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Separates a destructive or less related action from the main group (thin line + space). */
export function ActionDivider({ className }: { className?: string }) {
  return <hr className={cn('my-3 border-0 border-t border-line-soft', className)} />
}
