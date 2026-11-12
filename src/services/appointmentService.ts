import { BARANGAY_CONTACT } from '@/config/barangay'
import { once } from '@/lib/idempotency'
import { mockCases } from '@/mocks/cases'
import { DEMO_RESIDENT_ID, mockChangeRequests, mockResidents } from '@/mocks/residents'
import { mockNotifications } from '@/mocks/notifications'
import { mockUsers } from '@/mocks/users'
import type { Permission, User } from '@/types/auth'
import { audit } from './auditService'
import { sendEmail, type EmailRecord } from './emailService'
import { ServiceError, mockRequest } from './mockApi'
import {
  REMINDER_LABEL, addMinutes, assertFree, can, dayState, estimateDuration, formatTime, manilaToday, nextDate,
  openTimes, registerBookings, schedulingRules, serviceRule, staffForService, startsAt as at, type ReminderKey,
} from './schedulingService'
export { formatTime } from './schedulingService'

/**
 * APPOINTMENTS: one record type and one scheduling engine for every visit to
 * the Barangay Hall. Each module keeps its own status; an appointment only
 * says when the visit is and whether it happened.
 *
 * How appointments start:
 * - Document claiming: created automatically when a request becomes
 *   "Ready for pickup" (documentService). The resident picks the time.
 * - Correction verification: the Secretary requires it; she sets the time
 *   or lets the resident pick.
 * - Complaint consultation: authorized case staff create it. Mediation and
 *   hearings stay in the case module (Katarungang Pambarangay rules) and
 *   only appear on the calendars here.
 * - Equipment pickup / return: created by the borrowing workflow.
 *
 * Length, free times, staff hours, leave, holidays, buffers and limits come
 * from the scheduling rules (schedulingService), set by the System
 * Administrator. Prototype storage: this browser. On Supabase every write
 * below is a database function that re-checks the slot (see
 * docs/supabase/scheduling.sql).
 */

export type AppointmentKind = 'correction_verification' | 'document_claim' | 'complaint_consult' | 'equipment_pickup' | 'equipment_return' | 'chairman_consult' | 'general_assist'
export type AppointmentStatus = 'awaiting_schedule' | 'pending_confirmation' | 'confirmed' | 'reschedule_requested' | 'rescheduled' | 'completed' | 'cancelled' | 'no_show'

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  awaiting_schedule: 'Awaiting schedule',
  pending_confirmation: 'Pending confirmation',
  confirmed: 'Confirmed',
  reschedule_requested: 'Reschedule requested',
  rescheduled: 'Rescheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}
/** Statuses that hold staff time. */
const BOOKED: AppointmentStatus[] = ['pending_confirmation', 'confirmed', 'reschedule_requested', 'rescheduled']
const OPEN: AppointmentStatus[] = ['awaiting_schedule', ...BOOKED]
export const isOpen = (a: { status: AppointmentStatus }) => OPEN.includes(a.status)

export interface AppointmentType {
  label: string
  /** Staff who may see and handle it (besides the roles in its service rule). */
  permission?: Permission
  /** Messages and calendars show a neutral title, not the subject. */
  sensitive?: boolean
  /** Length comes from the documents to check, or a fixed service length. */
  lengthFrom: 'documents' | 'service'
  /** Resident may move it without staff review. */
  residentMayMove: boolean
  /** Where the related record lives. */
  staffLink: (subjectId: string) => string
  residentLink: (subjectId: string) => string
}
export const APPOINTMENT_TYPES: Record<AppointmentKind, AppointmentType> = {
  correction_verification: { label: 'In-person verification', permission: 'residents.approve', lengthFrom: 'documents', residentMayMove: true, staffLink: () => '/residents/change-requests', residentLink: () => '/my/profile' },
  document_claim: { label: 'Document claiming', permission: 'documents.release', lengthFrom: 'service', residentMayMove: true, staffLink: (id) => `/documents/${id}`, residentLink: (id) => `/my/documents/${id}` },
  complaint_consult: { label: 'Complaint consultation', permission: 'cases.manage', sensitive: true, lengthFrom: 'service', residentMayMove: false, staffLink: (id) => `/cases/${id}`, residentLink: (id) => `/my/complaints/${id}` },
  equipment_pickup: { label: 'Equipment pickup', permission: 'borrowing.release', lengthFrom: 'service', residentMayMove: true, staffLink: (id) => `/borrowing/${id}`, residentLink: (id) => `/my/borrowing/${id}` },
  equipment_return: { label: 'Equipment return', permission: 'borrowing.release', lengthFrom: 'service', residentMayMove: true, staffLink: (id) => `/borrowing/${id}`, residentLink: (id) => `/my/borrowing/${id}` },
  chairman_consult: { label: 'Consultation with the Punong Barangay', lengthFrom: 'service', residentMayMove: true, sensitive: true, staffLink: () => '/appointments', residentLink: () => '/my/appointments' },
  general_assist: { label: 'General assistance', lengthFrom: 'service', residentMayMove: true, staffLink: () => '/appointments', residentLink: () => '/my/appointments' },
}

export const VISIT_REASONS = ['Check the original ID', 'Check the supporting document', 'Confirm identity', 'Check employment or personal information'] as const
export const DOCUMENT_OPTIONS = ['Original valid government-issued ID', 'Original PSA birth certificate', 'Original marriage certificate', 'Original proof of employment', 'Original proof of address'] as const

export interface AppointmentEvent { at: string; byUserId: string; action: string }
export interface Appointment {
  id: string
  ref: string
  kind: AppointmentKind
  /** Related record (change request, document request, case, borrowing). */
  subjectId: string
  subjectRef?: string
  /** What the visit is for, in plain words (e.g. "Barangay Clearance"). */
  title: string
  residentId?: string
  userId?: string
  reason: string
  documents: string[]
  /** Empty until a time is chosen. ISO date and "HH:MM", Manila time. */
  date: string
  time: string
  durationMin: number
  durationEstimate?: number
  durationOverride?: { original: number; adjusted: number; reason: string; byUserId: string; at: string }
  assignedTo: string
  instructions?: string
  status: AppointmentStatus
  rescheduleReason?: string
  checkedInAt?: string
  /** When the time was chosen; reminders only go out for points after this. */
  bookedAt?: string
  completedAt?: string
  /** Waiting for the assigned official to accept (services that need it). */
  staffConfirmed?: boolean
  /** Verification visits only. */
  verification?: { result: 'verified' | 'not_verified'; idPresented: boolean; nameMatches: boolean; documentChecked: boolean; idExpired: boolean; notes: string; byUserId: string; at: string }
  outcome?: { notes: string; byUserId: string; at: string }
  /** Reminder keys already sent ("24h", "2h"), so none is sent twice. */
  remindersSent: string[]
  emailIds?: string[]
  history: AppointmentEvent[]
  createdAt: string
}

const KEY = 'bmis.appointments'
const SET_KEY = 'bmis.appointmentSettings'

