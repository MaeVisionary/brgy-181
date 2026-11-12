import { ROLE_PERMISSIONS } from '@/config/permissions'
import { mockNotifications } from '@/mocks/notifications'
import { mockUsers } from '@/mocks/users'
import type { Permission, User } from '@/types/auth'
import { announcementEvents, saveDraft } from './announcementService'
import { flagForClosure } from './appointmentService'
import { audit } from './auditService'
import { HOLIDAY_TYPE_LABEL, closureList, hallClosedOn, holidayList, saveClosureList, saveHolidayList, type Closure, type Holiday, type HolidayType } from './calendarData'
import { moveDueDatesOffClosedDays } from './equipmentService'
import { ServiceError, mockRequest } from './mockApi'
import { serviceRule } from './schedulingService'

/**
 * BARANGAY CALENDAR ACTIONS. One set of data for every calendar:
 * holidays (System Administrator, with source), office closures and
 * special hours (Secretary), public events (from approved announcements).
 * A closure takes effect at once: booked appointments on those times are
 * flagged for a new time (never cancelled), return deadlines move to the
 * next open day, document deadlines recount working days automatically,
 * and the Punong Barangay and affected people are told.
 */

const can = (u: User, p: Permission) => !!ROLE_PERMISSIONS[u.roleId]?.includes(p) || !!u.extraPermissions?.includes(p)
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function notify(userIds: string[], title: string, body: string, link: string) {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds)) mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category: 'announcement', title, body, createdAt: now, read: false, link })
  window.dispatchEvent(new Event('bmis:notifications-changed'))
}
const usersWith = (p: Permission) => mockUsers.filter((u) => u.status === 'active' && can(u, p)).map((u) => u.id)
const residents = () => mockUsers.filter((u) => u.status === 'active' && u.roleId === 'resident').map((u) => u.id)
const longDate = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })

/** Appointments hit by a closure: on its dates, in its hours, for its services. */
const hits = (c: Pick<Closure, 'from' | 'to' | 'start' | 'end' | 'services'>) => (a: { date: string; time: string; durationMin: number; kind: string }) => {
  if (a.date < c.from || a.date > c.to) return false
  if (c.services.length && !c.services.includes(a.kind)) return false
  if (!c.start) return true
  const s = toMin(a.time), e = s + a.durationMin
  return s < toMin(c.end ?? '23:59') && toMin(c.start) < e
}

export interface ClosureInput { from: string; to: string; start?: string; end?: string; services: string[]; reason: string; announce: boolean }

export function addClosure(i: ClosureInput, by: User): Promise<{ closure: Closure; flagged: number; moved: number }> {
  return mockRequest(() => {
    if (!can(by, 'calendar.manage')) throw new ServiceError('forbidden', 'Only the Barangay Secretary manages office closures.')
    if (!i.from || !i.to || i.to < i.from) throw new ServiceError('dates', 'Choose the dates; the last day cannot be before the first.')
    if (i.reason.trim().length < 5) throw new ServiceError('reason', 'Give the reason (residents will see it).')
    if ((i.start && !i.end) || (!i.start && i.end) || (i.start && i.end && i.end <= i.start)) throw new ServiceError('hours', 'For part of a day, give a start and an end time.')
    for (const s of i.services) if (!serviceRule(s)) throw new ServiceError('service', 'Unknown service.')
    const now = new Date().toISOString()
    const closure: Closure = { id: `clo-${Date.now().toString(36)}`, from: i.from, to: i.to, start: i.start || undefined, end: i.end || undefined, services: i.services, reason: i.reason.trim(), createdBy: by.id, createdAt: now, status: 'active' }
    saveClosureList([...closureList(), closure])
    const flagged = flagForClosure(hits(closure), closure.reason, by.id)
    const moved = moveDueDatesOffClosedDays(by.id)
    const span = i.from === i.to ? longDate(i.from) : `${longDate(i.from)} to ${longDate(i.to)}`
    notify(usersWith('announcements.approve'), 'Office closure recorded', `${span}: ${closure.reason}`, '/calendar')
    if (i.announce) {
      void saveDraft({
        title: i.services.length ? 'Some services unavailable' : 'Barangay Hall closed', category: 'Office Schedule',
        summary: `${i.services.length ? 'Some in-person services are unavailable' : 'The Barangay Hall is closed'} on ${span}.`.slice(0, 160),
        body: `${closure.reason}. Online requests can still be sent and will be processed on the next working day.`,
        publishAt: now, event: { date: i.from, endDate: i.to !== i.from ? i.to : undefined, start: i.start, end: i.end }, audience: 'All residents', urgent: false, bring: [],
      }, by).then((a) => { const l = closureList(); const x = l.find((y) => y.id === closure.id); if (x) { x.announcementId = a.id; saveClosureList(l) } }).catch(() => undefined)
    }
    audit(by, `Office closure: ${span}${i.start ? ` ${i.start}–${i.end}` : ''}${i.services.length ? ` (${i.services.join(', ')})` : ''}`, 'Calendar', `${closure.reason}; ${flagged} appointment(s) to reschedule, ${moved} return date(s) moved`)
    return { closure, flagged, moved }
  })
}

