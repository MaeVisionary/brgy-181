import { ROLE_PERMISSIONS } from '@/config/permissions'
import { DEFAULT_STANDARDS } from '@/config/serviceStandards'
import { mockDocumentRequests } from '@/mocks/documentRequests'
import { mockUsers } from '@/mocks/users'
import type { User } from '@/types/auth'
import type { DocumentRequest, DocumentStatus, DocumentTypeId } from '@/types/document'
import { audit } from './auditService'
import { ServiceError, mockRequest } from './mockApi'
import { onLeave, schedulingRules, toMin } from './schedulingService'
import { estimateFor, isWorkingDay, receivedComplete } from './serviceStandardService'

/**
 * DOCUMENT PROCESSING TIME (operations, not the legal limit).
 *
 * Each document type has its own preparation time in OFFICE HOURS, between
 * 12 and 124 hours (initial business rule). Counting runs only while the
 * Barangay Hall is open (office hours, minus the lunch break), skips weekends,
 * holidays and closures, skips days when every person who prepares documents
 * is on leave, and adds a day of waiting for every full day's worth of
 * requests already ahead in the queue. Waiting for the resident's reply
 * ("needs more information") pauses the count: it starts again from the reply.
 *
 * The RA 11032 / Citizen's Charter deadline (serviceStandardService) stays the
 * legal maximum; an estimate past it is flagged for the Secretary.
 */

export const PROCESSING_LIMITS = { minHours: 12, maxHours: 124 } as const

/** Initial estimates per document, to be set by the administrator from actual barangay operations. */
const DEFAULT_HOURS: Partial<Record<DocumentTypeId, number>> = {
  residency: 12,
  indigency: 12,
  'barangay-certificate': 16,
  'first-time-job-seeker': 16,
  'non-residency': 16,
  'no-partner': 16,
  cohabitation: 24,
  'clearance-person': 24,
  'business-clearance': 48,
}
const DEFAULT_CAPACITY = 20

interface Settings { hours: Partial<Record<DocumentTypeId, number>>; dailyCapacity?: number; updatedAt?: string; updatedBy?: string }
const KEY = 'bmis.processingTimes'
const read = (): Settings => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? { hours: {} } } catch { return { hours: {} } } }

/** Only document types released at the Barangay Hall have a preparation time. */
export const hasProcessing = (id: DocumentTypeId) => DEFAULT_STANDARDS[id]?.release === 'pickup'
export const processingHours = (id: DocumentTypeId): number => read().hours[id] ?? DEFAULT_HOURS[id] ?? PROCESSING_LIMITS.minHours
export const isDefaultHours = (id: DocumentTypeId) => read().hours[id] === undefined
/** Requests the office can prepare per working day (all document types together). */
export const dailyCapacity = (): number => read().dailyCapacity ?? DEFAULT_CAPACITY

const canSet = (u: User) => !!(ROLE_PERMISSIONS[u.roleId] as readonly string[] | undefined)?.includes('system.settings')
export function setProcessingHours(id: DocumentTypeId, hours: number, by: User): Promise<number> {
  return mockRequest(() => {
    if (!canSet(by)) throw new ServiceError('forbidden', 'Only the System Administrator can change processing times.')
    if (!hasProcessing(id)) throw new ServiceError('kind', 'This document is not released at the Barangay Hall.')
    if (!Number.isInteger(hours) || hours < PROCESSING_LIMITS.minHours || hours > PROCESSING_LIMITS.maxHours) throw new ServiceError('hours', `Enter whole hours from ${PROCESSING_LIMITS.minHours} to ${PROCESSING_LIMITS.maxHours}.`)
    const s = read()
    const before = processingHours(id)
    s.hours[id] = hours; s.updatedAt = new Date().toISOString(); s.updatedBy = by.id
    localStorage.setItem(KEY, JSON.stringify(s))
    audit(by, 'Changed processing time', 'Settings', `${id}: ${before} → ${hours} office hours`)
    return hours
  })
}
export function setDailyCapacity(n: number, by: User): Promise<number> {
  return mockRequest(() => {
    if (!canSet(by)) throw new ServiceError('forbidden', 'Only the System Administrator can change processing capacity.')
    if (!Number.isInteger(n) || n < 1 || n > 500) throw new ServiceError('capacity', 'Enter a whole number from 1 to 500.')
    const s = read()
    const before = dailyCapacity()
    s.dailyCapacity = n; s.updatedAt = new Date().toISOString(); s.updatedBy = by.id
    localStorage.setItem(KEY, JSON.stringify(s))
    audit(by, 'Changed processing capacity', 'Settings', `${before} → ${n} requests per day`)
    return n
  })
}

// ── Office-hour arithmetic ───────────────────────────────────────────
const TZ = 'Asia/Manila'
const dayOf = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })
const minuteOf = (d: Date) => { const [h, m] = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).split(':').map(Number); return (h % 24) * 60 + m }
const at = (date: string, min: number) => new Date(`${date}T${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00+08:00`)
const nextDay = (date: string) => { const d = new Date(`${date}T12:00:00+08:00`); d.setUTCDate(d.getUTCDate() + 1); return dayOf(d) }