/** Older saved visits (first version) map onto the current statuses. */
function migrate(a: Appointment & { arrivedAt?: string }): Appointment {
  const kind: AppointmentKind = (a.kind as string) === 'correction' ? 'correction_verification' : a.kind
  const s = a.status as string
  const status: AppointmentStatus =
    s === 'scheduled' ? 'pending_confirmation' : s === 'arrived' || s === 'in_verification' ? 'confirmed' : s === 'verified' || s === 'not_verified' ? 'completed' : (s as AppointmentStatus)
  return { ...a, kind, status, title: a.title ?? APPOINTMENT_TYPES[kind].label, checkedInAt: a.checkedInAt ?? a.arrivedAt, remindersSent: a.remindersSent ?? [] }
}
const load = (): Appointment[] => { try { return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as Appointment[]).map(migrate) } catch { return [] } }
const save = (l: Appointment[]) => localStorage.setItem(KEY, JSON.stringify(l))

const manilaParts = (iso: string) => {
  const d = new Date(iso)
  return { date: d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }), time: d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) }
}

registerBookings(() => load().filter((a) => BOOKED.includes(a.status) && a.date && a.assignedTo).map((a) => ({ id: a.id, staffId: a.assignedTo, date: a.date, time: a.time, minutes: a.durationMin, label: a.ref, buffer: serviceRule(a.kind)?.buffer, service: a.kind })))
/** Who attends a hearing: the Punong Barangay for mediation, plus any personnel assigned to the case. One record, many calendars. */
export function hearingParticipants(c: (typeof mockCases)[number], h: (typeof mockCases)[number]['hearings'][number]): string[] {
  const chairmen = h.kind === 'chairman_mediation' ? mockUsers.filter((u) => u.roleId === 'chairman' && u.status === 'active').map((u) => u.id) : []
  return [...new Set([...chairmen, ...(c.assignedTo ?? [])])]
}
const hearingRule = (h: { kind: string }) => serviceRule(h.kind === 'chairman_mediation' ? 'mediation' : 'conciliation')
// Hearings live in the case module; they take the participants' time here too.
registerBookings(() => mockCases.flatMap((c) => c.hearings.filter((h) => h.status === 'scheduled').flatMap((h) =>
  hearingParticipants(c, h).map((staffId) => ({ id: h.id, staffId, ...manilaParts(h.scheduledAt), minutes: hearingRule(h)?.minutes ?? 60, buffer: hearingRule(h)?.buffer, service: h.kind === 'chairman_mediation' ? 'mediation' : 'conciliation', label: c.caseNo })))))

/** Staff who may see or handle this kind of appointment: the service's roles (configurable) or the permission. */
const mayHandle = (u: User, kind: AppointmentKind) => !!serviceRule(kind)?.roles.includes(u.roleId) || (!!APPOINTMENT_TYPES[kind].permission && can(u, APPOINTMENT_TYPES[kind].permission!))
const requireHandler = (u: User, a: { kind: AppointmentKind }) => { if (!mayHandle(u, a.kind)) throw new ServiceError('forbidden', 'You cannot manage this appointment.') }
const isOwner = (a: Appointment, by: User) => (!!a.userId && a.userId === by.id) || (!!by.residentId && by.residentId === a.residentId)
export const staffFor = (kind: AppointmentKind) => staffForService(kind, APPOINTMENT_TYPES[kind].permission).map((u) => u.id)

export function lengthOf(kind: AppointmentKind, documents: string[]) {
  return APPOINTMENT_TYPES[kind].lengthFrom === 'documents' ? estimateDuration(documents).minutes : (serviceRule(kind)?.minutes ?? 15)
}
export const endTime = (a: { time: string; durationMin: number }) => addMinutes(a.time, a.durationMin)
const startsAt = (a: { date: string; time: string }) => at(a.date, a.time)
export const dateLong = (d: string) => new Date(`${d}T12:00:00+08:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })

// ── Notifications ────────────────────────────────────────────────────
function notify(userIds: (string | undefined)[], title: string, body: string, link: string) {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds.filter(Boolean) as string[])) mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category: 'hearing', title, body, createdAt: now, read: false, link })
  window.dispatchEvent(new Event('bmis:notifications-changed'))
}

type MessageKind = 'ready' | 'scheduled' | 'confirmed' | 'moved' | 'cancelled' | 'duration' | 'reminder' | 'no_show' | 'requested'
/** Plain-language message with everything the resident needs (in-app notice and email). */
export function visitMessage(a: Appointment, kind: MessageKind, extra?: string) {
  const r = mockResidents.find((x) => x.id === a.residentId)
  const name = r ? `${r.firstName} ${r.lastName}` : mockUsers.find((u) => u.id === a.userId)?.fullName ?? 'Resident'
  const type = APPOINTMENT_TYPES[a.kind].label
  const when = a.date ? `${dateLong(a.date)}, ${formatTime(a.time)} to about ${formatTime(endTime(a))} (about ${a.durationMin} minutes)` : ''
  const head: Record<MessageKind, string> = {
    ready: 'Your appointment is ready to schedule. Please choose a date and time under My Appointments.',
    requested: 'We received your request. You will be notified when the time is confirmed.',
    scheduled: 'Please visit the Barangay Hall at the time below. Open My Appointments to confirm.',
    confirmed: 'Your appointment is confirmed. Please arrive 10 minutes early and bring the items below.',
    moved: `Your appointment was moved.${extra ? ` ${extra}` : ''} Here is the new schedule.`,
    cancelled: `Your appointment${a.date ? ` on ${dateLong(a.date)} at ${formatTime(a.time)}` : ''} was cancelled.${extra ? ` Reason: ${extra}` : ''}`,
    duration: `The expected length of your appointment changed.${extra ? ` ${extra}` : ''}`,
    reminder: APPOINTMENT_TYPES[a.kind].sensitive ? `You have an upcoming Barangay appointment ${extra ?? 'soon'}.` : `Reminder: your appointment is ${extra ?? 'soon'}. Please check what to bring before you go.`,
    no_show: 'We did not see you at your appointment. Your request is still open; you can choose a new time under My Appointments.',
  }
  const subject: Record<MessageKind, string> = {
    ready: `${type}: please choose a schedule (${a.ref})`,
    requested: `Appointment request received (${a.ref})`,
    scheduled: `${type} on ${a.date ? dateLong(a.date) : ''} (${a.ref})`,
    confirmed: `Appointment confirmed: ${type}${a.date ? ` on ${dateLong(a.date)}` : ''}`,
    moved: `New schedule for your ${type.toLowerCase()} (${a.ref})`,
    cancelled: `Your ${type.toLowerCase()} was cancelled (${a.ref})`,
    duration: `Updated appointment details (${a.ref})`,
    reminder: `Reminder: ${type.toLowerCase()} ${extra ?? ''} (${a.ref})`,
    no_show: `Missed appointment (${a.ref})`,
  }
  const contact = `Questions: ${BARANGAY_CONTACT.phone} · ${BARANGAY_CONTACT.email}`
  const body = [
    `Dear ${name},`, '', head[kind], '',
    `Service: ${type}${a.title && a.title !== type ? ` (${a.title})` : ''}`,
    ...(kind !== 'cancelled' && kind !== 'no_show' && a.date ? [`When: ${when}`] : []),
    `Where: ${BARANGAY_CONTACT.hall}, ${BARANGAY_CONTACT.address}`,
    ...(kind !== 'cancelled' ? [`Why: ${a.reason}`, 'Please bring:', ...a.documents.map((d) => `  • ${d}`)] : []),
    ...(a.instructions ? ['', `Note: ${a.instructions}`] : []),
    '', kind === 'cancelled' ? 'Your request is still open. The barangay will tell you the next step.' : 'Cannot come? Open My Appointments to choose another time, or call us.',
    contact, `Reference: ${a.ref}${a.subjectRef ? ` · Request ${a.subjectRef}` : ''}`,
  ].join('\n')
  const short = a.date && !['cancelled', 'no_show', 'ready'].includes(kind) ? `${type} · ${formatTime(a.time)}, ${dateLong(a.date)} · bring ${a.documents.join(', ')}` : head[kind]
  return { subject: subject[kind], body, short }
}

/** In-app notice plus an email record (not delivered until an email service is connected). */
async function tellResident(a: Appointment, title: string, kind: MessageKind, extra?: string): Promise<EmailRecord | null> {
  const m = visitMessage(a, kind, extra)
  notify([a.userId], title, m.short, `/my/appointments/${a.id}`)
  const to = mockUsers.find((u) => u.id === a.userId)?.email
  if (!to) return null
  const rec = await sendEmail({ to, subject: m.subject, body: m.body, ref: a.ref })
  const list = load()
  const x = list.find((y) => y.id === a.id)
  if (x) { x.emailIds = [...(x.emailIds ?? []), rec.id]; save(list) }
  return rec
}
const later = (a: Appointment, title: string, kind: MessageKind, extra?: string) => { const copy = { ...a }; queueMicrotask(() => void tellResident(copy, title, kind, extra)) }

// ── Creation ─────────────────────────────────────────────────────────
export interface NewAppointment {
  kind: AppointmentKind
  subjectId: string
  subjectRef?: string
  title: string
  residentId?: string
  userId?: string
  reason: string
  documents: string[]
  instructions?: string
}
const makeRef = (list: Appointment[]) => `APT-${new Date().getFullYear()}-${String(list.length + 1).padStart(4, '0')}`

/**
 * Called by other modules when a visit is needed. Never creates a second
 * open appointment for the same record and service. The resident picks the time.
 */
export function createAwaitingSchedule(n: NewAppointment, byUserId: string): Appointment | null {
  const list = load()
  const existing = list.find((a) => a.kind === n.kind && a.subjectId === n.subjectId && isOpen(a))
  if (existing) return existing
  if (!n.userId) return null // No portal account (walk-in): staff handle it at the counter.
  const now = new Date().toISOString()
  const minutes = lengthOf(n.kind, n.documents)
  const a: Appointment = {
    id: `apt-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, ref: makeRef(list), ...n, date: '', time: '', durationMin: minutes, durationEstimate: minutes,
    assignedTo: '', status: 'awaiting_schedule', remindersSent: [], createdAt: now, history: [{ at: now, byUserId, action: 'Appointment needed; waiting for the resident to choose a time' }],
  }
  save([...list, a])
  later(a, `${APPOINTMENT_TYPES[a.kind].label}: choose a schedule`, 'ready')
  return a
}

