import { ROLE_PERMISSIONS } from '@/config/permissions'
import { mockUsers } from '@/mocks/users'
import type { Permission, RoleId, User } from '@/types/auth'
import { audit } from './auditService'
import { ServiceError } from './mockApi'
import { isWorkingDay } from './serviceStandardService'
import { closedFor, specialHours } from './calendarData'

/**
 * SCHEDULING RULES AND SLOT ENGINE (deterministic, no AI).
 *
 * One engine for every staffed appointment: in-person verification visits
 * and equipment pickups. It works out how long a visit takes from the
 * documents to check, then offers only start times where the staff member is
 * on duty, not on leave, not already booked (with a buffer), the office is
 * open, it is not a holiday, and the office-wide limit is not reached.
 *
 * Prototype: rules live in this browser and the check runs in the same
 * synchronous step as the save, so two clicks cannot both take the last
 * slot here. On Supabase the same check runs in a database function with an
 * exclusion constraint (docs/supabase/scheduling.sql); the browser result is
 * only a preview.
 */

export interface StaffSchedule {
  /** 0 = Sunday … 6 = Saturday. */
  days: number[]
  start: string
  end: string
}
export interface StaffLeave { id: string; staffId: string; from: string; to: string; reason: string }

/** When reminders go out. "day" = 7:00 AM on the day itself. */
export type ReminderKey = '7d' | '3d' | '1d' | 'day' | '1h'
export const REMINDER_LABEL: Record<ReminderKey, string> = { '7d': '7 days before', '3d': '3 days before', '1d': '1 day before', day: 'On the day', '1h': '1 hour before' }

/** Rules for one kind of appointment (Microsoft Bookings / Calendly style service settings). */
export interface ServiceRule {
  label: string
  /** Expected length; for verification visits this is a floor, the documents decide. */
  minutes: number
  /** Free time kept after it for the same staff member (preparation and recovery). */
  buffer: number
  /** Start times are offered every N minutes. */
  step: number
  /** Roles that handle it; staff are chosen among them automatically. */
  roles: RoleId[]
  /** Per staff member per day (0 = only the office-wide limit). */
  maxPerDay: number
  /** Residents may move or cancel up to this many hours before. */
  cancelHours: number
  reminders: ReminderKey[]
  /** Residents can book it themselves from "Book a visit". */
  residentBookable: boolean
  /** The assigned official confirms before it is final. */
  staffConfirms: boolean
}
export type ServiceKey = 'correction_verification' | 'document_claim' | 'complaint_consult' | 'equipment_pickup' | 'equipment_return' | 'chairman_consult' | 'community_concern' | 'mediation_inquiry' | 'mediation' | 'conciliation'

export interface SchedulingRules {
  /** 24-hour "HH:MM", Manila time. */
  officeStart: string
  officeEnd: string
  breakStart: string
  breakEnd: string
  /** Start times are offered on this step. */
  stepMinutes: number
  /** Free time kept after each appointment for the same staff member. */
  bufferMinutes: number
  /** Appointments running at the same time across all staff. */
  maxConcurrent: number
  /** Earliest bookable start, from now. */
  leadMinutes: number
  /** Office-wide appointments per day. */
  maxPerDay: number
  /** Fixed lengths for services that do not depend on documents. */
  typeMinutes: Record<string, number>
  /** A visit becomes "No show" this long after its end when nobody checked the resident in. */
  noShowGraceMinutes: number
  /** Reminder times before the visit, in hours. */
  reminderHours: number[]
  /** Minutes to check one item of each kind. */
  documentMinutes: Record<string, number>
  defaultDocumentMinutes: number
  /** Several items in one visit: the longest one, plus this for each extra item, kept between the floor and cap. */
  extraDocumentMinutes: number
  multiDocumentMin: number
  multiDocumentMax: number
  /** One entry per service; see ServiceRule. */
  services: Record<ServiceKey, ServiceRule>
  /** Appointments per staff member per day, all services together. */
  staffDailyLimit: number
  /** Longest stretch of back-to-back appointments before a break is kept. */
  maxContinuousMinutes: number
  /** Working hours per staff member; staff without an entry follow office hours on working days. */
  staff: Record<string, StaffSchedule>
  leave: StaffLeave[]
  version: number
  updatedAt?: string
  updatedBy?: string
}

