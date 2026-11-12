import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * A group of action buttons: stacked, all the same width and height, with the
 * longest label setting the width (full width on phones). Text is centred.
 * Buttons keep their own colours and actions.
 *
 * `row`: for step navigation (Next / Back, Confirm / Choose another time).
 * Stacked on phones; on one line from tablet width up, still equal widths.
 */
export function ActionStack({ children, className, row }: { children: ReactNode; className?: string; row?: boolean }) {
  return (
    <div className={cn('grid w-full grid-cols-1 gap-2 sm:w-max sm:min-w-[240px] [&>:not(p)]:min-h-12 [&>*]:w-full [&>:not(p)]:justify-center [&>:not(p)]:text-center', row && 'sm:min-w-0 sm:grid-flow-col sm:grid-cols-none sm:auto-cols-[minmax(200px,1fr)] sm:gap-3', className)}>
      {children}
    </div>
  )
}