/** Ends an open appointment when its record is finished elsewhere (e.g. the document was released). */
export function completeFor(kind: AppointmentKind, subjectId: string, note: string, byUserId: string) {
  const list = load()
  const a = list.find((x) => x.kind === kind && x.subjectId === subjectId && isOpen(x))
  if (!a) return
  const now = new Date().toISOString()
  a.status = 'completed'
  a.completedAt = now
  a.outcome = { notes: note, byUserId, at: now }
  a.history.push({ at: now, byUserId, action: `Completed: ${note}` })
  save(list)
}
/** Cancels an open appointment when its record is cancelled or rejected elsewhere (the resident is told). */
export function cancelFor(kind: AppointmentKind, subjectId: string, reason: string, byUserId: string) {
  const list = load()
  const a = list.find((x) => x.kind === kind && x.subjectId === subjectId && isOpen(x))
  if (!a) return
  a.status = 'cancelled'
  a.history.push({ at: new Date().toISOString(), byUserId, action: `Cancelled: ${reason}` })
  save(list)
  later(a, 'Your appointment was cancelled', 'cancelled', reason)
}

// ── Verification visits (correction requests) ────────────────────────
export interface ScheduleInput {
  reason: string
  documents: string[]
  /** Leave date/time empty to let the resident choose. */
  date: string
  time: string
  assignedTo: string
  instructions?: string
  /** Only when the calculated length is genuinely wrong for this case. */
  override?: { minutes: number; reason: string }
}

function lengthFor(kind: AppointmentKind, documents: string[], override?: { minutes: number; reason: string }) {
  const estimate = lengthOf(kind, documents)
  if (!override) return { minutes: estimate, estimate }
  if (!(override.minutes >= 5 && override.minutes <= 120)) throw new ServiceError('duration', 'The adjusted length must be between 5 and 120 minutes.')
  if (override.reason.trim().length < 5) throw new ServiceError('override_reason', 'Give the reason for changing the calculated length.')
  return { minutes: override.minutes, estimate }
}

function checkStaff(kind: AppointmentKind, staffId: string) {
  const staff = mockUsers.find((u) => u.id === staffId && u.status === 'active' && staffFor(kind).includes(u.id))
  if (!staff) throw new ServiceError('staff', 'Choose a member of the Barangay Personnel who handles this service.')
}

/** Secretary requires an in-person visit for a correction request. */
export function scheduleForCorrection(changeRequestId: string, i: ScheduleInput, by: User): Promise<Appointment> {
  return mockRequest(() => {
    if (!can(by, 'residents.approve')) throw new ServiceError('forbidden', 'You cannot manage verification visits.')
    const cr = mockChangeRequests.find((c) => c.id === changeRequestId)
    if (!cr) throw new ServiceError('not_found', 'Request not found.')
    if (cr.status !== 'pending') throw new ServiceError('decided', 'This request was already decided.')
    if (!i.reason.trim()) throw new ServiceError('reason', 'Choose the reason for the visit.')
    if (!i.documents.length) throw new ServiceError('documents', 'Choose what the resident must bring.')
    const list = load()
    if (list.some((a) => a.subjectId === cr.id && isOpen(a))) throw new ServiceError('exists', 'A visit is already set for this request. Reschedule it instead.')
    const kind: AppointmentKind = 'correction_verification'
    const len = lengthFor(kind, i.documents, i.override)
    const pick = !!i.date
    if (pick) { checkStaff(kind, i.assignedTo); assertFree(i.date, i.time, i.assignedTo, len.minutes, undefined, kind) }
    const residentId = cr.requestedByResidentId ?? cr.residentId
    const userId = mockUsers.find((u) => u.residentId === residentId && u.status === 'active')?.id
    if (!pick && !userId) throw new ServiceError('no_account', 'This resident has no portal account, so they cannot choose a time. Set the time now.')
    const now = new Date().toISOString()
    const a: Appointment = {
      id: `apt-${Date.now().toString(36)}`, ref: makeRef(list), kind, subjectId: cr.id, subjectRef: cr.id, title: `Record correction: ${cr.field}`,
      residentId, userId, reason: i.reason.trim(), documents: i.documents, date: pick ? i.date : '', time: pick ? i.time : '',
      durationMin: len.minutes, durationEstimate: len.estimate, assignedTo: pick ? i.assignedTo : '',
      durationOverride: i.override ? { original: len.estimate, adjusted: len.minutes, reason: i.override.reason.trim(), byUserId: by.id, at: now } : undefined,
      instructions: i.instructions?.trim() || undefined, status: pick ? 'pending_confirmation' : 'awaiting_schedule', remindersSent: [], createdAt: now,
      history: [{ at: now, byUserId: by.id, action: pick
        ? `Scheduled for ${i.date} ${formatTime(i.time)}–${formatTime(addMinutes(i.time, len.minutes))} (${len.minutes} min${i.override ? `, changed from ${len.estimate} min: ${i.override.reason.trim()}` : ', calculated'})`
        : `Visit required (${len.minutes} min${i.override ? `, changed from ${len.estimate} min` : ', calculated'}); resident to choose the time` }],
    }
    save([...list, a])
    audit(by, `Verification visit ${pick ? 'scheduled' : 'required'} ${a.ref}`, 'Residents', `${cr.id}${pick ? ` · ${a.date} ${a.time}` : ''} · ${a.durationMin} min`)
    if (a.durationOverride) audit(by, `Visit length changed ${a.ref}`, 'Residents', `${a.durationOverride.original} → ${a.durationOverride.adjusted} min: ${a.durationOverride.reason}`)
    later(a, pick ? 'Please visit the Barangay Hall' : 'Please choose a time to visit the Barangay Hall', pick ? 'scheduled' : 'ready')
    if (pick && a.assignedTo !== by.id) notify([a.assignedTo], 'Appointment assigned to you', `${a.ref} · ${a.date} ${formatTime(a.time)}`, `/appointments/${a.id}`)
    return a
  })
}

