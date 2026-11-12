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
  const shift = (n: number) => { setPicked(null); setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1)) }
  // Day picked in the grid; its hearings are listed under the calendar as full-size rows.
  const [picked, setPicked] = useState<string | null>(null)
  const pickedList = picked ? byDay.get(picked) ?? [] : []
  const pickedDate = picked ? cells.find((d) => ymd(d) === picked) : undefined

  return (
    <Panel
      title={`Calendar: ${label}`}
      className="mb-4"
      actions={
        <div className="flex gap-1">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="grid size-11 place-items-center rounded-md border border-line bg-surface text-navy-900 hover:bg-surface-muted"><ChevronLeft className="size-4" /></button>
          <button type="button" aria-label="Next month" onClick={() => shift(1)} className="grid size-11 place-items-center rounded-md border border-line bg-surface text-navy-900 hover:bg-surface-muted"><ChevronRight className="size-4" /></button>
        </div>
      }
      bodyClassName="px-2 py-2 sm:px-4 sm:py-3"
    >
      <div className="grid grid-cols-7 text-center text-[length:calc(14px*var(--fs))] font-semibold text-ink-muted">
        {DAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-line bg-line">
        {cells.map((d) => {
          const list = byDay.get(ymd(d)) ?? []
          const inMonth = d.getMonth() === month.getMonth()
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => setPicked(picked === ymd(d) ? null : ymd(d))}
              aria-pressed={picked === ymd(d)}
              aria-label={`${d.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}: ${list.length ? `${list.length} hearing${list.length > 1 ? 's' : ''}` : 'no hearings'}`}
              className={cn('flex min-h-[64px] flex-col items-stretch bg-surface p-1 text-left transition-colors hover:bg-sky-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-navy-600 sm:min-h-[84px] sm:p-1.5', !inMonth && 'bg-surface-muted/70', picked === ymd(d) && 'bg-sky-100')}
            >
              <span className={cn('text-[length:calc(14px*var(--fs))] font-semibold', ymd(d) === todayKey ? 'inline-grid size-7 place-items-center rounded-full bg-navy-900 text-white' : inMonth ? 'text-navy-900' : 'text-ink-subtle')}>{d.getDate()}</span>
              {list.length > 0 && (
                <>
                  {/* Phones: a count. Larger screens: time and case number (labels only; tap the day to open). */}
                  <span className="mt-1 inline-grid min-w-6 place-items-center self-start rounded-full bg-navy-900 px-1.5 text-[length:calc(13px*var(--fs))] font-bold text-white sm:hidden">{list.length}</span>
                  <span className="mt-0.5 hidden space-y-0.5 sm:block">
                    {list.map(({ c, h }) => (
                      <span key={h.id} className={cn('block rounded px-1 py-0.5 text-[length:calc(13px*var(--fs))] leading-tight font-semibold break-words', h.status === 'held' ? 'bg-surface-muted text-ink-nav' : 'bg-sky-100 text-navy-900')}>
                        {new Date(h.scheduledAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })} {c.caseNo}
                      </span>
                    ))}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>
      {picked && (
        <div className="mt-3" aria-live="polite">
          <p className="px-1 text-[length:calc(15.5px*var(--fs))] font-semibold text-navy-900">{pickedDate?.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          {pickedList.length === 0 ? <p className="px-1 py-2 text-[length:calc(15px*var(--fs))] text-ink-muted">No hearings on this day.</p> : (
            <ul className="mt-1 divide-y divide-line-soft rounded-md border border-line">
              {pickedList.map(({ c, h }) => (
                <li key={h.id}>
                  <Link to={`/cases/${c.id}`} className="flex min-h-12 items-center gap-3 px-3 py-2 hover:bg-sky-50">
                    <span className="w-20 shrink-0 text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{new Date(h.scheduledAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>
                    <span className="min-w-0 flex-1 text-[length:calc(15px*var(--fs))] break-words text-navy-900">{c.caseNo} · {c.title}{h.status === 'held' ? ' (held)' : ''}</span>
                    <ChevronRight className="size-5 shrink-0 text-ink-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  )
}
