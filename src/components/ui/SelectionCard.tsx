import type { ReactNode } from 'react'
import { ChevronRight } from '@/icons'
import { cn } from '@/lib/cn'

/**
 * Selection cards (certificate and clearance types, service options, categories).
 * Every card in one grid has the same height (the tallest label sets it); the
 * label area wraps, the icon stays top-aligned with the first line and the
 * arrow stays vertically centred. Phones: one per row, full width.
 */
/** `cols`: 2 = two per row from tablet; 3 = two on tablet, three on wide screens; 'row' = all three in one row from tablet. */
export function SelectionGrid({ children, className, cols = 3 }: { children: ReactNode; className?: string; cols?: 2 | 3 | 'row' }) {
  return <ul className={cn('grid auto-rows-fr grid-cols-1 gap-3', cols === 'row' ? 'sm:grid-cols-3' : 'sm:grid-cols-2', cols === 3 && 'xl:grid-cols-3', className)}>{children}</ul>
}

export function SelectionCard({ title, note, icon, onClick, disabled, selected, arrow = true }: {
  title: ReactNode
  note?: ReactNode
  icon?: ReactNode
  onClick?: () => void
  disabled?: boolean
  selected?: boolean
  arrow?: boolean
}) {
  return (
    <li className="flex">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={selected === undefined ? undefined : selected}
        onClick={onClick}
        className={cn(
          'bmis-press flex min-h-16 w-full items-center gap-3 rounded-[var(--radius-control)] border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600',
          disabled ? 'cursor-not-allowed border-line-soft bg-surface-muted' : selected ? 'border-2 border-navy-900 bg-sky-50' : 'border-line bg-surface hover:border-navy-600 hover:bg-sky-50 active:bg-sky-100',
        )}
      >
        {icon && <span className="grid size-10 shrink-0 place-items-center self-start rounded-[10px] bg-sky-50 text-navy-900 [&_svg]:size-5">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-[length:calc(16.5px*var(--fs))] leading-snug font-semibold break-words text-navy-900">{title}</span>
          {note && <span className="mt-0.5 flex items-center gap-1 text-[length:calc(14.5px*var(--fs))] text-ink-nav [&_svg]:size-4 [&_svg]:shrink-0">{note}</span>}
        </span>
        {arrow && !disabled && <ChevronRight className="size-5 shrink-0 text-ink-subtle" />}
      </button>
    </li>
  )
}