/**
 * Consultation with the Punong Barangay about a complaint (never a hearing).
 * The Chairman holds it; the Secretary may set it up for the Chairman. Only a
 * case already forwarded to the Chairman can have one.
 */
export function scheduleConsultation(caseId: string, i: { reason: string; documents: string[]; date: string; time: string; assignedTo: string; instructions?: string }, by: User): Promise<Appointment> {
  return mockRequest(() => {
    if (!can(by, 'cases.manage') && !can(by, 'cases.decide')) throw new ServiceError('forbidden', 'You cannot schedule complaint consultations.')
    const c = mockCases.find((x) => x.id === caseId)
    if (!c) throw new ServiceError('not_found', 'Case not found.')
    const party = c.complainants.find((p) => p.residentId)
    const userId = party ? mockUsers.find((u) => u.residentId === party.residentId && u.status === 'active')?.id : undefined
    if (!party || !userId) throw new ServiceError('no_account', 'The complainant has no portal account. Contact them by phone.')
    if (['filed', 'under_review'].includes(c.stage)) throw new ServiceError('stage', 'Forward the case to the Punong Barangay first.')
    if (i.reason.trim().length < 5) throw new ServiceError('reason', 'Say why the complainant should come in.')
    const list = load()
    if (list.some((a) => a.kind === 'complaint_consult' && a.subjectId === caseId && isOpen(a))) throw new ServiceError('exists', 'A consultation is already open for this case.')
    const kind: AppointmentKind = 'complaint_consult'
    const minutes = lengthOf(kind, i.documents)
    checkStaff(kind, i.assignedTo)
    assertFree(i.date, i.time, i.assignedTo, minutes, undefined, kind)
    const now = new Date().toISOString()
    const a: Appointment = {
      id: `apt-${Date.now().toString(36)}`, ref: makeRef(list), kind, subjectId: c.id, subjectRef: c.caseNo, title: 'Complaint consultation',
      residentId: party.residentId, userId, reason: i.reason.trim(), documents: i.documents, date: i.date, time: i.time, durationMin: minutes, durationEstimate: minutes,
      assignedTo: i.assignedTo, instructions: i.instructions?.trim() || undefined, status: 'pending_confirmation', remindersSent: [], createdAt: now,
      history: [{ at: now, byUserId: by.id, action: `Consultation set for ${i.date} ${formatTime(i.time)} (${minutes} min)` }],
    }
    save([...list, a])
    audit(by, `Complaint consultation scheduled ${a.ref}`, 'Cases', c.caseNo)
    later(a, 'Please come to the Barangay Hall', 'scheduled')
    if (a.assignedTo !== by.id) notify([a.assignedTo], 'Consultation added to your calendar', `${c.caseNo} · ${a.date} ${formatTime(a.time)}`, `/appointments/${a.id}`)
    return a
  })
}

// ── Choosing and changing a time ─────────────────────────────────────
export interface DayOption { date: string; state: 'open' | 'full' | 'closed'; free: number }
/** Next working days with whether they still have room (simple date list, no dense calendar). */
export function dayOptions(a: Pick<Appointment, 'kind' | 'durationMin' | 'id'>, days = 10): DayOption[] {
  const staff = staffFor(a.kind)
  const out: DayOption[] = []
  let d = manilaToday()
  for (let i = 0; out.length < days && i < 40; i++, d = nextDate(d)) {
    const weekend = new Date(`${d}T12:00:00+08:00`).getUTCDay() % 6 === 0
    const s = dayState(d, a.durationMin, staff, a.id, a.kind)
    if (weekend && s.state === 'closed') continue
    out.push({ date: d, ...s })
  }
  return out
}
export const timeOptions = (a: Pick<Appointment, 'kind' | 'durationMin' | 'id'>, date: string) => openTimes(date, a.durationMin, staffFor(a.kind), a.id, a.kind)

function mutate(id: string, by: User, fn: (a: Appointment) => string): Promise<Appointment> {
  return mockRequest(() => {
    const list = load()
    const a = list.find((x) => x.id === id)
    if (!a || (!isOwner(a, by) && !mayHandle(by, a.kind))) throw new ServiceError('not_found', 'Appointment not found.')
    const action = fn(a)
    a.history.push({ at: new Date().toISOString(), byUserId: by.id, action })
    save(list)
    audit(by, `${action} (${a.ref})`, 'Appointments', a.subjectRef ?? a.subjectId)
    return a
  })
}

