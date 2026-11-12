import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Plus } from '@/icons'
import { useAuth } from '@/auth/useAuth'
import { BackLink } from '@/components/ui/BackLink'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { FieldLabel, Select, TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, Panel } from '@/components/ui/Panel'
import { useStickyState } from '@/hooks/useStickyState'
import {
  APPOINTMENT_STATUS_LABEL, APPOINTMENT_TYPES, dateLong, hearingsFor, isOpen, listMyAppointments, runAppointmentJobs, type Appointment,
} from '@/services/appointmentService'
import { HOLIDAY_TYPE_LABEL, closureList, holidayList, type Closure, type Holiday, type HolidayType } from '@/services/calendarData'
import { addClosure, calendarEntries, cancelClosure, removeHoliday, runCalendarJobs, saveHoliday, type CalendarEntry } from '@/services/calendarService'
import { ServiceError } from '@/services/mockApi'
import { SERVICE_KEYS, formatTime, manilaToday, nextDate, schedulingRules } from '@/services/schedulingService'
import { ActionStack } from '@/components/ui/ActionStack'

const errText = (e: unknown) => (e instanceof ServiceError ? e.message : 'Something went wrong. Please try again.')
const shortDate = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
const addDays = (d: string, n: number) => { let x = d; for (let i = 0; i < n; i++) x = nextDate(x); return x }
/** Each kind of holiday has its own colour, so regular holidays, special non-working and special working days are told apart at a glance. */
const HOLIDAY_TONE: Record<HolidayType, 'info' | 'warning' | 'neutral' | 'success'> = { regular: 'info', special_non_working: 'warning', special_working: 'neutral', local: 'success' }
const KIND_LABEL: Record<CalendarEntry['kind'], string> = { holiday: 'Holiday', closure: 'Closure', event: 'Barangay event' }
const control = 'h-12 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[length:calc(16px*var(--fs))] text-navy-900'

// ── Barangay Personnel: closures, holidays, events ───────────────────