const processors = () => mockUsers.filter((u) => u.status === 'active' && ((ROLE_PERMISSIONS[u.roleId] as readonly string[] | undefined)?.includes('documents.process') || u.extraPermissions?.includes('documents.process')))
/** Open for document work: the hall is open and at least one person who prepares documents is not on leave. */
export function isProcessingDay(date: string): boolean {
  if (!isWorkingDay(date)) return false
  const staff = processors()
  return !staff.length || staff.some((u) => !onLeave(u.id, date))
}
/** Working minutes of a day: office hours minus the lunch break. */
function windows(): [number, number][] {
  const r = schedulingRules()
  const s = toMin(r.officeStart), e = toMin(r.officeEnd), bs = toMin(r.breakStart), be = toMin(r.breakEnd)
  return bs > s && be < e ? [[s, bs], [be, e]] : [[s, e]]
}
export const officeHoursPerDay = () => windows().reduce((n, [a, b]) => n + (b - a), 0) / 60

/** Adds office hours to a moment; counting only runs while the office is open for document work. */
export function addOfficeHours(start: Date, hours: number): Date {
  let remaining = Math.round(hours * 60)
  let date = dayOf(start)
  let cursor = minuteOf(start)
  for (let guard = 0; guard < 400; guard++) {
    if (isProcessingDay(date)) {
      for (const [a, b] of windows()) {
        const from = Math.max(a, cursor)
        if (from >= b) continue
        const take = Math.min(remaining, b - from)
        remaining -= take
        if (remaining === 0) return at(date, from + take)
      }
    }
    date = nextDay(date)
    cursor = 0
  }
  return at(date, windows()[0][0])
}

// ── Estimates ───────────────────────────────────────────────────────
const IN_PROGRESS: DocumentStatus[] = ['submitted', 'under_review', 'for_assessment', 'processing', 'pending_approval', 'approved', 'for_signature']
const CLOSED: DocumentStatus[] = ['released', 'rejected', 'cancelled', 'recorded', 'forwarded', 'served']

export type ReadyState = 'processing' | 'delayed' | 'ready' | 'paused' | 'closed'
export interface ReadyEstimate {
  state: ReadyState
  /** Earliest moment the document is expected to be ready (also the earliest pickup). */
  readyAt?: Date
  /** Configured preparation time and the waiting added for the queue ahead. */
  hours: number
  queueHours: number
  queueAhead: number
  /** Legal maximum (RA 11032 / Citizen's Charter), ISO date, when the service has one. */
  charterBy?: string
  beyondCharter?: boolean
}

function queueBefore(received: Date, exceptId?: string) {
  return mockDocumentRequests.filter((r) => r.id !== exceptId && hasProcessing(r.typeId) && IN_PROGRESS.includes(r.status) && receivedComplete(r) < received).length
}
function build(typeId: DocumentTypeId, received: Date, ahead: number, charterBy?: string): ReadyEstimate {
  const hours = processingHours(typeId)
  const queueHours = Math.floor(ahead / dailyCapacity()) * officeHoursPerDay()
  const readyAt = addOfficeHours(received, hours + queueHours)
  return { state: 'processing', readyAt, hours, queueHours, queueAhead: ahead, charterBy, beyondCharter: !!charterBy && dayOf(readyAt) > charterBy }
}

/** When a request submitted now would be ready (shown before the resident submits). */
export function estimateForNew(typeId: DocumentTypeId, now = new Date()): ReadyEstimate | null {
  if (!hasProcessing(typeId)) return null
  return build(typeId, now, queueBefore(now))
}

/** Current estimate for a request. Recalculated on every read, so status changes, replies and the queue are always reflected. */
export function readyEstimate(req: DocumentRequest, now = new Date()): ReadyEstimate | null {
  if (!hasProcessing(req.typeId)) return null
  const base = { hours: processingHours(req.typeId), queueHours: 0, queueAhead: 0 }
  if (CLOSED.includes(req.status)) return { ...base, state: 'closed' }
  if (req.status === 'ready_for_pickup') {
    const when = [...req.history].reverse().find((h) => h.status === 'ready_for_pickup')?.at
    return { ...base, state: 'ready', readyAt: when ? new Date(when) : now }
  }
  if (req.status === 'needs_info') return { ...base, state: 'paused' }
  const received = receivedComplete(req)
  const e = build(req.typeId, received, queueBefore(received, req.id), estimateFor(req)?.extended?.newDate ?? estimateFor(req)?.expectedBy)
  // A processing-time extension recorded by the Secretary moves the estimate to the end of that day.
  if (req.extension) {
    const ext = at(req.extension.newDate, windows()[windows().length - 1][1])
    if (ext > e.readyAt!) return { ...e, state: 'delayed', readyAt: ext }
  }
  // Past the estimate and still not ready: honestly "delayed", with a new estimate from now.
  if (e.readyAt! < now) return { ...e, state: 'delayed', readyAt: addOfficeHours(now, Math.min(e.hours, officeHoursPerDay())) }
  return e
}

/** Resident-facing words for the estimate. */
export function readyText(e: ReadyEstimate | null, fmt: (d: Date) => string): string | null {
  if (!e) return null
  switch (e.state) {
    case 'ready': return 'Ready for pickup'
    case 'paused': return 'On hold until you send the information the barangay asked for'
    case 'closed': return null
    case 'delayed': return `Taking longer than expected. Now expected by ${fmt(e.readyAt!)}`
    default: return `Expected to be ready by ${fmt(e.readyAt!)}`
  }
}