/** Resident (or staff helping them) picks a time. Staff are assigned automatically. */
export const bookAppointment = (id: string, date: string, time: string, by: User) => mutate(id, by, (a) => {
  const staffAssist = mayHandle(by, a.kind) && !isOwner(a, by)
  const moving = ['pending_confirmation', 'confirmed', 'rescheduled'].includes(a.status)
  if (!(a.status === 'awaiting_schedule' || a.status === 'no_show' || moving || (a.status === 'reschedule_requested' && staffAssist))) throw new ServiceError('state', 'This appointment cannot be scheduled now.')
  if (moving && !staffAssist && !APPOINTMENT_TYPES[a.kind].residentMayMove) throw new ServiceError('review', 'Changes to this appointment are reviewed by the barangay. Use "Request Another Schedule".')
  if (a.checkedInAt) throw new ServiceError('state', 'You were already checked in for this appointment.')
  const rule = serviceRule(a.kind)
  if (moving && !staffAssist && rule && startsAt(a) - Date.now() < rule.cancelHours * 3600_000) throw new ServiceError('late', `Changes are possible up to ${rule.cancelHours} hours before. Please call the Barangay Hall.`)
  // Re-checked at the moment of saving, so two people cannot take the same last slot.
  const slot = timeOptions(a, date).find((s) => s.time === time)
  if (!slot) throw new ServiceError('slot', 'Sorry, that time was just taken. Please choose another.')
  const from = a.date ? `${a.date} ${formatTime(a.time)}` : null
  const waits = !!rule?.staffConfirms && !staffAssist
  a.date = date; a.time = time; a.assignedTo = slot.staffId; a.status = waits ? 'pending_confirmation' : 'confirmed'; a.remindersSent = []; a.rescheduleReason = undefined
  a.bookedAt = new Date().toISOString(); a.staffConfirmed = !waits
  later(a, waits ? 'Your request was sent' : from ? 'Your appointment was moved' : 'Your appointment is confirmed', waits ? 'requested' : from ? 'moved' : 'confirmed', from ? `It was on ${from}.` : undefined)
  notify([a.assignedTo], from ? 'Appointment moved' : 'New appointment', `${a.ref} · ${APPOINTMENT_TYPES[a.kind].label} · ${a.date} ${formatTime(a.time)}`, `/appointments/${a.id}`)
  const who = staffAssist ? ' (by Barangay Personnel for the resident)' : ' by the resident'
  return from ? `Moved from ${from} to ${date} ${formatTime(time)}${who}` : `Booked for ${date} ${formatTime(time)}${who}`
})

export const confirmAppointment = (id: string, by: User) => mutate(id, by, (a) => {
  if (!isOwner(a, by)) throw new ServiceError('forbidden', 'This is not your appointment.')
  if (!['pending_confirmation', 'rescheduled'].includes(a.status)) throw new ServiceError('state', 'This appointment cannot be confirmed now.')
  a.status = 'confirmed'
  later(a, 'Your appointment is confirmed', 'confirmed')
  notify([a.assignedTo], 'Resident confirmed the appointment', `${a.ref} · ${a.date} ${formatTime(a.time)}`, `/appointments/${a.id}`)
  return 'Confirmed by resident'
})

export const requestReschedule = (id: string, reason: string, by: User) => mutate(id, by, (a) => {
  if (!isOwner(a, by)) throw new ServiceError('forbidden', 'This is not your appointment.')
  if (!['pending_confirmation', 'confirmed', 'rescheduled'].includes(a.status)) throw new ServiceError('state', 'This appointment cannot be changed now.')
  if (reason.trim().length < 3) throw new ServiceError('reason', 'Tell us why, or a better day and time.')
  a.status = 'reschedule_requested'
  a.rescheduleReason = reason.trim()
  notify([a.assignedTo, ...staffFor(a.kind)], 'Resident asked for another schedule', `${a.ref} · ${reason.trim()}`, `/appointments/${a.id}`)
  return `Resident asked for another schedule: ${reason.trim()}`
})

/** Staff move an appointment (the resident confirms again). */
export const rescheduleAppointment = (id: string, date: string, time: string, assignedTo: string, by: User) => mutate(id, by, (a) => {
  requireHandler(by, a)
  if (!['awaiting_schedule', 'pending_confirmation', 'confirmed', 'reschedule_requested', 'rescheduled', 'no_show'].includes(a.status)) throw new ServiceError('state', 'This appointment cannot be rescheduled.')
  checkStaff(a.kind, assignedTo)
  assertFree(date, time, assignedTo, a.durationMin, a.id, a.kind)
  const from = a.date ? `${a.date} ${formatTime(a.time)}` : 'no time yet'
  a.date = date; a.time = time; a.assignedTo = assignedTo; a.status = 'rescheduled'; a.remindersSent = []; a.rescheduleReason = undefined
  later(a, 'Your appointment was moved', 'moved', `It was on ${from}.`)
  return `Rescheduled from ${from} to ${date} ${formatTime(time)}`
})

/** Authorized staff change the calculated length; needs a reason, re-checks the time, and is audited. */
export const overrideDuration = (id: string, minutes: number, reason: string, by: User) => mutate(id, by, (a) => {
  requireHandler(by, a)
  if (!OPEN.includes(a.status)) throw new ServiceError('state', 'This appointment can no longer be changed.')
  const len = lengthFor(a.kind, a.documents, { minutes, reason })
  if (len.minutes === a.durationMin) throw new ServiceError('same', 'That is already the appointment length.')
  if (a.date && BOOKED.includes(a.status)) assertFree(a.date, a.time, a.assignedTo, len.minutes, a.id, a.kind)
  const before = a.durationMin
  const original = a.durationEstimate ?? len.estimate
  a.durationMin = len.minutes
  a.durationEstimate = original
  a.durationOverride = { original, adjusted: len.minutes, reason: reason.trim(), byUserId: by.id, at: new Date().toISOString() }
  if (a.date) later(a, 'Your appointment details changed', 'duration', `It now takes about ${len.minutes} minutes.`)
  return `Length changed from ${before} to ${len.minutes} min (calculated ${original} min): ${reason.trim()}`
})

export const checkIn = (id: string, by: User) => mutate(id, by, (a) => {
  requireHandler(by, a)
  if (!['pending_confirmation', 'confirmed', 'rescheduled'].includes(a.status) || a.checkedInAt) throw new ServiceError('state', 'Cannot check in now.')
  a.checkedInAt = new Date().toISOString()
  a.status = 'confirmed'
  return Date.now() - startsAt(a) > 15 * 60_000 ? 'Checked in (late)' : 'Checked in'
})

export interface VerificationInput { idPresented: boolean; nameMatches: boolean; documentChecked: boolean; idExpired: boolean; notes: string }

/** Verification visits: records what was checked. Verified needs a valid, matching ID and the document; it does not approve the correction. */
export const recordVerification = (id: string, result: 'verified' | 'not_verified', v: VerificationInput, by: User) => mutate(id, by, (a) => {
  requireHandler(by, a)
  if (a.kind !== 'correction_verification') throw new ServiceError('kind', 'This is not a verification visit.')
  if (!a.checkedInAt || a.status === 'completed') throw new ServiceError('state', 'Check the resident in first.')
  if (result === 'verified' && (!v.idPresented || !v.nameMatches || !v.documentChecked || v.idExpired)) throw new ServiceError('checks', 'To mark as verified, the original ID must be valid and match, and the document must be checked.')
  if (result === 'not_verified' && v.notes.trim().length < 5) throw new ServiceError('notes', 'Explain what did not match and what the resident should do.')
  const now = new Date().toISOString()
  a.status = 'completed'
  a.completedAt = now
  a.verification = { result, ...v, notes: v.notes.trim(), byUserId: by.id, at: now }
  a.outcome = { notes: result === 'verified' ? 'Documents verified' : `Not verified: ${v.notes.trim()}`, byUserId: by.id, at: now }
  notify([a.userId], result === 'verified' ? 'Documents checked' : 'Your documents could not be verified', result === 'verified' ? 'The Barangay Secretary will now decide on your request.' : v.notes.trim(), `/my/appointments/${a.id}`)
  notify(staffFor('correction_verification').filter((x) => x !== by.id), 'Verification visit finished', `${a.ref}: ${result === 'verified' ? 'verified' : 'not verified'}. The correction is ready for a decision.`, '/residents/change-requests')
  return result === 'verified' ? 'Completed: verified' : `Completed: not verified (${v.notes.trim()})`
})