export function cancelClosure(id: string, reason: string, by: User): Promise<Closure> {
  return mockRequest(() => {
    if (!can(by, 'calendar.manage')) throw new ServiceError('forbidden', 'Only the Barangay Secretary manages office closures.')
    if (reason.trim().length < 3) throw new ServiceError('reason', 'Give the reason.')
    const l = closureList()
    const c = l.find((x) => x.id === id)
    if (!c || c.status !== 'active') throw new ServiceError('state', 'This closure is not active.')
    c.status = 'cancelled'
    saveClosureList(l)
    audit(by, `Office closure cancelled: ${c.from}–${c.to}`, 'Calendar', reason.trim())
    notify(usersWith('announcements.approve'), 'Office closure cancelled', `${longDate(c.from)}: ${reason.trim()}`, '/calendar')
    return c
  })
}

// ── Holidays (System Administrator) ──────────────────────────────────
export function saveHoliday(h: Omit<Holiday, 'id'> & { id?: string }, by: User): Promise<Holiday> {
  return mockRequest(() => {
    if (!can(by, 'system.settings')) throw new ServiceError('forbidden', 'Only the System Administrator updates official holidays.')
    if (!h.date || h.name.trim().length < 3) throw new ServiceError('holiday', 'Give the date and name.')
    if (h.source.trim().length < 5) throw new ServiceError('source', 'Give the official source (e.g. the proclamation number).')
    if (!(h.type in HOLIDAY_TYPE_LABEL)) throw new ServiceError('type', 'Choose the classification.')
    if (h.hours && h.hours.end <= h.hours.start) throw new ServiceError('hours', 'Check the special office hours.')
    const l = holidayList()
    const existing = l.find((x) => x.id === h.id || x.date === h.date)
    const rec: Holiday = { ...h, id: existing?.id ?? `hol-${h.date}`, name: h.name.trim(), source: h.source.trim() }
    const next = existing ? l.map((x) => (x.id === existing.id ? rec : x)) : [...l, rec]
    saveHolidayList(next)
    let flagged = 0
    if (rec.hallClosed) { flagged = flagForClosure((a) => a.date === rec.date, rec.name, by.id); moveDueDatesOffClosedDays(by.id) }
    audit(by, `Holiday ${existing ? 'updated' : 'added'}: ${rec.date} ${rec.name}`, 'Calendar', `${HOLIDAY_TYPE_LABEL[rec.type]}; hall ${rec.hallClosed ? 'closed' : 'open'}; ${rec.source}${flagged ? `; ${flagged} appointment(s) to reschedule` : ''}`)
    return rec
  })
}
export function removeHoliday(id: string, reason: string, by: User): Promise<void> {
  return mockRequest(() => {
    if (!can(by, 'system.settings')) throw new ServiceError('forbidden', 'Only the System Administrator updates official holidays.')
    if (reason.trim().length < 5) throw new ServiceError('reason', 'Give the reason.')
    const l = holidayList()
    const h = l.find((x) => x.id === id)
    if (!h) throw new ServiceError('not_found', 'Holiday not found.')
    saveHolidayList(l.filter((x) => x.id !== id))
    audit(by, `Holiday removed: ${h.date} ${h.name}`, 'Calendar', reason.trim())
  })
}

// ── One list for every calendar ──────────────────────────────────────
export type CalendarKind = 'holiday' | 'closure' | 'event'
export interface CalendarEntry { id: string; kind: CalendarKind; date: string; endDate?: string; title: string; detail: string; time?: string; link?: string; hallClosed: boolean }