/** Initial operating estimates (not legal processing times). Administrators can change them. */
export const DEFAULT_RULES: SchedulingRules = {
  officeStart: '08:00',
  officeEnd: '17:00',
  breakStart: '12:00',
  breakEnd: '13:00',
  stepMinutes: 15,
  bufferMinutes: 5,
  maxConcurrent: 2,
  leadMinutes: 30,
  maxPerDay: 40,
  typeMinutes: { document_claim: 10, equipment_pickup: 15, equipment_return: 15, complaint_consult: 30, hearing: 60 },
  noShowGraceMinutes: 30,
  reminderHours: [24, 2],
  documentMinutes: {
    'Original valid government-issued ID': 10,
    'Original PSA birth certificate': 15,
    'Original marriage certificate': 15,
    'Original proof of employment': 10,
    'Original proof of address': 10,
  },
  defaultDocumentMinutes: 10,
  extraDocumentMinutes: 5,
  multiDocumentMin: 20,
  multiDocumentMax: 30,
  services: {
    document_claim: { label: 'Document claiming', minutes: 10, buffer: 5, step: 15, roles: ['secretary'], maxPerDay: 0, cancelHours: 2, reminders: ['1d', 'day', '1h'], residentBookable: false, staffConfirms: false },
    correction_verification: { label: 'Original document verification', minutes: 15, buffer: 5, step: 15, roles: ['secretary'], maxPerDay: 0, cancelHours: 2, reminders: ['3d', '1d', 'day', '1h'], residentBookable: false, staffConfirms: false },
    complaint_consult: { label: 'Complaint follow-up', minutes: 30, buffer: 10, step: 30, roles: ['chairman'], maxPerDay: 4, cancelHours: 24, reminders: ['3d', '1d', 'day', '1h'], residentBookable: true, staffConfirms: true },
    equipment_pickup: { label: 'Equipment release', minutes: 15, buffer: 5, step: 15, roles: ['property_custodian'], maxPerDay: 0, cancelHours: 2, reminders: ['1d', 'day', '1h'], residentBookable: false, staffConfirms: false },
    equipment_return: { label: 'Equipment return and inspection', minutes: 15, buffer: 5, step: 15, roles: ['property_custodian'], maxPerDay: 0, cancelHours: 2, reminders: ['1d', 'day'], residentBookable: false, staffConfirms: false },
    chairman_consult: { label: 'Barangay consultation (Punong Barangay)', minutes: 20, buffer: 10, step: 30, roles: ['chairman'], maxPerDay: 4, cancelHours: 24, reminders: ['1d', 'day', '1h'], residentBookable: true, staffConfirms: true },
    community_concern: { label: 'Community concern', minutes: 20, buffer: 5, step: 15, roles: ['secretary'], maxPerDay: 6, cancelHours: 2, reminders: ['1d', 'day', '1h'], residentBookable: true, staffConfirms: false },
    mediation_inquiry: { label: 'Mediation or dispute: first visit (Punong Barangay)', minutes: 30, buffer: 10, step: 30, roles: ['chairman'], maxPerDay: 3, cancelHours: 24, reminders: ['3d', '1d', 'day', '1h'], residentBookable: true, staffConfirms: true },
    mediation: { label: 'Mediation hearing (Punong Barangay)', minutes: 60, buffer: 15, step: 30, roles: ['chairman'], maxPerDay: 3, cancelHours: 48, reminders: ['7d', '3d', '1d', 'day', '1h'], residentBookable: false, staffConfirms: true },
    conciliation: { label: 'Conciliation hearing (Pangkat)', minutes: 60, buffer: 15, step: 30, roles: [], maxPerDay: 3, cancelHours: 48, reminders: ['7d', '3d', '1d', 'day', '1h'], residentBookable: false, staffConfirms: true },
  },
  staffDailyLimit: 16,
  maxContinuousMinutes: 120,
  staff: {},
  leave: [],
  version: 1,
}
export const SERVICE_KEYS = Object.keys(DEFAULT_RULES.services) as ServiceKey[]
export const serviceRule = (k: string, r = schedulingRules()): ServiceRule | undefined => r.services[k as ServiceKey]