/** Consultations: staff record what happened. Document release and equipment hand-over finish in their own modules. */
export const completeAppointment = (id: string, notes: string, by: User) => mutate(id, by, (a) => {
  requireHandler(by, a)
  if (a.kind === 'correction_verification') throw new ServiceError('kind', 'Record the verification result instead.')
  // Outcomes of consultations are recorded by the official who holds them (the Punong Barangay), not by support staff.
  if (a.kind !== 'general_assist' && !serviceRule(a.kind)?.roles.includes(by.roleId)) throw new ServiceError('forbidden', 'Only the Punong Barangay records the outcome of this consultation.')
  if (!['complaint_consult', 'chairman_consult', 'general_assist'].includes(a.kind)) throw new ServiceError('kind', 'Finish this in the request itself (release or hand-over); the appointment then closes automatically.')
  if (!a.checkedInAt) throw new ServiceError('state', 'Check the resident in first.')
  if (notes.trim().length < 5) throw new ServiceError('notes', 'Write what happened and the next step.')
  a.status = 'completed'
  a.completedAt = new Date().toISOString()
  a.outcome = { notes: notes.trim(), byUserId: by.id, at: a.completedAt }
  notify([a.userId], 'Appointment completed', notes.trim(), `/my/appointments/${a.id}`)
  return `Completed: ${notes.trim()}`
})

export const markNoShow = (id: string, by: User) => mutate(id, by, (a) => {
  requireHandler(by, a)
  if (!['pending_confirmation', 'confirmed', 'rescheduled'].includes(a.status) || a.checkedInAt) throw new ServiceError('state', 'Cannot mark as no-show now.')
  if (Date.now() < startsAt(a)) throw new ServiceError('early', 'The appointment time has not passed yet.')
  a.status = 'no_show'
  later(a, 'You missed your appointment', 'no_show')
  return 'No-show'
})

export const cancelAppointment = (id: string, reason: string, by: User) => mutate(id, by, (a) => {
  requireHandler(by, a)
  if (!OPEN.includes(a.status) && a.status !== 'no_show') throw new ServiceError('state', 'This appointment is already closed.')
  if (reason.trim().length < 3) throw new ServiceError('reason', 'Give the reason.')
  a.status = 'cancelled'
  later(a, 'Your appointment was cancelled', 'cancelled', reason.trim())
  return `Cancelled: ${reason.trim()}`
})

// ── Automatic jobs (reminders, no-shows, closures) ───────────────────
/** Moment a reminder point falls: N days/hours before, or 7:00 AM on the day. */
export function reminderAt(k: ReminderKey, a: { date: string; time: string }): number {
  const t = startsAt(a)
  if (k === 'day') return at(a.date, '07:00')
  return t - ({ '7d': 7 * 24, '3d': 3 * 24, '1d': 24, '1h': 1 } as const)[k] * 3600_000
}
/**
 * Runs on page loads in this prototype; a scheduled server job on Supabase.
 * Each reminder is sent once (keys in remindersSent). A visit nobody checked
 * in becomes a no-show after the grace time; the underlying request stays open.
 */
export function runAppointmentJobs(now = Date.now()) {
  ensureSampleVisit()
  const r = schedulingRules()
  const on = appointmentSettings().remindersOn
  const list = load()
  let changed = false
  for (const a of list.filter((x) => ['pending_confirmation', 'confirmed', 'rescheduled'].includes(x.status) && x.date)) {
    const t = startsAt(a)
    if (on && t > now) {
      // Reminder points for this service. Only points after the booking count (a short-notice booking
      // gets no out-of-date reminders), and a late run sends only the nearest one.
      const booked = new Date(a.bookedAt ?? a.createdAt).getTime()
      const keys = serviceRule(a.kind)?.reminders ?? ['1d', '1h']
      const due = keys.map((k) => ({ k, at: reminderAt(k, a) })).filter((x) => x.at > booked && x.at <= now && !a.remindersSent.includes(x.k)).sort((x, y) => y.at - x.at)
      if (due.length) {
        a.remindersSent.push(...due.map((x) => x.k))
        const k = due[0].k
        later(a, k === 'day' ? 'Your appointment is today' : `Reminder: appointment ${REMINDER_LABEL[k].replace(' before', ' away')}`, 'reminder', k === 'day' ? 'today' : k === '1h' ? 'in about 1 hour' : `in ${REMINDER_LABEL[k].replace(' before', '')}`)
        // The assigned staff member gets the day-of and 1-hour reminders for their own schedule.
        if (k === 'day' || k === '1h') notify([a.assignedTo], k === 'day' ? 'On your schedule today' : 'Appointment in 1 hour', `${formatTime(a.time)} · ${APPOINTMENT_TYPES[a.kind].label}`, `/appointments/${a.id}`)
        changed = true
      }
    }
    if (!a.checkedInAt && now > t + (a.durationMin + r.noShowGraceMinutes) * 60_000) {
      a.status = 'no_show'
      a.history.push({ at: new Date(now).toISOString(), byUserId: 'system', action: `No-show (not checked in within ${r.noShowGraceMinutes} min after the end)` })
      later(a, 'You missed your appointment', 'no_show')
      notify([a.assignedTo], 'Missed appointment', `${a.ref} · ${APPOINTMENT_TYPES[a.kind].label}. Set a new time or wait for the resident.`, `/appointments/${a.id}`)
      changed = true
    }
  }
  if (changed) save(list)
}

/** Booked appointments on dates that are no longer working days (a new closure or holiday). */
export function appointmentsOnClosedDays(isClosed: (date: string) => boolean): Appointment[] {
  return load().filter((a) => BOOKED.includes(a.status) && a.date && isClosed(a.date))
}
/** Closure: each affected appointment needs a new time; residents are told. */
/**
 * A closure or holiday affects booked appointments: each one is kept (never
 * deleted), put back to "Awaiting schedule" with its history, and the resident
 * and the assigned Barangay Personnel are told. The resident picks a new time.
 */
export function flagForClosure(affects: (a: { date: string; time: string; durationMin: number; kind: string }) => boolean, reason: string, byUserId: string): number {
  const list = load()
  let n = 0
  for (const a of list.filter((x) => BOOKED.includes(x.status) && x.date && affects(x))) {
    const was = a.date
    const staff = a.assignedTo
    a.status = 'awaiting_schedule'
    a.history.push({ at: new Date().toISOString(), byUserId, action: `Office closed on ${was} (${reason}); needs a new time` })
    a.date = ''; a.time = ''; a.assignedTo = ''; a.remindersSent = []; a.staffConfirmed = undefined
    later(a, 'Please choose a new time', 'moved', `The Barangay Hall is closed on ${dateLong(was)} (${reason}).`)
    if (staff) notify([staff], 'Appointment moved off a closed day', `${a.ref} · ${was}: the resident will choose a new time.`, `/appointments/${a.id}`)
    n++
  }
  if (n) save(list)
  return n
}