export function CalendarManagePage() {
  const { user, can } = useAuth()
  const [tick, setTick] = useState(0)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [cancelling, setCancelling] = useState<Closure | null>(null)
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addingHoliday, setAddingHoliday] = useState(false)
  const today = manilaToday()
  const year = today.slice(0, 4)
  const closures = useMemo(() => closureList().filter((c) => c.status === 'active' && c.to >= today).sort((a, b) => a.from.localeCompare(b.from)), [tick, today])
  const holidays = useMemo(() => holidayList().filter((h) => h.date.startsWith(year) || h.date > today).sort((a, b) => a.date.localeCompare(b.date)), [tick, year, today])
  const events = useMemo(() => calendarEntries(today, addDays(today, 90)).filter((e) => e.kind === 'event'), [tick, today])
  if (!user) return null
  const manage = can('calendar.manage')
  const admin = can('system.settings')
  const done = (text: string) => { setMsg({ ok: true, text }); setTick((t) => t + 1) }
  const fail = (e: unknown) => setMsg({ ok: false, text: errText(e) })
  const serviceNames = (c: Closure) => c.services.map((x) => schedulingRules().services[x as keyof ReturnType<typeof schedulingRules>['services']]?.label ?? x).join(', ')
  const confirmCancel = async () => {
    if (!cancelling) return
    setBusy(true)
    try { await cancelClosure(cancelling.id, why, user); setCancelling(null); setWhy(''); done('Closure cancelled. Residents were told the Hall is open on those days.') } catch (e) { fail(e) } finally { setBusy(false) }
  }
  return (
    <>
      <PageHeader title="Barangay Calendar" />
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mb-4 rounded-[var(--radius-control)] px-4 py-3 text-[length:calc(16px*var(--fs))] ${msg.ok ? 'bg-success-tint text-navy-900' : 'bg-danger-tint text-danger-ink'}`}>{msg.text}</p>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
        <Panel title="Office Closures" actions={manage && !adding && <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => setAdding(true)}>Add a closure</Button>}>
          <div className="space-y-4">
            {manage && adding && <ClosureForm onClose={() => setAdding(false)} onDone={(n) => { setAdding(false); done(n) }} onError={fail} />}
            {closures.length === 0 ? <p className="text-[length:calc(16px*var(--fs))] text-ink-muted">No closures scheduled.</p> : (
              <ul className="divide-y divide-line-soft">
                {closures.map((c) => (
                  <li key={c.id} className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className="block text-[length:calc(16.5px*var(--fs))] font-semibold text-navy-900">{c.from === c.to ? dateLong(c.from) : `${shortDate(c.from)} – ${shortDate(c.to)}`}</span>
                      <span className="block text-[length:calc(15.5px*var(--fs))] text-navy-900">{c.start ? `${formatTime(c.start)}–${formatTime(c.end!)}` : 'Whole day'}{c.services.length ? ` · ${serviceNames(c)} only` : ' · All in-person services'}</span>
                      <span className="block text-[length:calc(15.5px*var(--fs))] break-words text-ink-nav">{c.reason}</span>
                    </span>
                    {manage && <span className="shrink-0"><Button size="sm" variant="danger" className="w-full sm:w-auto" onClick={() => { setWhy(''); setCancelling(c) }}>Cancel closure</Button></span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title={`Holidays ${year}`} actions={admin && !addingHoliday && <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => setAddingHoliday(true)}>Add a holiday</Button>}>
          {admin && addingHoliday && <HolidayForm onClose={() => setAddingHoliday(false)} onDone={(m) => { setAddingHoliday(false); done(m) }} onError={fail} />}
          <ul className="divide-y divide-line-soft">
            {holidays.map((h) => <HolidayRow key={h.id} h={h} admin={admin} onDone={done} onError={fail} />)}
          </ul>
        </Panel>

        <Panel className="xl:col-span-2" title="Barangay Events" bodyClassName="px-0 py-0">
          {events.length === 0 ? <p className="px-5 py-4 text-[length:calc(16px*var(--fs))] text-ink-muted">No upcoming events. Events come from approved announcements.</p> : (
            <ul className="divide-y divide-line-soft">
              {events.map((e) => (
                <li key={e.id}><Link to={`/announcements/${e.id}`} className="flex min-h-[60px] items-center gap-3 px-5 py-3 hover:bg-sky-50">
                  <span className="min-w-0 flex-1"><span className="block text-[length:calc(16px*var(--fs))] font-semibold text-navy-900">{e.title}</span><span className="block text-[length:calc(15px*var(--fs))] text-ink-nav">{shortDate(e.date)}{e.time ? ` · ${formatTime(e.time)}` : ''} · {e.detail}</span></span>
                  <ChevronRight className="size-5 shrink-0 text-ink-subtle" />
                </Link></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {cancelling && (
        <ConfirmDialog title="Cancel this office closure?" confirmLabel="Cancel closure" cancelLabel="Keep it" destructive busy={busy} onCancel={() => setCancelling(null)} onConfirm={confirmCancel}>
          <div className="space-y-3 text-left">
            <p><strong>{cancelling.from === cancelling.to ? dateLong(cancelling.from) : `${shortDate(cancelling.from)} – ${shortDate(cancelling.to)}`}</strong>: the Barangay Hall will be open as usual. Residents are told, and the closure stays on record with your name and the time.</p>
            <FieldLabel label="Reason" required><TextInput value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. The fiesta was moved to next month" /></FieldLabel>
          </div>
        </ConfirmDialog>
      )}
    </>
  )
}

function ClosureForm({ onDone, onError, onClose }: { onDone: (msg: string) => void; onError: (e: unknown) => void; onClose: () => void }) {
  const { user } = useAuth()
  const [f, setF] = useState({ from: '', to: '', part: false, start: '', end: '', some: false, services: [] as string[], reason: '', announce: true })
  const [busy, setBusy] = useState(false)
  if (!user) return null
  const rules = schedulingRules()
  const save = async () => {
    setBusy(true)
    try {
      const r = await addClosure({ from: f.from, to: f.to || f.from, start: f.part ? f.start : undefined, end: f.part ? f.end : undefined, services: f.some ? f.services : [], reason: f.reason, announce: f.announce }, user)
      setF({ from: '', to: '', part: false, start: '', end: '', some: false, services: [], reason: '', announce: true })
      onDone(`Closure saved. ${r.flagged} appointment(s) need a new time (residents were told)${r.moved ? `; ${r.moved} return date(s) moved` : ''}.${f.announce ? ' An announcement draft is ready for the Punong Barangay.' : ''}`)
    } catch (e) { onError(e) } finally { setBusy(false) }
  }
  const check = 'flex min-h-11 items-center gap-2.5 text-[length:calc(16px*var(--fs))] text-navy-900'
  return (
    <div className="space-y-3 rounded-[var(--radius-control)] border border-line p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldLabel label="First day" required><TextInput type="date" min={manilaToday()} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: f.to || e.target.value })} /></FieldLabel>
        <FieldLabel label="Last day"><TextInput type="date" min={f.from || manilaToday()} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></FieldLabel>
      </div>
      <label className={check}><input type="checkbox" className="size-5 accent-[#002132]" checked={f.part} onChange={(e) => setF({ ...f, part: e.target.checked })} /> Only part of the day</label>
      {f.part && (
        <div className="grid grid-cols-2 gap-3">
          <FieldLabel label="From"><TextInput type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></FieldLabel>
          <FieldLabel label="Until"><TextInput type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></FieldLabel>
        </div>
      )}
      <label className={check}><input type="checkbox" className="size-5 accent-[#002132]" checked={f.some} onChange={(e) => setF({ ...f, some: e.target.checked })} /> Only some services</label>
      {f.some && (
        <div className="flex flex-wrap gap-x-5">
          {SERVICE_KEYS.filter((k) => k !== 'mediation' && k !== 'conciliation').map((k) => (
            <label key={k} className={check}><input type="checkbox" className="size-5 accent-[#002132]" checked={f.services.includes(k)} onChange={(e) => setF({ ...f, services: e.target.checked ? [...f.services, k] : f.services.filter((x) => x !== k) })} /> {rules.services[k].label}</label>
          ))}
        </div>
      )}
      <FieldLabel label="Reason (residents will see it)" required><TextInput value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></FieldLabel>
      <label className={check}><input type="checkbox" className="size-5 accent-[#002132]" checked={f.announce} onChange={(e) => setF({ ...f, announce: e.target.checked })} /> Prepare an announcement for the Punong Barangay's approval</label>
      <ActionStack><Button loading={busy} blockedReason={!f.from ? 'Please choose the date of the closure.' : f.reason.trim().length < 5 ? 'Please give the reason (at least 5 characters). Example: Barangay fiesta' : ''} onClick={save}>Save closure</Button><Button variant="secondary" onClick={onClose}>Cancel</Button></ActionStack>
    </div>
  )
}

function HolidayRow({ h, admin, onDone, onError }: { h: Holiday; admin: boolean; onDone: (m: string) => void; onError: (e: unknown) => void }) {
  const { user } = useAuth()
  const [edit, setEdit] = useState(false)
  const [hours, setHours] = useState(h.hours ?? { start: '08:00', end: '12:00' })
  const [why, setWhy] = useState('')
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0">
          <span className="block text-[length:calc(16.5px*var(--fs))] font-semibold break-words text-navy-900">{h.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:calc(15px*var(--fs))] text-ink-nav">
            {shortDate(h.date)}
            <Badge tone={HOLIDAY_TONE[h.type]}>{HOLIDAY_TYPE_LABEL[h.type]}</Badge>
            <span>{h.hallClosed ? 'Hall closed' : h.hours ? `Open ${formatTime(h.hours.start)}–${formatTime(h.hours.end)}` : 'Hall open'}</span>
          </span>
          {edit && <span className="mt-1 block text-[length:calc(14px*var(--fs))] text-ink-muted">Source: {h.source}</span>}
        </span>
        {admin && user && <Button size="sm" variant="secondary" className="w-full shrink-0 sm:w-auto" aria-expanded={edit} onClick={() => setEdit((x) => !x)}>{edit ? 'Close' : 'Office hours'}</Button>}
      </div>
      {edit && user && (
        <div className="mt-3 space-y-3 rounded-[var(--radius-control)] bg-surface-muted p-3">
          <p className="text-[length:calc(14.5px*var(--fs))] text-ink-nav">{h.type === 'local' ? 'Local holiday set by the barangay.' : 'Official national holiday: only the Barangay Hall\'s opening can be changed here, not the date or name.'}</p>
          <ActionStack>
            <Button size="sm" variant={h.hallClosed ? 'secondary' : 'primary'} onClick={() => saveHoliday({ ...h, hallClosed: true, hours: undefined }, user).then(() => { setEdit(false); onDone('Saved. Booked appointments on that day were flagged for a new time.') }).catch(onError)}>Hall closed</Button>
            <Button size="sm" variant={!h.hallClosed ? 'secondary' : 'primary'} onClick={() => saveHoliday({ ...h, hallClosed: false, hours: undefined }, user).then(() => { setEdit(false); onDone('Saved: the hall is open on this day.') }).catch(onError)}>Hall open</Button>
          </ActionStack>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[length:calc(15px*var(--fs))] text-navy-900">Open from<input type="time" className={`${control} w-36`} value={hours.start} onChange={(e) => setHours({ ...hours, start: e.target.value })} /></label>
            <label className="text-[length:calc(15px*var(--fs))] text-navy-900">until<input type="time" className={`${control} w-36`} value={hours.end} onChange={(e) => setHours({ ...hours, end: e.target.value })} /></label>
            <Button size="sm" variant="secondary" onClick={() => saveHoliday({ ...h, hallClosed: false, hours }, user).then(() => { setEdit(false); onDone('Special office hours saved.') }).catch(onError)}>Save special hours</Button>
          </div>
          {h.type === 'local' && (
            <div className="flex flex-wrap gap-2">
              <TextInput aria-label="Reason for removing" placeholder="Reason for removing" className="w-full sm:w-64" value={why} onChange={(e) => setWhy(e.target.value)} />
              <Button size="sm" variant="danger" blockedReason={why.trim().length < 5 && 'Please give the reason for removing this holiday (at least 5 characters).'} onClick={() => removeHoliday(h.id, why, user).then(() => onDone('Holiday removed.')).catch(onError)}>Remove holiday</Button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function HolidayForm({ onDone, onError, onClose }: { onDone: (m: string) => void; onError: (e: unknown) => void; onClose: () => void }) {
  const { user } = useAuth()
  const [f, setF] = useState({ date: '', name: '', type: 'local' as HolidayType, source: '', hallClosed: true })
  if (!user) return null
  return (
    <div className="mb-4 space-y-3 rounded-[var(--radius-control)] border border-line p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldLabel label="Date" required><TextInput type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></FieldLabel>
        <FieldLabel label="Name" required><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></FieldLabel>
        <FieldLabel label="Classification"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as HolidayType, hallClosed: e.target.value !== 'special_working' })}>{(Object.keys(HOLIDAY_TYPE_LABEL) as HolidayType[]).map((t) => <option key={t} value={t}>{HOLIDAY_TYPE_LABEL[t]}</option>)}</Select></FieldLabel>
        <FieldLabel label="Official source" required><TextInput placeholder="e.g. Proclamation No. ___, s. 2026" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></FieldLabel>
      </div>
      <label className="flex min-h-11 items-center gap-2.5 text-[length:calc(16px*var(--fs))] text-navy-900"><input type="checkbox" className="size-5 accent-[#002132]" checked={f.hallClosed} onChange={(e) => setF({ ...f, hallClosed: e.target.checked })} /> The Barangay Hall is closed</label>
      <ActionStack><Button onClick={() => saveHoliday(f, user).then(() => onDone('Holiday added.')).catch(onError)}>Add holiday</Button><Button variant="secondary" onClick={onClose}>Cancel</Button></ActionStack>
    </div>
  )
}

// ── Residents: My Calendar ───────────────────────────────────────────

type Item = { key: string; date: string; title: string; sub: string; mine: boolean; to?: string; detail?: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; label: string }

export function MyCalendarPage() {
  const { user } = useAuth()
  const [apps, setApps] = useState<Appointment[] | null>(null)
  const [view, setView] = useStickyState<'list' | 'month'>('view', 'list')
  const [month, setMonth] = useState(manilaToday().slice(0, 7))
  const [picked, setPicked] = useState<string | null>(null)
  const [params] = useSearchParams()
  const [openKey, setOpenKey] = useState<string | null>(() => params.get('item'))
  useEffect(() => { const k = params.get('item'); if (k) window.setTimeout(() => document.getElementById(`cal-${k}`)?.scrollIntoView({ block: 'center' }), 50) }, [params])
  useEffect(() => { runAppointmentJobs(); runCalendarJobs(); if (user) listMyAppointments(user).then(setApps).catch(() => setApps([])) }, [user])
  if (!user) return null
  const today = manilaToday()
  const horizon = addDays(today, 120)
  const items: Item[] = [
    ...(apps ?? []).filter((a) => a.date && isOpen(a) && a.date >= today).map((a) => ({ key: a.id, date: a.date, title: APPOINTMENT_TYPES[a.kind].label, sub: `${formatTime(a.time)} · Barangay 181 Hall`, mine: true, to: `/my/appointments/${a.id}`, tone: 'info' as const, label: APPOINTMENT_STATUS_LABEL[a.status] })),
    ...hearingsFor(user).filter((h) => h.date >= today).map((h) => ({ key: h.id, date: h.date, title: 'Barangay hearing', sub: `${formatTime(h.time)} · ${h.place}`, mine: true, to: `/my/complaints/${h.caseId}`, tone: 'info' as const, label: 'Scheduled' })),
    ...calendarEntries(today, horizon).map((e) => ({ key: e.id, date: e.date, title: e.title, sub: e.kind === 'event' ? `${e.time ? `${formatTime(e.time)} · ` : ''}${e.detail}` : e.detail, mine: false, to: e.link, detail: e.kind !== 'event' ? e.detail : undefined, tone: (e.hallClosed ? 'neutral' : 'success') as Item['tone'], label: KIND_LABEL[e.kind] })),
  ].sort((a, b) => a.date.localeCompare(b.date))
  const shown = view === 'month' ? items.filter((i) => (picked ? i.date === picked : i.date.startsWith(month))) : items.slice(0, 30)
  return (
    <>
      <BackLink fallbackTo="/dashboard" fallbackLabel="Home" />
      <PageHeader title="My Calendar" />
      <div role="tablist" className="mb-4 flex gap-1.5">
        {([['list', 'Upcoming'], ['month', 'Month']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`h-12 rounded-[var(--radius-control)] px-5 text-[length:calc(16px*var(--fs))] font-semibold ${view === k ? 'bg-navy-900 text-white' : 'border border-line bg-surface text-navy-900'}`}>{l}</button>)}
      </div>
      {view === 'month' && <ResidentMonth month={month} setMonth={(m) => { setMonth(m); setPicked(null) }} items={items} picked={picked} onPick={setPicked} />}
      {apps === null ? <div className="h-32 animate-pulse rounded-[var(--radius-card)] bg-surface" /> : shown.length === 0 ? <Card><EmptyState title={view === 'month' ? 'Nothing on this day' : 'Nothing coming up'} /></Card> : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line-soft">
            {shown.map((i) => {
              const body = (
                <>
                  <span className="grid w-14 shrink-0 place-items-center rounded-[var(--radius-control)] bg-surface-muted py-1.5 text-center leading-tight text-navy-900">
                    <span className="font-display text-[length:calc(22px*var(--fs))] font-extrabold">{Number(i.date.slice(8))}</span>
                    <span className="text-[length:calc(13.5px*var(--fs))] font-semibold uppercase">{new Date(`${i.date}T12:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Manila' })}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[length:calc(13.5px*var(--fs))] font-semibold tracking-wide text-ink-nav uppercase">{i.mine ? 'My appointment' : 'Barangay'}</span>
                    <span className="block text-[length:calc(17px*var(--fs))] font-semibold break-words text-navy-900">{i.title}</span>
                    <span className="block text-[length:calc(15.5px*var(--fs))] break-words text-ink-nav">{i.sub}</span>
                    {openKey === i.key && i.detail && <span className="mt-1 block text-[length:calc(15.5px*var(--fs))] text-navy-900">{i.detail}</span>}
                  </span>
                  <span className="hidden sm:inline-flex"><Badge tone={i.tone}>{i.label}</Badge></span>
                  {i.to && <ChevronRight className="size-5 shrink-0 text-ink-subtle" />}
                </>
              )
              const cls = `flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-sky-50 sm:px-5 ${i.mine ? 'border-l-4 border-navy-900' : 'border-l-4 border-transparent'}`
              return <li key={i.key} id={`cal-${i.key}`}>{i.to ? <Link to={i.to} className={cls}>{body}</Link> : <button type="button" aria-expanded={openKey === i.key} onClick={() => setOpenKey(openKey === i.key ? null : i.key)} className={cls}>{body}</button>}</li>
            })}
          </ul>
        </Card>
      )}
    </>
  )
}