/** Public calendar items between two dates (holidays, closures, published events). Same for everyone; no private data. */
export function calendarEntries(from: string, to: string): CalendarEntry[] {
  const inRange = (d: string, e?: string) => d <= to && (e ?? d) >= from
  const out: CalendarEntry[] = []
  for (const h of holidayList().filter((x) => inRange(x.date))) out.push({ id: h.id, kind: 'holiday', date: h.date, title: h.name, detail: `${HOLIDAY_TYPE_LABEL[h.type]} · ${h.hallClosed ? 'Barangay Hall closed' : h.hours ? `Open ${h.hours.start}–${h.hours.end}` : 'Barangay Hall open'}`, hallClosed: h.hallClosed })
  for (const c of closureList().filter((x) => x.status === 'active' && inRange(x.from, x.to))) out.push({ id: c.id, kind: 'closure', date: c.from, endDate: c.to !== c.from ? c.to : undefined, title: c.services.length ? 'Some services unavailable' : c.start ? 'Barangay Hall closed part of the day' : 'Barangay Hall closed', detail: c.reason, time: c.start ? `${c.start}–${c.end}` : undefined, hallClosed: !c.start && !c.services.length })
  for (const a of announcementEvents().filter((x) => inRange(x.event!.date!, x.event!.endDate))) out.push({ id: a.id, kind: 'event', date: a.event!.date!, endDate: a.event!.endDate, title: a.title, detail: [a.category, a.event!.location].filter(Boolean).join(' · '), time: a.event!.start, link: `/my/announcements/${a.id}`, hallClosed: false })
  return out.sort((x, y) => x.date.localeCompare(y.date))
}
export { hallClosedOn }

// ── Reminders for public items ───────────────────────────────────────
const SENT_KEY = 'bmis.calendar.sent'
/** Days before, per kind of public item. Only things residents act on: closures and events. */
const EVENT_REMINDERS: Record<string, number[]> = {
  closure: [7, 1], 'Health and Safety': [3, 0], 'Community Activity': [3, 1], 'Government Program': [3, 1], 'Emergency Announcement': [0], 'Community Notice': [3], 'Office Schedule': [7, 1],
}
/** Residents get each notice once (keys kept). Ordinary holidays with no change to services send nothing. */
export function runCalendarJobs(now = Date.now()) {
  let sent: string[] = []
  try { sent = JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]') } catch { /* empty */ }
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const daysTo = (d: string) => Math.round((new Date(`${d}T12:00:00+08:00`).getTime() - new Date(`${today}T12:00:00+08:00`).getTime()) / 86_400_000)
  const send = (key: string, title: string, body: string, link: string) => { if (sent.includes(key)) return; sent.push(key); notify(residents(), title, body, link) }
  for (const c of closureList().filter((x) => x.status === 'active')) {
    const d = daysTo(c.from)
    const plan = EVENT_REMINDERS.closure
    const due = plan.filter((n) => d <= n && d >= 0).sort((x, y) => x - y)[0]
    if (due === undefined) continue
    // Earlier points that were missed count as sent, so a late check sends one notice.
    for (const m of plan.filter((x) => x > due)) if (!sent.includes(`clo-${c.id}-${m}`)) sent.push(`clo-${c.id}-${m}`)
    send(`clo-${c.id}-${due}`, d <= 1 ? (d === 0 ? 'Barangay Hall closed today' : 'Barangay Hall closed tomorrow') : 'Upcoming Barangay Hall closure', `${longDate(c.from)}: ${c.reason}`, '/my/calendar')
  }
  for (const a of announcementEvents()) {
    const d = daysTo(a.event!.date!)
    const plan = EVENT_REMINDERS[a.category] ?? []
    const due = plan.filter((n) => d <= n && d >= 0).sort((x, y) => x - y)[0]
    if (due === undefined) continue
    for (const m of plan.filter((x) => x > due)) if (!sent.includes(`evt-${a.id}-${m}`)) sent.push(`evt-${a.id}-${m}`)
    send(`evt-${a.id}-${due}`, due === 0 ? `Today: ${a.title}` : `Coming up: ${a.title}`, a.summary, `/my/announcements/${a.id}`)
  }
  localStorage.setItem(SENT_KEY, JSON.stringify(sent))
}
export type { Closure, Holiday, HolidayType }