/** Booked future appointments that would fall outside these office hours or inside the break (for the settings warning). */
export function bookedOutsideHours(r: { officeStart: string; officeEnd: string; breakStart: string; breakEnd: string }): number {
  const m = (t: string) => { const [h, x] = t.split(':').map(Number); return h * 60 + x }
  return load().filter((a) => BOOKED.includes(a.status) && a.date && startsAt(a) > Date.now()).filter((a) => {
    const s = m(a.time), e = s + a.durationMin
    return s < m(r.officeStart) || e > m(r.officeEnd) || (s < m(r.breakEnd) && e > m(r.breakStart))
  }).length
}

// ── Resident-booked services, staff confirmation, reassignment ───────
/** Services a resident can book directly (from the service rules). */
export const bookableServices = (): AppointmentKind[] => (Object.keys(APPOINTMENT_TYPES) as AppointmentKind[]).filter((k) => serviceRule(k)?.residentBookable)

/** Resident asks for a visit; they then pick a time from the free ones. */
export function requestVisit(kind: AppointmentKind, reason: string, by: User, clientRequestId?: string): Promise<Appointment> {
  return mockRequest(() => once(clientRequestId && `${by.id}:${clientRequestId}`, (id) => load().find((x) => x.id === id), (x) => x.id, () => {
    if (!by.residentId) throw new ServiceError('forbidden', 'Only residents can book a visit here.')
    if (!bookableServices().includes(kind)) throw new ServiceError('kind', 'This service cannot be booked online.')
    if (reason.trim().length < 5) throw new ServiceError('reason', 'Tell us briefly what you need.')
    const list = load()
    if (list.some((a) => a.kind === kind && a.residentId === by.residentId && isOpen(a))) throw new ServiceError('exists', 'You already have one of these. Open it in My Appointments.')
    const now = new Date().toISOString()
    const minutes = lengthOf(kind, [])
    const a: Appointment = {
      id: `apt-${Date.now().toString(36)}`, ref: makeRef(list), kind, subjectId: `self-${by.residentId}`, title: APPOINTMENT_TYPES[kind].label,
      residentId: by.residentId, userId: by.id, reason: reason.trim(), documents: ['Valid government-issued ID'], date: '', time: '', durationMin: minutes, durationEstimate: minutes,
      assignedTo: '', status: 'awaiting_schedule', remindersSent: [], createdAt: now, history: [{ at: now, byUserId: by.id, action: 'Visit requested by the resident' }],
    }
    save([...list, a])
    return a
  }))
}

/** The assigned official accepts a requested time (services that need it). */
export const staffConfirm = (id: string, by: User) => mutate(id, by, (a) => {
  requireHandler(by, a)
  if (a.status !== 'pending_confirmation' || a.staffConfirmed) throw new ServiceError('state', 'Nothing to confirm.')
  a.status = 'confirmed'
  a.staffConfirmed = true
  later(a, 'Your appointment is confirmed', 'confirmed')
  return 'Confirmed by Barangay Personnel'
})

/** Move an appointment to another qualified person at the same time (audited; both are told). */
export const reassign = (id: string, staffId: string, reason: string, by: User) => mutate(id, by, (a) => {
  requireHandler(by, a)
  if (!BOOKED.includes(a.status) || !a.date) throw new ServiceError('state', 'Only booked appointments can be reassigned.')
  if (staffId === a.assignedTo) throw new ServiceError('same', 'Already assigned to this person.')
  if (reason.trim().length < 3) throw new ServiceError('reason', 'Give the reason.')
  checkStaff(a.kind, staffId)
  assertFree(a.date, a.time, staffId, a.durationMin, a.id, a.kind)
  const from = a.assignedTo
  a.assignedTo = staffId
  notify([staffId], 'Appointment assigned to you', `${a.ref} · ${a.date} ${formatTime(a.time)}`, `/appointments/${a.id}`)
  notify([from], 'Appointment moved to a colleague', `${a.ref}: ${reason.trim()}`, `/appointments/${a.id}`)
  return `Reassigned from ${mockUsers.find((u) => u.id === from)?.fullName ?? 'Barangay Personnel'} to ${mockUsers.find((u) => u.id === staffId)?.fullName}: ${reason.trim()}`
})

/** Resident cancels a self-booked or claim visit before the service's cutoff. */
export const cancelByResident = (id: string, reason: string, by: User) => mutate(id, by, (a) => {
  if (!isOwner(a, by)) throw new ServiceError('forbidden', 'This is not your appointment.')
  if (!['chairman_consult', 'general_assist'].includes(a.kind)) throw new ServiceError('kind', 'This visit is part of a request. Use "Choose another time" instead, or contact the Barangay Hall.')
  if (!OPEN.includes(a.status)) throw new ServiceError('state', 'This appointment is already closed.')
  const rule = serviceRule(a.kind)
  if (a.date && rule && startsAt(a) - Date.now() < rule.cancelHours * 3600_000) throw new ServiceError('late', `Cancelling is possible up to ${rule.cancelHours} hours before. Please call the Barangay Hall.`)
  a.status = 'cancelled'
  if (a.assignedTo) notify([a.assignedTo], 'Appointment cancelled by the resident', `${a.ref} · ${a.date} ${formatTime(a.time)}`, `/appointments/${a.id}`)
  return `Cancelled by the resident${reason.trim() ? `: ${reason.trim()}` : ''}`
})

/** Real durations of completed visits (check-in to completion), to tune the estimates. */
export function actualDurations(): Record<string, { avg: number; count: number }> {
  const out: Record<string, { sum: number; count: number }> = {}
  for (const a of load().filter((x) => x.status === 'completed' && x.checkedInAt && x.completedAt)) {
    const m = (new Date(a.completedAt!).getTime() - new Date(a.checkedInAt!).getTime()) / 60_000
    if (m <= 0 || m > 240) continue
    const o = (out[a.kind] ??= { sum: 0, count: 0 })
    o.sum += m; o.count++
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { avg: Math.round(v.sum / v.count), count: v.count }]))
}

// ── Reading ──────────────────────────────────────────────────────────
export type NamedAppointment = Appointment & { residentName: string }
const named = (a: Appointment): NamedAppointment => {
  const r = mockResidents.find((x) => x.id === a.residentId)
  return { ...a, residentName: r ? `${r.firstName} ${r.lastName}` : mockUsers.find((u) => u.id === a.userId)?.fullName ?? 'Resident' }
}
const order = (a: Appointment) => (a.date ? startsAt(a) : Number.MAX_SAFE_INTEGER)

