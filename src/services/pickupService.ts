import { getDocumentType } from '@/documents/catalog'
import { mockDocumentRequests } from '@/mocks/documentRequests'
import type { User } from '@/types/auth'
import type { DocumentRequest } from '@/types/document'
import { audit } from './auditService'
import { ServiceError, mockRequest } from './mockApi'
import { cancelPickup, claimFor, dayOptions, dateLong, formatTime, lengthOf, releasePickup, savePickup, timeOptions, type Appointment, type DayOption } from './appointmentService'
import { readyEstimate } from './processingService'
import { schedulingRules } from './schedulingService'
import { isWorkingDay } from './serviceStandardService'

/**
 * DOCUMENT PICKUP. A pickup is always linked to its document request (never a
 * separate "general" visit) and can be booked from the moment the request is
 * submitted, but only for times after the estimated ready time and within
 * office hours and pickup capacity. Booking a pickup never marks the document
 * ready: only the Barangay Secretary does that, after preparing it.
 */

const TZ = 'Asia/Manila'
const dayOf = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })
const hhmm = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ })

const ownerOf = (req: DocumentRequest, by: User) => !!by.residentId && by.residentId === req.residentId
const request = (id: string) => mockDocumentRequests.find((r) => r.id === id)

/** Earliest pickup moment, or why none can be booked yet. */
export function pickupEligibility(req: DocumentRequest, now = new Date()): { from: Date } | { blocked: string } {
  const type = getDocumentType(req.typeId)
  const e = readyEstimate(req, now)
  if (!e) return { blocked: `${type.name} is not released at the Barangay Hall.` }
  if (e.state === 'closed') return { blocked: 'This request is closed.' }
  if (e.state === 'paused') return { blocked: 'Pickup can be booked again after you send the information the barangay asked for.' }
  const lead = new Date(now.getTime() + schedulingRules().leadMinutes * 60_000)
  const from = e.state === 'ready' ? lead : new Date(Math.max(e.readyAt!.getTime(), lead.getTime()))
  return { from }
}

const claimInput = (req: DocumentRequest) => {
  const type = getDocumentType(req.typeId)
  return { kind: 'document_claim' as const, subjectId: req.id, subjectRef: req.referenceNo, title: type.name, residentId: req.residentId, reason: `Claim your ${type.name}`, documents: ['Valid government-issued ID', `Your request reference number (${req.referenceNo})`] }
}

/** Days offered for pickup: office days from the earliest pickup date, with free times counted after the ready time. */
export function pickupDays(req: DocumentRequest, count = 10): DayOption[] {
  const el = pickupEligibility(req)
  if ('blocked' in el) return []
  const claim = claimFor(req.id)
  const minutes = lengthOf('document_claim', claimInput(req).documents)
  const first = dayOf(el.from)
  return dayOptions({ kind: 'document_claim', durationMin: minutes, id: claim?.id ?? '' }, count + 30)
    .filter((d) => d.date >= first)
    .map((d) => (d.date === first && d.state === 'open' ? { ...d, free: pickupTimes(req, d.date).length, state: pickupTimes(req, d.date).length ? 'open' : 'full' } : d) as DayOption)
    .slice(0, count)
}
export function pickupTimes(req: DocumentRequest, date: string) {
  const el = pickupEligibility(req)
  if ('blocked' in el) return []
  const claim = claimFor(req.id)
  const minutes = lengthOf('document_claim', claimInput(req).documents)
  const times = timeOptions({ kind: 'document_claim', durationMin: minutes, id: claim?.id ?? '' }, date)
  return date === dayOf(el.from) ? times.filter((t) => t.time >= hhmm(el.from)) : date < dayOf(el.from) ? [] : times
}

/** Resident books (or moves) the pickup for their own request. */
export function schedulePickup(requestId: string, date: string, time: string, by: User): Promise<Appointment> {
  return mockRequest(() => {
    const req = request(requestId)
    if (!req || !ownerOf(req, by)) throw new ServiceError('not_found', 'Request not found.')
    const el = pickupEligibility(req)
    if ('blocked' in el) throw new ServiceError('blocked', el.blocked)
    if (!pickupTimes(req, date).some((t) => t.time === time)) {
      const early = new Date(`${date}T${time}:00+08:00`) < el.from
      const closed = !isWorkingDay(date)
      throw new ServiceError('slot', early ? `That is before your document is expected to be ready. The earliest pickup is ${dateLong(dayOf(el.from))}, ${formatTime(hhmm(el.from))}.`
        : closed ? 'The Barangay Hall is closed on that day. Please choose another day.' : 'Sorry, that time is no longer free. Please choose another.')
    }
    const a = savePickup({ ...claimInput(req), userId: by.id }, date, time, req.status !== 'ready_for_pickup', by)
    req.history.push({ status: req.status, at: new Date().toISOString(), byUserId: by.id, byRole: by.roleId, action: `Pickup booked for ${date} ${formatTime(time)}` })
    audit(by, `Pickup booked ${a.ref}`, 'Documents', req.referenceNo)
    return a
  })
}
export function cancelMyPickup(requestId: string, by: User): Promise<void> {
  return mockRequest(() => {
    const req = request(requestId)
    if (!req || !ownerOf(req, by)) throw new ServiceError('not_found', 'Request not found.')
    cancelPickup(requestId, by)
    req.history.push({ status: req.status, at: new Date().toISOString(), byUserId: by.id, byRole: by.roleId, action: 'Pickup time cancelled by the resident' })
  })
}

/**
 * Keeps booked pickups honest: a pickup before the current ready estimate (a
 * delay, a bigger queue, staff leave) or while the request waits for the
 * resident's reply is released, and the resident is told why. Runs whenever
 * appointments or requests are opened.
 */
export function runPickupChecks(now = new Date()) {
  for (const req of mockDocumentRequests) {
    const claim = claimFor(req.id)
    if (!claim?.date || !claim.beforeReady) continue
    const e = readyEstimate(req, now)
    if (!e) continue
    if (e.state === 'paused') { releasePickup(req.id, 'The barangay needs more information for your request first.', 'system'); continue }
    const start = new Date(`${claim.date}T${claim.time}:00+08:00`)
    if ((e.state === 'processing' || e.state === 'delayed') && e.readyAt! > start) {
      releasePickup(req.id, `Your document is taking longer to prepare. It should be ready by ${dateLong(dayOf(e.readyAt!))}, ${formatTime(hhmm(e.readyAt!))}.`, 'system')
    }
  }
}