const KEY = 'bmis.schedulingRules'
const SERVICE_KEYS_RAW: ServiceKey[] = ['document_claim', 'correction_verification', 'complaint_consult', 'equipment_pickup', 'equipment_return', 'chairman_consult', 'community_concern', 'mediation_inquiry', 'mediation', 'conciliation']
export function schedulingRules(): SchedulingRules {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SchedulingRules> | null
    return saved ? { ...DEFAULT_RULES, ...saved, documentMinutes: { ...DEFAULT_RULES.documentMinutes, ...saved.documentMinutes }, typeMinutes: { ...DEFAULT_RULES.typeMinutes, ...saved.typeMinutes }, services: Object.fromEntries(SERVICE_KEYS_RAW.map((k) => [k, { ...DEFAULT_RULES.services[k], ...saved.services?.[k] }])) as SchedulingRules['services'] } : DEFAULT_RULES
  } catch {
    return DEFAULT_RULES
  }
}

export const can = (u: User, p: Permission) => !!ROLE_PERMISSIONS[u.roleId]?.includes(p) || !!u.extraPermissions?.includes(p)

export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
export const startsAt = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`).getTime()
export const formatTime = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }
export const addMinutes = (t: string, n: number) => fromMin(toMin(t) + n)
const weekday = (date: string) => new Date(`${date}T12:00:00+08:00`).getUTCDay()
export const manilaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
export const nextDate = (date: string) => new Date(new Date(`${date}T12:00:00+08:00`).getTime() + 86_400_000).toISOString().slice(0, 10)

// ── Duration ─────────────────────────────────────────────────────────
export interface DurationEstimate { minutes: number; lines: { item: string; minutes: number }[]; note: string }

/** How long checking these items takes. Several items are checked together, so times are not simply added. */
export function estimateDuration(items: string[], rules = schedulingRules()): DurationEstimate {
  const lines = items.map((item) => ({ item, minutes: rules.documentMinutes[item] ?? rules.defaultDocumentMinutes }))
  if (lines.length === 0) return { minutes: 0, lines, note: 'Choose what to check.' }
  if (lines.length === 1) return { minutes: lines[0].minutes, lines, note: 'One item to check.' }
  const longest = Math.max(...lines.map((l) => l.minutes))
  const raw = longest + rules.extraDocumentMinutes * (lines.length - 1)
  const minutes = Math.min(rules.multiDocumentMax, Math.max(rules.multiDocumentMin, raw))
  return { minutes, lines, note: `${lines.length} items checked in one visit: the longest (${longest} min) plus ${rules.extraDocumentMinutes} min for each other item, kept between ${rules.multiDocumentMin} and ${rules.multiDocumentMax} min.` }
}

// ── Bookings from every feature that uses staff time ─────────────────
export interface Booking { id: string; staffId: string; date: string; time: string; minutes: number; label: string; buffer?: number; service?: string }
const sources: (() => Booking[])[] = []
/** Each feature that books staff time registers its open bookings here. */
export function registerBookings(fn: () => Booking[]) { sources.push(fn) }
const allBookings = () => sources.flatMap((f) => f())

// ── Availability ─────────────────────────────────────────────────────
export function staffHours(staffId: string, date: string, rules = schedulingRules()): { start: string; end: string } | null {
  const special = specialHours(date)
  if (special) rules = { ...rules, officeStart: special.start, officeEnd: special.end }
  const s = rules.staff[staffId]
  if (s && !s.days.includes(weekday(date))) return null
  const start = fromMin(Math.max(toMin(rules.officeStart), toMin(s?.start ?? rules.officeStart)))
  const end = fromMin(Math.min(toMin(rules.officeEnd), toMin(s?.end ?? rules.officeEnd)))
  return toMin(start) < toMin(end) ? { start, end } : null
}
export const onLeave = (staffId: string, date: string, rules = schedulingRules()) => rules.leave.find((l) => l.staffId === staffId && l.from <= date && date <= l.to)

/** Why a staff member has no times on a date, or null if they may have some. */
export function unavailableReason(staffId: string, date: string, rules = schedulingRules()): string | null {
  if (!isWorkingDay(date)) return 'The Barangay Hall is closed on this day.'
  const leave = onLeave(staffId, date, rules)
  if (leave) return `On leave (${leave.reason}).`
  if (!staffHours(staffId, date, rules)) return 'Not on duty this day.'
  return null
}

export interface Slot { time: string; end: string }

/**
 * Start times where the visit fits for this staff member. `ignoreId` leaves
 * out the booking being moved. With a `service`, its own start interval,
 * buffer and daily limit apply; buffers of existing bookings are their own.
 */
export function freeSlots(date: string, staffId: string, minutes: number, ignoreId?: string, service?: string, now = Date.now()): Slot[] {
  const r = schedulingRules()
  if (minutes <= 0 || unavailableReason(staffId, date, r)) return []
  const rule = service ? serviceRule(service, r) : undefined
  const step = rule?.step ?? r.stepMinutes
  const buffer = rule?.buffer ?? r.bufferMinutes
  const hours = staffHours(staffId, date, r)!
  const day = allBookings().filter((b) => b.id !== ignoreId && b.date === date)
  if (day.length >= r.maxPerDay) return []
  const mine = day.filter((b) => b.staffId === staffId)
  // Workload protection: per-person daily limit, and per-service limit for this person.
  if (mine.length >= r.staffDailyLimit) return []
  if (rule?.maxPerDay && mine.filter((b) => b.service === service).length >= rule.maxPerDay) return []
  const span = (b: { time: string; minutes: number }) => [toMin(b.time), toMin(b.time) + b.minutes] as const
  const out: Slot[] = []
  const first = Math.ceil(toMin(hours.start) / step) * step
  for (let t = first; t + minutes <= toMin(hours.end); t += step) {
    const e = t + minutes
    if (t < toMin(r.breakEnd) && e > toMin(r.breakStart)) continue
    if (startsAt(date, fromMin(t)) < now + r.leadMinutes * 60_000) continue
    // Part-day or service-only office closures.
    if (closedFor(date, service, t, e)) continue
    // Same staff: no overlap; each side keeps its own buffer after it.
    if (mine.some((b) => t < span(b)[1] + (b.buffer ?? r.bufferMinutes) && span(b)[0] < e + buffer)) continue
    // No stretch of back-to-back work longer than the limit (gaps shorter than 10 minutes do not count as a break).
    if (continuousWith(mine, t, e) > r.maxContinuousMinutes) continue
    // Office-wide limit at any minute of this visit.
    const overlapping = day.filter((b) => t < span(b)[1] && span(b)[0] < e)
    let peak = 0
    for (let m = t; m < e; m++) peak = Math.max(peak, overlapping.filter((b) => span(b)[0] <= m && m < span(b)[1]).length)
    if (peak >= r.maxConcurrent) continue
    out.push({ time: fromMin(t), end: fromMin(e) })
  }
  return out
}

/** Staff allowed to do this kind of appointment. */
export const eligibleStaff = (permission: Permission) => mockUsers.filter((u) => u.status === 'active' && can(u, permission))

function continuousWith(mine: Booking[], t: number, e: number): number {
  const blocks = [...mine.map((b) => [toMin(b.time), toMin(b.time) + b.minutes] as [number, number]), [t, e] as [number, number]].sort((a, b) => a[0] - b[0])
  let best = 0
  let cur: [number, number] | null = null
  for (const bl of blocks) {
    if (cur && bl[0] - cur[1] < 10) cur = [cur[0], Math.max(cur[1], bl[1])]
    else cur = [bl[0], bl[1]]
    if (cur[0] <= e && t <= cur[1]) best = Math.max(best, cur[1] - cur[0])
  }
  return best
}

/** Busy minutes and remaining free start times for one person on one day (workload indicator). */
export function workload(staffId: string, date: string) {
  const r = schedulingRules()
  const mine = allBookings().filter((b) => b.staffId === staffId && b.date === date)
  const hours = staffHours(staffId, date, r)
  const open = hours && !unavailableReason(staffId, date, r) ? toMin(hours.end) - toMin(hours.start) - Math.max(0, Math.min(toMin(hours.end), toMin(r.breakEnd)) - Math.max(toMin(hours.start), toMin(r.breakStart))) : 0
  const busy = mine.reduce((n, b) => n + b.minutes + (b.buffer ?? r.bufferMinutes), 0)
  return { count: mine.length, busyMinutes: busy, openMinutes: open, freeMinutes: Math.max(0, open - busy), limit: r.staffDailyLimit }
}

/** Staff who handle a service: by role from the service rule (configurable), else by permission. */
export function staffForService(service: string, fallback?: Permission): User[] {
  const rule = serviceRule(service)
  const byRole = rule ? mockUsers.filter((u) => u.status === 'active' && rule.roles.includes(u.roleId)) : []
  return byRole.length || !fallback ? byRole : eligibleStaff(fallback)
}

export interface Suggestion { date: string; time: string; end: string; staffId: string }

/** Earliest open time from a date on: for one staff member, or any eligible one. Looks ahead 30 days. */
export function nextAvailable(fromDate: string, minutes: number, staffIds: string[], ignoreId?: string, service?: string): Suggestion | null {
  let d = fromDate
  for (let i = 0; i < 30; i++, d = nextDate(d)) {
    const best = staffIds.map((s) => ({ s, slot: freeSlots(d, s, minutes, ignoreId, service)[0] })).filter((x) => x.slot).sort((a, b) => toMin(a.slot.time) - toMin(b.slot.time))[0]
    if (best) return { date: d, time: best.slot.time, end: best.slot.end, staffId: best.s }
  }
  return null
}

/** Re-checks right before saving; throws if the time is gone. */
export function assertFree(date: string, time: string, staffId: string, minutes: number, ignoreId?: string, service?: string) {
  const why = unavailableReason(staffId, date)
  if (why) throw new ServiceError('staff_unavailable', `The chosen member of the Barangay Personnel cannot take this visit: ${why}`)
  if (!freeSlots(date, staffId, minutes, ignoreId, service).some((s) => s.time === time)) throw new ServiceError('slot', 'That time is no longer available. Choose another.')
}

// ── Administration ───────────────────────────────────────────────────
export function saveSchedulingRules(next: SchedulingRules, by: User): SchedulingRules {
  if (!can(by, 'system.settings')) throw new ServiceError('forbidden', 'Only the System Administrator can change scheduling rules.')
  const bad = (t: string) => !/^\d{2}:\d{2}$/.test(t)
  if ([next.officeStart, next.officeEnd, next.breakStart, next.breakEnd].some(bad) || toMin(next.officeStart) >= toMin(next.officeEnd)) throw new ServiceError('hours', 'Check the office hours.')
  if (toMin(next.breakStart) > toMin(next.breakEnd)) throw new ServiceError('break', 'The break must end after it starts.')
  if (toMin(next.breakStart) < toMin(next.officeStart) || toMin(next.breakEnd) > toMin(next.officeEnd)) throw new ServiceError('break', 'The break must be within office hours.')
  if (toMin(next.officeEnd) - toMin(next.officeStart) - (toMin(next.breakEnd) - toMin(next.breakStart)) < 30) throw new ServiceError('hours', 'Office hours leave no time for appointments.')
  if (![5, 10, 15, 30].includes(next.stepMinutes)) throw new ServiceError('step', 'Start times can be every 5, 10, 15 or 30 minutes.')
  if (next.maxPerDay < 1 || next.noShowGraceMinutes < 0 || Object.values(next.typeMinutes).some((m) => !(m >= 5 && m <= 240)) || next.reminderHours.some((h) => !(h > 0 && h <= 72))) throw new ServiceError('limits', 'Check the daily limit, service lengths, no-show time and reminders.')
  if (next.bufferMinutes < 0 || next.bufferMinutes > 60 || next.maxConcurrent < 1 || next.maxConcurrent > 20 || next.leadMinutes < 0) throw new ServiceError('limits', 'Check the buffer, limit and notice time.')
  if (Object.values(next.documentMinutes).some((m) => !(m >= 5 && m <= 120)) || next.multiDocumentMin > next.multiDocumentMax) throw new ServiceError('durations', 'Durations must be between 5 and 120 minutes, and the floor cannot be above the cap.')
  for (const [k, sv] of Object.entries(next.services)) {
    if (!(sv.minutes >= 5 && sv.minutes <= 240) || !(sv.buffer >= 0 && sv.buffer <= 60) || ![5, 10, 15, 30, 60].includes(sv.step) || sv.maxPerDay < 0 || sv.cancelHours < 0)
      throw new ServiceError('service', `Check the settings for ${next.services[k as ServiceKey].label}.`)
  }
  if (!(next.staffDailyLimit >= 1) || !(next.maxContinuousMinutes >= 30)) throw new ServiceError('workload', 'Check the daily limit per person and the longest stretch without a break.')
  for (const [id, s] of Object.entries(next.staff)) if (bad(s.start) || bad(s.end) || toMin(s.start) >= toMin(s.end)) throw new ServiceError('staff', `Check the hours for ${mockUsers.find((u) => u.id === id)?.fullName ?? id}.`)
  for (const l of next.leave) if (!l.from || !l.to || l.from > l.to || l.reason.trim().length < 3) throw new ServiceError('leave', 'Each leave needs a start, an end after it, and a reason.')
  const prev = schedulingRules()
  const changed = (Object.keys(next) as (keyof SchedulingRules)[]).filter((k) => !['version', 'updatedAt', 'updatedBy'].includes(k) && JSON.stringify(next[k]) !== JSON.stringify(prev[k]))
  if (!changed.length) return prev
  const saved: SchedulingRules = { ...next, version: prev.version + 1, updatedAt: new Date().toISOString(), updatedBy: by.id }
  localStorage.setItem(KEY, JSON.stringify(saved))
  audit(by, `Scheduling rules changed (version ${saved.version})`, 'Settings', `Changed: ${changed.join(', ')}`)
  return saved
}

export type DayState = 'open' | 'full' | 'closed'
/** For the date list: is a day bookable for any of these staff? */
export function dayState(date: string, minutes: number, staffIds: string[], ignoreId?: string, service?: string): { state: DayState; free: number } {
  // "Closed" only when the hall is closed; staff leave shows as no free times.
  if (!isWorkingDay(date)) return { state: 'closed', free: 0 }
  const times = new Set(staffIds.flatMap((s) => freeSlots(date, s, minutes, ignoreId, service).map((x) => x.time)))
  return { state: times.size ? 'open' : 'full', free: times.size }
}
/** Free start times across staff, each with the staff member who has the lightest day. */
export function openTimes(date: string, minutes: number, staffIds: string[], ignoreId?: string, service?: string): (Slot & { staffId: string })[] {
  // Fair distribution: the person with the least booked time that day gets the slot.
  const load = (s: string) => allBookings().filter((b) => b.staffId === s && b.date === date).reduce((n, b) => n + b.minutes, 0)
  const byTime = new Map<string, Slot & { staffId: string }>()
  for (const s of [...staffIds].sort((a, b) => load(a) - load(b)))
    for (const slot of freeSlots(date, s, minutes, ignoreId, service)) if (!byTime.has(slot.time)) byTime.set(slot.time, { ...slot, staffId: s })
  return [...byTime.values()].sort((a, b) => toMin(a.time) - toMin(b.time))
}
/** Bookings for a day (for the staff calendar). */
export const bookingsOn = (date: string) => allBookings().filter((b) => b.date === date)