export function listMyAppointments(by: User): Promise<Appointment[]> {
  ensureSampleVisit()
  return mockRequest(() => load().filter((a) => isOwner(a, by)).sort((a, b) => order(a) - order(b)))
}
/** Staff see only the services their role handles. */
export function listAppointments(by: User): Promise<NamedAppointment[]> {
  ensureSampleVisit()
  return mockRequest(() => {
    const kinds = (Object.keys(APPOINTMENT_TYPES) as AppointmentKind[]).filter((k) => mayHandle(by, k))
    if (!kinds.length) throw new ServiceError('forbidden', 'You cannot view appointments.')
    return load().filter((a) => kinds.includes(a.kind)).sort((a, b) => order(a) - order(b)).map(named)
  })
}
export function getAppointment(id: string, by: User): Promise<NamedAppointment> {
  ensureSampleVisit()
  return mockRequest(() => {
    const a = load().find((x) => x.id === id)
    if (!a || (!isOwner(a, by) && !mayHandle(by, a.kind))) throw new ServiceError('not_found', 'Appointment not found.')
    return named(a)
  })
}
export const canViewAppointments = (u: User) => (Object.keys(APPOINTMENT_TYPES) as AppointmentKind[]).some((k) => mayHandle(u, k))
export const kindsFor = (u: User) => (Object.keys(APPOINTMENT_TYPES) as AppointmentKind[]).filter((k) => mayHandle(u, k))
export const appointmentForRequest = (changeRequestId: string) => load().filter((a) => a.subjectId === changeRequestId && a.kind === 'correction_verification').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
export const appointmentFor = (kind: AppointmentKind, subjectId: string) => load().filter((a) => a.subjectId === subjectId && a.kind === kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

/** Hearings shown on calendars (read-only; managed in the case module). Parties see their own; staff need hearings.view. */
export interface HearingEntry { id: string; caseId: string; caseNo: string; title: string; date: string; time: string; minutes: number; label: string; place: string; participants: string[] }
/**
 * Hearings on calendars (read-only here; managed in the case module, one record).
 * Parties see their own with a neutral label; staff with hearings.view and the
 * assigned participants see them.
 */
export function hearingsFor(by: User): HearingEntry[] {
  const staff = can(by, 'hearings.view')
  return mockCases.flatMap((c) => c.hearings.filter((h) => h.status === 'scheduled').flatMap((h) => {
    const participants = hearingParticipants(c, h)
    const party = !!by.residentId && [...c.complainants, ...c.respondents].some((p) => p.residentId === by.residentId)
    if (!staff && !party && !participants.includes(by.id)) return []
    return [{
      id: h.id, caseId: c.id, caseNo: c.caseNo, title: party && !staff ? 'Barangay hearing' : c.title, ...manilaParts(h.scheduledAt), minutes: hearingRule(h)?.minutes ?? 60, place: h.place, participants,
      label: h.kind === 'chairman_mediation' ? 'Mediation with the Punong Barangay' : 'Conciliation (Pangkat)',
    }]
  }))
}

// ── Settings ─────────────────────────────────────────────────────────
export interface AppointmentSettings { remindersOn: boolean }
export function appointmentSettings(): AppointmentSettings {
  try {
    const s = JSON.parse(localStorage.getItem(SET_KEY) ?? '{}') as Partial<AppointmentSettings> & { remindDayBefore?: boolean }
    return { remindersOn: s.remindersOn ?? s.remindDayBefore ?? true }
  } catch { return { remindersOn: true } }
}
export function saveAppointmentSettings(s: AppointmentSettings, by: User) {
  if (!can(by, 'system.settings')) throw new ServiceError('forbidden', 'Only the System Administrator can change reminder settings.')
  localStorage.setItem(SET_KEY, JSON.stringify(s))
  audit(by, `Appointment reminders ${s.remindersOn ? 'on' : 'off'}`, 'Settings')
}

// ── Sample record (demonstration only) ───────────────────────────────
/**
 * One labelled sample so the flow can be seen end to end: the Barangay Secretary
 * requires an in-person check for the sample resident's address correction and
 * sets the time; the resident confirms it from Home. The appointment is saved
 * like any other. The activity-log entry and the resident's notification live
 * in memory, so they are written again (with their original time) each session.
 * The whole prototype runs on sample data; this record is marked "sample" in its history and log.
 */
export const SAMPLE_VISIT_SUBJECT = 'chg-sample-001'
let sampleChecked = false
export function ensureSampleVisit() {
  if (sampleChecked) return
  sampleChecked = true
  const sec = mockUsers.find((u) => u.roleId === 'secretary' && u.status === 'active')
  const residentUser = mockUsers.find((u) => u.residentId === DEMO_RESIDENT_ID && u.status === 'active')
  const res = mockResidents.find((r) => r.id === DEMO_RESIDENT_ID)
  if (!sec || !residentUser || !res) return
  if (!mockChangeRequests.some((c) => c.id === SAMPLE_VISIT_SUBJECT)) {
    mockChangeRequests.push({
      id: SAMPLE_VISIT_SUBJECT, residentId: res.id, submittedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), field: 'Address',
      originalValue: `${res.houseNo} ${res.street}`, requestedValue: `${res.houseNo}-B ${res.street}`, reason: 'Sample request: house number changed after the lot was divided.',
      status: 'pending', proof: { bringOnsite: true },
    } as (typeof mockChangeRequests)[number])
  }
  const list = load()
  const today = manilaToday()
  let a = list.find((x) => x.subjectId === SAMPLE_VISIT_SUBJECT)
  // A sample left in the past (or finished) is replaced, so Home always shows a current example.
  if (a && (!isOpen(a) || (a.date && a.date < today))) { save(list.filter((x) => x.id !== a!.id)); a = undefined }
  if (!a) {
    const kind: AppointmentKind = 'correction_verification'
    const documents = ['Original valid government-issued ID', 'Original proof of address']
    const minutes = lengthOf(kind, documents)
    let date = nextDate(today)
    let slot: { time: string; staffId: string } | undefined
    // Only days the Barangay Hall is open (no weekends, holidays or closures) and times still free.
    for (let i = 0; i < 20; i++) {
      if (dayState(date, minutes, [sec.id], undefined, kind).state === 'open') slot = openTimes(date, minutes, [sec.id], undefined, kind).find((t) => t.time >= '09:00')
      if (slot) break
      date = nextDate(date)
    }
    if (!slot) return
    const now = new Date().toISOString()
    const fresh = load()
    a = {
      id: 'apt-sample-001', ref: makeRef(fresh), kind, subjectId: SAMPLE_VISIT_SUBJECT, subjectRef: SAMPLE_VISIT_SUBJECT, title: 'Record correction: Address',
      residentId: res.id, userId: residentUser.id, reason: 'Check the supporting document', documents, date, time: slot.time, durationMin: minutes, durationEstimate: minutes,
      assignedTo: sec.id, instructions: 'Please bring the original documents listed. (Sample record)', status: 'pending_confirmation', remindersSent: [], createdAt: now,
      history: [{ at: now, byUserId: sec.id, action: `Scheduled for ${date} ${formatTime(slot.time)}–${formatTime(addMinutes(slot.time, minutes))} (${minutes} min, calculated) · sample record` }],
    }
    save([...fresh, a])
  }
  const made = a.history[0]?.at ?? a.createdAt
  audit(sec, `Verification visit scheduled ${a.ref}`, 'Residents', `${SAMPLE_VISIT_SUBJECT} · ${a.date} ${a.time} · ${a.durationMin} min · sample`, 'success', made)
  if (a.status === 'pending_confirmation' && !mockNotifications.some((n) => n.id === `ntf-${a!.id}`)) {
    mockNotifications.push({ id: `ntf-${a.id}`, userId: residentUser.id, category: 'hearing', title: 'Please visit the Barangay Hall', body: visitMessage(a, 'scheduled').short, createdAt: made, read: false, link: `/my/appointments/${a.id}` })
  }
}
