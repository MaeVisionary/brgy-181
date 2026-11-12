import { ChevronLeft, ChevronRight } from '@/icons'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Panel } from '@/components/ui/Panel'
import { cn } from '@/lib/cn'
import type { KPCase } from '@/types/case'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Month view of hearings (scheduled and held). */
export function HearingCalendar({ cases }: { cases: KPCase[] }) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const items = cases.flatMap((c) => c.hearings.filter((h) => h.status === 'scheduled' || h.status === 'held').map((h) => ({ c, h, d: new Date(h.scheduledAt) })))
  const byDay = new Map<string, typeof items>()
  for (const x of items) byDay.set(ymd(x.d), [...(byDay.get(ymd(x.d)) ?? []), x])
  const start = new Date(month)
  start.setDate(1 - month.getDay())
  const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  const todayKey = ymd(new Date())
  const label = month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))

  return (
    <Panel
      title={`Calendar: ${label}`}
      className="mb-4"
      actions={
        <div className="flex gap-1">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="grid size-10 place-items-center rounded-md border border-line bg-surface text-navy-900 hover:bg-surface-muted"><ChevronLeft className="size-4" /></button>
          <button type="button" aria-label="Next month" onClick={() => shift(1)} className="grid size-10 place-items-center rounded-md border border-line bg-surface text-navy-900 hover:bg-surface-muted"><ChevronRight className="size-4" /></button>
        </div>
      }
      bodyClassName="px-2 py-2 sm:px-4 sm:py-3"
    >
      <div className="grid grid-cols-7 text-center text-[length:calc(13px*var(--fs))] font-semibold text-ink-muted">
        {DAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-line bg-line">
        {cells.map((d) => {
          const list = byDay.get(ymd(d)) ?? []
          const inMonth = d.getMonth() === month.getMonth()
          return (
            <div key={d.toISOString()} className={cn('min-h-[64px] bg-surface p-1 sm:min-h-[84px] sm:p-1.5', !inMonth && 'bg-surface-muted/70')}>
              <p className={cn('text-[length:calc(13px*var(--fs))] font-semibold', ymd(d) === todayKey ? 'inline-grid size-6 place-items-center rounded-full bg-navy-900 text-white' : inMonth ? 'text-navy-900' : 'text-ink-subtle')}>{d.getDate()}</p>
              <ul className="mt-0.5 space-y-0.5">
                {list.map(({ c, h }) => (
                  <li key={h.id}>
                    <Link
                      to={`/cases/${c.id}`}
                      title={`${c.caseNo} · ${c.title}`}
                      className={cn('block truncate rounded px-1 py-0.5 text-[length:calc(12px*var(--fs))] font-semibold sm:text-[length:calc(12.5px*var(--fs))]', h.status === 'held' ? 'bg-surface-muted text-ink-nav' : 'bg-sky-100 text-navy-900 hover:bg-bar')}
                    >
                      {new Date(h.scheduledAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })} {c.caseNo}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
