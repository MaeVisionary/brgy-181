import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TimelineItem {
  at: string
  title: string
  /** Who did it (a name; no role title unless needed). */
  by?: string
  /** Short outcome shown under the title. */
  outcome?: string
  /** Hidden until the entry is opened: notes, documents, before and after. */
  details?: ReactNode
  /** Marker: 'done' (default), 'important' (decisions, rejections, overdue), 'pending'. */
  tone?: 'done' | 'important' | 'pending'
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Manila' })
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })

/**
 * Chronological activity history (newest first) with a thin line and small
 * markers. Each entry shows the activity, then date, time and person; extra
 * details open on tap. Used for every history in BMIS so they look the same.
 */
export function Timeline({ items, empty = 'No activity yet.' }: { items: TimelineItem[]; empty?: string }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const sorted = items.map((it, i) => ({ it, i })).sort((a, b) => b.it.at.localeCompare(a.it.at) || b.i - a.i)
  if (!sorted.length) return <p className="text-[length:calc(16px*var(--fs))] text-ink-muted">{empty}</p>
  return (
    <ol className="relative">
      {sorted.map(({ it, i }, n) => {
        const expandable = !!it.details
        const isOpen = open.has(i)
        const toggle = () => setOpen((s) => { const x = new Set(s); if (x.has(i)) x.delete(i); else x.add(i); return x })
        const body = (
          <>
            <span className="block text-[length:calc(14.5px*var(--fs))] font-semibold text-ink-nav">{dayLabel(it.at)}</span>
            <span className="block text-[length:calc(16.5px*var(--fs))] font-semibold break-words text-navy-900">{it.title}</span>
            <span className="block text-[length:calc(15px*var(--fs))] text-ink-muted">{timeLabel(it.at)}{it.by ? ` · ${it.by}` : ''}</span>
            {it.outcome && <span className="mt-0.5 block text-[length:calc(15.5px*var(--fs))] break-words text-navy-900">{it.outcome}</span>}
          </>
        )
        return (
          <li key={i} className="relative pb-5 pl-7 last:pb-0">
            {n < sorted.length - 1 && <span aria-hidden className="absolute top-3 bottom-0 left-[5px] w-px bg-line" />}
            <span aria-hidden className={cn('absolute top-[7px] left-0 size-[11px] rounded-full border-2', it.tone === 'important' ? 'border-navy-900 bg-navy-900' : it.tone === 'pending' ? 'border-ink-subtle bg-surface' : 'border-navy-600 bg-surface')} />
            {expandable ? (
              <button type="button" onClick={toggle} aria-expanded={isOpen} className="block w-full text-left">
                {body}
                <span className="mt-1 inline-block text-[length:calc(14.5px*var(--fs))] font-semibold text-info">{isOpen ? 'Hide details' : 'Details'}</span>
              </button>
            ) : body}
            {isOpen && it.details && <div className="mt-2 rounded-[var(--radius-control)] bg-surface-muted px-3.5 py-2.5 text-[length:calc(15.5px*var(--fs))] break-words text-navy-900">{it.details}</div>}
          </li>
        )
      })}
    </ol>
  )
}