function ResidentMonth({ month, setMonth, items, picked, onPick }: { month: string; setMonth: (m: string) => void; items: Item[]; picked: string | null; onPick: (d: string | null) => void }) {
  const first = `${month}-01`
  const lead = new Date(`${first}T12:00:00+08:00`).getUTCDay()
  const days: string[] = []
  for (let d = first; d.startsWith(month); d = nextDate(d)) days.push(d)
  const shift = (n: number) => { const x = new Date(`${first}T12:00:00+08:00`); x.setUTCMonth(x.getUTCMonth() + n); setMonth(x.toISOString().slice(0, 7)) }
  const today = manilaToday()
  return (
    <Card className="mb-4 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Button size="sm" variant="secondary" aria-label="Previous month" onClick={() => shift(-1)}>‹</Button>
        <p className="text-[length:calc(18px*var(--fs))] font-semibold text-navy-900">{new Date(`${first}T12:00:00+08:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' })}</p>
        <Button size="sm" variant="secondary" aria-label="Next month" onClick={() => shift(1)}>›</Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <div key={i} className="py-1 text-[length:calc(14px*var(--fs))] font-semibold text-ink-nav">{w}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} />)}
        {days.map((d) => {
          const mine = items.some((x) => x.date === d && x.mine)
          const pub = items.some((x) => x.date === d && !x.mine)
          return (
            <button key={d} type="button" onClick={() => onPick(picked === d ? null : d)} aria-label={`${dateLong(d)}${mine ? ', my appointment' : ''}${pub ? ', barangay event or closure' : ''}`}
              className={`flex min-h-12 flex-col items-center justify-center rounded-[var(--radius-control)] ${picked === d ? 'bg-navy-900 text-white' : d === today ? 'border border-navy-900 text-navy-900' : 'text-navy-900 hover:bg-sky-50'}`}>
              <span className="text-[length:calc(16px*var(--fs))] font-semibold">{Number(d.slice(8))}</span>
              <span className="flex h-2 gap-1">{mine && <span className={`size-2 rounded-full ${picked === d ? 'bg-white' : 'bg-navy-900'}`} />}{pub && <span className={`size-2 rounded-full border-2 ${picked === d ? 'border-white' : 'border-navy-600'}`} />}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 flex flex-wrap gap-4 text-[length:calc(14.5px*var(--fs))] text-ink-nav"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-navy-900" /> My appointment</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-navy-600" /> Barangay</span></p>
    </Card>
  )
}

/** Resident home: the next appointment and what is coming up in the barangay. */
