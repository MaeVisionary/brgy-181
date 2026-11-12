import { CLASSIFICATION_MAX, DEFAULT_STANDARDS, OFFICE_CLOSE_HOUR, type ServiceStandard } from '@/config/serviceStandards'
import { hallClosedOn, holidayList } from './calendarData'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import type { User } from '@/types/auth'
import type { DocumentRequest, DocumentTypeId } from '@/types/document'
import { audit } from './auditService'
import { ServiceError, mockRequest } from './mockApi'

/** Administrator overrides (prototype: this browser). */
const KEY = 'bmis.serviceStandards'
const read = <T,>(k: string, f: T): T => {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : f
  } catch {
    return f
  }
}

export function standardFor(id: DocumentTypeId): ServiceStandard {
  return { ...DEFAULT_STANDARDS[id], ...(read<Partial<Record<DocumentTypeId, Partial<ServiceStandard>>>>(KEY, {})[id] ?? {}) }
}
/** Days the Barangay Hall is closed for a holiday (from the official calendar). */
export function holidays(): { date: string; name: string }[] {
  return holidayList().filter((h) => h.hallClosed).map((h) => ({ date: h.date, name: h.name }))
}

/** Working days allowed: the charter time when set, else the RA 11032 maximum. */
export function allowedDays(s: ServiceStandard): { days: number; fromCharter: boolean } | null {
  if (!s.classification) return null
  const max = CLASSIFICATION_MAX[s.classification]
  return s.charterDays ? { days: Math.min(s.charterDays, max), fromCharter: true } : { days: max, fromCharter: false }
}

const manilaDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
const manilaHour = (d: Date) => Number(d.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' })) % 24
const dayAfter = (iso: string) => {
  const d = new Date(iso + 'T12:00:00+08:00')
  d.setUTCDate(d.getUTCDate() + 1)
  return manilaDay(d)
}

export function isWorkingDay(iso: string, hol?: { date: string; name: string }[]): boolean {
  // Default: the official calendar (holidays, weekends and full-day office closures).
  if (!hol) return !hallClosedOn(iso)
  const wd = new Date(iso + 'T12:00:00+08:00').getUTCDay()
  return wd !== 0 && wd !== 6 && !hol.some((h) => h.date === iso)
}

/**
 * Adds working days to the moment a complete application was received.
 * Received after office hours or on a non-working day → counting starts the
 * next working day. Returns the ISO date of the last allowed working day.
 */
export function addWorkingDays(receivedAt: Date, days: number, hol?: { date: string; name: string }[]): string {
  let day = manilaDay(receivedAt)
  // The day of receipt counts as day 1 only if received on a working day within office hours.
  let counted = isWorkingDay(day, hol) && manilaHour(receivedAt) < OFFICE_CLOSE_HOUR ? 1 : 0
  while (counted < days) {
    day = dayAfter(day)
    if (isWorkingDay(day, hol)) counted++
  }
  if (!isWorkingDay(day, hol)) while (!isWorkingDay(day, hol)) day = dayAfter(day)
  return day
}

/** When the complete application was received: the latest reply to a request for more information, else submission. */
export function receivedComplete(req: DocumentRequest): Date {
  const replies = req.history.filter((h, i) => i > 0 && req.history[i - 1].status === 'needs_info' && h.status !== 'needs_info')
  return new Date(replies.length ? replies[replies.length - 1].at : req.submittedAt)
}

export interface Estimate {
  days: number
  fromCharter: boolean
  /** ISO date. */
  expectedBy: string
  extended?: { reason: string; newDate: string }
}

export function estimateFor(req: DocumentRequest): Estimate | null {
  const a = allowedDays(standardFor(req.typeId))
  if (!a) return null
  if (req.status === 'needs_info') return null
  const expectedBy = addWorkingDays(receivedComplete(req), a.days)
  return { ...a, expectedBy, extended: req.extension ? { reason: req.extension.reason, newDate: req.extension.newDate } : undefined }
}

const can = (u: User, p: string) => (ROLE_PERMISSIONS[u.roleId] as readonly string[] | undefined)?.includes(p) || !!u.extraPermissions?.includes(p as never)

/** Administrator: change a service's standard (audited). */
export function updateStandard(id: DocumentTypeId, patch: Partial<ServiceStandard>, by: User): Promise<ServiceStandard> {
  return mockRequest(() => {
    if (!can(by, 'system.settings')) throw new ServiceError('forbidden', 'Only administrators can change service standards.')
    const next = { ...standardFor(id), ...patch }
    if (next.charterDays !== undefined && next.classification && next.charterDays > CLASSIFICATION_MAX[next.classification])
      throw new ServiceError('days', `A ${next.classification.replace('_', ' ')} transaction may not exceed ${CLASSIFICATION_MAX[next.classification]} working days (RA 11032).`)
    if (next.charterDays !== undefined && next.charterDays < 1) throw new ServiceError('days', 'Enter at least 1 working day.')
    const all = read<Record<string, Partial<ServiceStandard>>>(KEY, {})
    all[id] = { ...(all[id] ?? {}), ...patch }
    localStorage.setItem(KEY, JSON.stringify(all))
    audit(by, 'Changed service standard', 'Settings', id)
    return next
  })
}

