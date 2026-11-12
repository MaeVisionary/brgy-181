import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * A group of action buttons: stacked, all the same width and height, with the
 * longest label setting the width (full width on phones). Text is centred.
 * Buttons keep their own colours and actions.
 */
export function ActionStack({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid w-full grid-cols-1 gap-2 sm:w-max sm:min-w-[240px] [&>:not(p)]:min-h-12 [&>*]:w-full [&>:not(p)]:justify-center [&>:not(p)]:text-center', className)}>
      {children}
    </div>
  )
}
