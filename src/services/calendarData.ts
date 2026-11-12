import { DEFAULT_HOLIDAYS } from '@/config/serviceStandards'

/**
 * OFFICIAL BARANGAY CALENDAR DATA (no other dependencies, so every module can
 * use it): Philippine holidays with their classification and source, office
 * closures, and special office hours. Working days, booking slots and
 * processing deadlines all read from here.
 *
 * Holidays come from the year's proclamation. They are never guessed: Eid'l
 * Fitr and Eid'l Adha, and Manila local holidays, are added by the
 * administrator when their proclamations are issued. Whether the Barangay Hall
 * closes is a separate, editable choice (a holiday does not always close it).
 */

export type HolidayType = 'regular' | 'special_non_working' | 'special_working' | 'local'
export const HOLIDAY_TYPE_LABEL: Record<HolidayType, string> = {
  regular: 'Regular holiday', special_non_working: 'Special non-working day', special_working: 'Special working day', local: 'Local holiday (Manila)',
}
export interface Holiday {
  id: string
  date: string
  name: string
  type: HolidayType
  /** Where the date comes from (proclamation or ordinance). */
  source: string
  /** The Barangay Hall is closed (in-person services and appointments stop). */
  hallClosed: boolean
  /** Office hours on this day when the hall is open (special schedule). */
  hours?: { start: string; end: string }
}

const P1006 = 'Proclamation No. 1006, s. 2025'
/** 2026 holidays as declared in Proclamation No. 1006 (signed 3 September 2025). */
export const HOLIDAYS_2026: Holiday[] = [
  ['2026-01-01', "New Year's Day", 'regular'],
  ['2026-02-17', 'Chinese New Year', 'special_non_working'],
  ['2026-02-25', 'EDSA People Power Revolution Anniversary', 'special_working'],
  ['2026-04-02', 'Maundy Thursday', 'regular'],
  ['2026-04-03', 'Good Friday', 'regular'],
  ['2026-04-04', 'Black Saturday', 'special_non_working'],
  ['2026-04-09', 'Araw ng Kagitingan', 'regular'],
  ['2026-05-01', 'Labor Day', 'regular'],
  ['2026-06-12', 'Independence Day', 'regular'],
  ['2026-08-21', 'Ninoy Aquino Day', 'special_non_working'],
  ['2026-08-31', 'National Heroes Day', 'regular'],
  ['2026-11-01', "All Saints' Day", 'special_non_working'],
  ['2026-11-02', "All Souls' Day", 'special_non_working'],
  ['2026-11-30', 'Bonifacio Day', 'regular'],
  ['2026-12-08', 'Feast of the Immaculate Conception of Mary', 'special_non_working'],
  ['2026-12-24', 'Christmas Eve', 'special_non_working'],
  ['2026-12-25', 'Christmas Day', 'regular'],
  ['2026-12-30', 'Rizal Day', 'regular'],
  ['2026-12-31', 'Last Day of the Year', 'special_non_working'],
].map(([date, name, type]) => ({ id: `hol-${date}`, date, name, type: type as HolidayType, source: P1006, hallClosed: type !== 'special_working' }))

/** A closure decided by the barangay: whole days, part of a day, or only some services. */
export interface Closure {
  id: string
  from: string
  to: string
  /** Part of the day only ("HH:MM"); empty = the whole day. */
  start?: string
  end?: string
  /** Only these appointment services stop; empty = all in-person services. */
  services: string[]
  reason: string
  createdBy: string
  createdAt: string
  status: 'active' | 'cancelled'
  /** Who cancelled it, when and why (kept on the record; the closure is never deleted). */
  cancelled?: { by: string; at: string; reason: string }
  /** Announcement draft created for the public notice. */
  announcementId?: string
}

const HOL_KEY = 'bmis.calendar.holidays'
const CLO_KEY = 'bmis.calendar.closures'
const OLD_HOL_KEY = 'bmis.holidays'
const read = <T,>(k: string): T | null => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') as T | null } catch { return null } }

export function holidayList(): Holiday[] {
  const saved = read<Holiday[]>(HOL_KEY)
  if (saved) return saved
  // Older list (date and name only): keep entries the administrator added.
  const old = read<{ date: string; name: string }[]>(OLD_HOL_KEY)
  const extra = (old ?? []).filter((o) => !HOLIDAYS_2026.some((h) => h.date === o.date) && !DEFAULT_HOLIDAYS.some((d) => d.date === o.date))
    .map((o) => ({ id: `hol-${o.date}`, date: o.date, name: o.name, type: 'local' as const, source: 'Added by the administrator', hallClosed: true }))
  return [...HOLIDAYS_2026, ...extra].sort((a, b) => a.date.localeCompare(b.date))
}
export const saveHolidayList = (l: Holiday[]) => localStorage.setItem(HOL_KEY, JSON.stringify([...l].sort((a, b) => a.date.localeCompare(b.date))))
export const closureList = (): Closure[] => read<Closure[]>(CLO_KEY) ?? []
export const saveClosureList = (l: Closure[]) => localStorage.setItem(CLO_KEY, JSON.stringify(l))

export const holidayOn = (date: string) => holidayList().find((h) => h.date === date)
const activeClosures = (date: string) => closureList().filter((c) => c.status === 'active' && c.from <= date && date <= c.to)

/** The hall is closed the whole day for everyone (weekend, closed holiday, or a full closure for all services). */
export function hallClosedOn(date: string): boolean {
  const wd = new Date(`${date}T12:00:00+08:00`).getUTCDay()
  const h = holidayOn(date)
  if (h) return h.hallClosed
  if (wd === 0 || wd === 6) return true
  return activeClosures(date).some((c) => !c.start && !c.services.length)
}

/** Why this time is closed for this service, or null. Covers part-day and service-only closures. */
export function closedFor(date: string, service: string | undefined, startMin: number, endMin: number): string | null {
  for (const c of activeClosures(date)) {
    if (c.services.length && (!service || !c.services.includes(service))) continue
    if (!c.start) return c.reason
    const [sh, sm] = c.start.split(':').map(Number)
    const [eh, em] = (c.end ?? '23:59').split(':').map(Number)
    if (startMin < eh * 60 + em && sh * 60 + sm < endMin) return c.reason
  }
  return null
}

/** Special office hours for a date (an open holiday with its own schedule). */
export const specialHours = (date: string) => { const h = holidayOn(date); return h && !h.hallClosed ? h.hours : undefined }
