import { BARANGAY_CONTACT } from '@/config/barangay'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import { mockChangeRequests, mockResidents } from '@/mocks/residents'
import { mockNotifications } from '@/mocks/notifications'
import { mockUsers } from '@/mocks/users'
import type { Permission, User } from '@/types/auth'
import { audit } from './auditService'
import { ServiceError, mockRequest } from './mockApi'
import { isWorkingDay } from './serviceStandardService'

/**
 * IN-PERSON VERIFICATION APPOINTMENTS (record corrections for now).
 *
 * The Secretary schedules a visit from a correction request; the resident
 * confirms or asks for another time; staff record arrival and what they
 * checked. Verification never approves the correction by itself: the
 * Secretary still decides. Office hours and capacity come from the settings
 * below (editable by staff). Prototype storage: this browser.
 */

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'reschedule_requested' | 'arrived' | 'in_verification' | 'verified' | 'not_verified' | 'no_show' | 'cancelled'
export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  reschedule_requested: 'Reschedule requested',
  arrived: 'Arrived',
  in_verification: 'Verification in progress',
  verified: 'Verified',
  not_verified: 'Not verified',
  no_show: 'No show',
  cancelled: 'Cancelled',
}
const OPEN: AppointmentStatus[] = ['scheduled', 'confirmed', 'reschedule_requested', 'arrived', 'in_verification']

export const VISIT_REASONS = ['Check the original ID', 'Check the supporting document', 'Confirm identity', 'Check employment or personal information'] as const
export const DOCUMENT_OPTIONS = ['Original valid government-issued ID', 'Original PSA birth certificate', 'Original marriage certificate', 'Original proof of employment', 'Original proof of address'] as const

export interface AppointmentSettings {
  /** 24-hour "HH:MM". */
  start: string
  end: string
  /** Lunch break when no visits are booked. */
  breakStart: string
  breakEnd: string
  slotMinutes: number
  /** Visits per slot across all staff. */
  capacity: number
  remindDayBefore: boolean
  remindHourBefore: boolean
}
const DEFAULT_SETTINGS: AppointmentSettings = { start: '08:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00', slotMinutes: 30, capacity: 2, remindDayBefore: true, remindHourBefore: true }

export interface AppointmentEvent { at: string; byUserId: string; action: string }
export interface Appointment {
  id: string
  ref: string
  kind: 'correction'
  subjectId: string
  residentId: string
  userId?: string
  reason: string
  documents: string[]
  /** ISO date and "HH:MM", Manila time. */
  date: string
  time: string
  durationMin: number
  assignedTo: string
  instructions?: string
  status: AppointmentStatus
  rescheduleReason?: string
  arrivedAt?: string
  verification?: { result: 'verified' | 'not_verified'; idPresented: boolean; nameMatches: boolean; documentChecked: boolean; idExpired: boolean; notes: string; byUserId: string; at: string }
  remindersSent: ('day' | 'hour')[]
  history: AppointmentEvent[]
  createdAt: string
}

const KEY = 'bmis.appointments'
const SET_KEY = 'bmis.appointmentSettings'
const load = (): Appointment[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Appointment[] } catch { return [] } }
const save = (l: Appointment[]) => localStorage.setItem(KEY, JSON.stringify(l))
export function appointmentSettings(): AppointmentSettings { try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SET_KEY) ?? '{}') as Partial<AppointmentSettings>) } } catch { return DEFAULT_SETTINGS } }

const can = (u: User, p: Permission) => !!ROLE_PERMISSIONS[u.roleId]?.includes(p) || !!u.extraPermissions?.includes(p)
const requireStaff = (u: User) => { if (!can(u, 'residents.approve')) throw new ServiceError('forbidden', 'You cannot manage verification visits.') }

function notify(userIds: (string | undefined)[], title: string, body: string, link: string) {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds.filter(Boolean) as string[])) mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category: 'hearing', title, body, createdAt: now, read: false, link })
  window.dispatchEvent(new Event('bmis:notifications-changed'))
}
const ownerUserId = (residentId: string) => mockUsers.find((u) => u.residentId === residentId && u.status === 'active')?.id
const staffIds = () => mockUsers.filter((u) => u.status === 'active' && can(u, 'residents.approve')).map((u) => u.id)

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
const startsAt = (a: { date: string; time: string }) => new Date(`${a.date}T${a.time}:00+08:00`).getTime()
export const formatTime = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }

/** Free slots on a date for a staff member (office day, office hours, not past, capacity, no double-booking). */
export function availableSlots(date: string, staffId: string, ignoreId?: string): string[] {
  const s = appointmentSettings()
  if (!isWorkingDay(date)) return []
  const list = load().filter((a) => a.id !== ignoreId && OPEN.includes(a.status) && a.date === date)
  const out: string[] = []
  for (let t = toMin(s.start); t + s.slotMinutes <= toMin(s.end); t += s.slotMinutes) {
    if (t < toMin(s.breakEnd) && t + s.slotMinutes > toMin(s.breakStart)) continue
    const time = fromMin(t)
    if (startsAt({ date, time }) < Date.now() + 30 * 60_000) continue
    const taken = list.filter((a) => a.time === time)
    if (taken.length >= s.capacity || taken.some((a) => a.assignedTo === staffId)) continue
    out.push(time)
  }
  return out
}

export interface ScheduleInput { reason: string; documents: string[]; date: string; time: string; durationMin: number; assignedTo: string; instructions?: string }

function validateSlot(i: ScheduleInput, ignoreId?: string) {
  if (!i.reason.trim()) throw new ServiceError('reason', 'Choose the reason for the visit.')
  if (!i.documents.length) throw new ServiceError('documents', 'Choose what the resident must bring.')
  if (![15, 30, 45, 60].includes(i.durationMin)) throw new ServiceError('duration', 'Choose how long the visit takes.')
  const staff = mockUsers.find((u) => u.id === i.assignedTo && u.status === 'active' && can(u, 'residents.approve'))
  if (!staff) throw new ServiceError('staff', 'Choose who will check the documents.')
  if (!availableSlots(i.date, i.assignedTo, ignoreId).includes(i.time)) throw new ServiceError('slot', 'That time is no longer available. Choose another.')
}

/** Secretary requires an in-person visit for a correction request. */
export function scheduleForCorrection(changeRequestId: string, i: ScheduleInput, by: User): Promise<Appointment> {
  return mockRequest(() => {
    requireStaff(by)
    const cr = mockChangeRequests.find((c) => c.id === changeRequestId)
    if (!cr) throw new ServiceError('not_found', 'Request not found.')
    if (cr.status !== 'pending') throw new ServiceError('decided', 'This request was already decided.')
    const list = load()
    if (list.some((a) => a.subjectId === cr.id && OPEN.includes(a.status))) throw new ServiceError('exists', 'A visit is already set for this request. Reschedule it instead.')
    validateSlot(i)
    const residentId = cr.requestedByResidentId ?? cr.residentId
    const now = new Date().toISOString()
    const a: Appointment = {
      id: `apt-${Date.now().toString(36)}`, ref: `APT-${new Date().getFullYear()}-${String(list.length + 1).padStart(4, '0')}`, kind: 'correction', subjectId: cr.id,
      residentId, userId: ownerUserId(residentId), reason: i.reason.trim(), documents: i.documents, date: i.date, time: i.time, durationMin: i.durationMin, assignedTo: i.assignedTo,
      instructions: i.instructions?.trim() || undefined, status: 'scheduled', remindersSent: [], createdAt: now,
      history: [{ at: now, byUserId: by.id, action: `Scheduled for ${i.date} ${formatTime(i.time)}` }],
    }
    save([...list, a])
    audit(by, `Verification visit scheduled ${a.ref}`, 'Residents', cr.id)
    notify([a.userId], 'Please visit the Barangay Hall', `${formatTime(a.time)}, ${a.date} · bring ${a.documents.join(', ')}`, `/my/appointments/${a.id}`)
    if (a.assignedTo !== by.id) notify([a.assignedTo], 'Verification visit assigned to you', `${a.ref} · ${a.date} ${formatTime(a.time)}`, `/appointments/${a.id}`)
    return a
  })
}

function mutate(id: string, by: User, fn: (a: Appointment) => string): Promise<Appointment> {
  return mockRequest(() => {
    const list = load()
    const a = list.find((x) => x.id === id)
    if (!a) throw new ServiceError('not_found', 'Appointment not found.')
    const action = fn(a)
    a.history.push({ at: new Date().toISOString(), byUserId: by.id, action })
    save(list)
    audit(by, `${action} (${a.ref})`, 'Residents', a.subjectId)
    return a
  })
}
const isOwner = (a: Appointment, by: User) => !!by.residentId && by.residentId === a.residentId

export const confirmAppointment = (id: string, by: User) => mutate(id, by, (a) => {
  if (!isOwner(a, by)) throw new ServiceError('forbidden', 'This is not your appointment.')
  if (a.status !== 'scheduled') throw new ServiceError('state', 'This appointment cannot be confirmed now.')
  a.status = 'confirmed'
  notify([a.assignedTo], 'Resident confirmed the visit', `${a.ref} · ${a.date} ${formatTime(a.time)}`, `/appointments/${a.id}`)
  return 'Confirmed by resident'
})

export const requestReschedule = (id: string, reason: string, by: User) => mutate(id, by, (a) => {
  if (!isOwner(a, by)) throw new ServiceError('forbidden', 'This is not your appointment.')
  if (!['scheduled', 'confirmed'].includes(a.status)) throw new ServiceError('state', 'This appointment cannot be changed now.')
  if (reason.trim().length < 3) throw new ServiceError('reason', 'Tell us why, or a better day and time.')
  a.status = 'reschedule_requested'
  a.rescheduleReason = reason.trim()
  notify([a.assignedTo, ...staffIds()], 'Resident asked for another schedule', `${a.ref} · ${reason.trim()}`, `/appointments/${a.id}`)
  return `Resident asked for another schedule: ${reason.trim()}`
})

export const rescheduleAppointment = (id: string, date: string, time: string, assignedTo: string, by: User) => mutate(id, by, (a) => {
  requireStaff(by)
  if (!['scheduled', 'confirmed', 'reschedule_requested', 'no_show'].includes(a.status)) throw new ServiceError('state', 'This appointment cannot be rescheduled.')
  validateSlot({ reason: a.reason, documents: a.documents, date, time, durationMin: a.durationMin, assignedTo }, a.id)
  const from = `${a.date} ${formatTime(a.time)}`
  a.date = date; a.time = time; a.assignedTo = assignedTo; a.status = 'scheduled'; a.remindersSent = []; a.rescheduleReason = undefined
  notify([a.userId], 'Your visit was moved', `New time: ${formatTime(time)}, ${date}`, `/my/appointments/${a.id}`)
  return `Rescheduled from ${from} to ${date} ${formatTime(time)}`
})

export const markArrived = (id: string, by: User) => mutate(id, by, (a) => {
  requireStaff(by)
  if (!['scheduled', 'confirmed'].includes(a.status)) throw new ServiceError('state', 'Cannot mark arrival now.')
  a.status = 'arrived'
  a.arrivedAt = new Date().toISOString()
  const late = Date.now() - startsAt(a) > 15 * 60_000
  return late ? 'Arrived (late)' : 'Arrived'
})

export const startVerification = (id: string, by: User) => mutate(id, by, (a) => {
  requireStaff(by)
  if (a.status !== 'arrived') throw new ServiceError('state', 'Mark the resident as arrived first.')
  a.status = 'in_verification'
  return 'Verification started'
})

export interface VerificationInput { idPresented: boolean; nameMatches: boolean; documentChecked: boolean; idExpired: boolean; notes: string }

/** Records what was checked. Verified needs a valid, matching ID and the document; it does not approve the correction. */
export const recordVerification = (id: string, result: 'verified' | 'not_verified', v: VerificationInput, by: User) => mutate(id, by, (a) => {
  requireStaff(by)
  if (a.status !== 'in_verification') throw new ServiceError('state', 'Start the verification first.')
  if (result === 'verified' && (!v.idPresented || !v.nameMatches || !v.documentChecked || v.idExpired)) throw new ServiceError('checks', 'To mark as verified, the original ID must be valid and match, and the document must be checked.')
  if (result === 'not_verified' && v.notes.trim().length < 5) throw new ServiceError('notes', 'Explain what did not match and what the resident should do.')
  a.status = result
  a.verification = { result, ...v, notes: v.notes.trim(), byUserId: by.id, at: new Date().toISOString() }
  notify([a.userId], result === 'verified' ? 'Documents checked' : 'Your documents could not be verified', result === 'verified' ? 'The Barangay Secretary will now decide on your request.' : v.notes.trim(), `/my/appointments/${a.id}`)
  return result === 'verified' ? 'Verified' : `Not verified: ${v.notes.trim()}`
})

export const markNoShow = (id: string, by: User) => mutate(id, by, (a) => {
  requireStaff(by)
  if (!['scheduled', 'confirmed'].includes(a.status)) throw new ServiceError('state', 'Cannot mark as no show now.')
  if (Date.now() < startsAt(a)) throw new ServiceError('early', 'The appointment time has not passed yet.')
  a.status = 'no_show'
  notify([a.userId], 'You missed your visit', 'Your request is still open. The barangay will set a new schedule.', `/my/appointments/${a.id}`)
  return 'No show'
})

export const cancelAppointment = (id: string, reason: string, by: User) => mutate(id, by, (a) => {
  requireStaff(by)
  if (!OPEN.includes(a.status) && a.status !== 'no_show') throw new ServiceError('state', 'This appointment is already closed.')
  if (reason.trim().length < 3) throw new ServiceError('reason', 'Give the reason.')
  a.status = 'cancelled'
  notify([a.userId], 'Your visit was cancelled', reason.trim(), `/my/appointments/${a.id}`)
  return `Cancelled: ${reason.trim()}`
})

/** Sends due reminders once each (one day and one hour before). */
export function runReminders(now = Date.now()) {
  const s = appointmentSettings()
  const list = load()
  let changed = false
  for (const a of list.filter((x) => ['scheduled', 'confirmed'].includes(x.status))) {
    const t = startsAt(a)
    if (s.remindDayBefore && !a.remindersSent.includes('day') && t - now <= 24 * 3600_000 && t > now) { a.remindersSent.push('day'); notify([a.userId], 'Reminder: visit tomorrow', `${formatTime(a.time)} at the ${BARANGAY_CONTACT.hall}`, `/my/appointments/${a.id}`); changed = true }
    if (s.remindHourBefore && !a.remindersSent.includes('hour') && t - now <= 3600_000 && t > now) { a.remindersSent.push('hour'); notify([a.userId], 'Reminder: visit in one hour', `${formatTime(a.time)} at the ${BARANGAY_CONTACT.hall}`, `/my/appointments/${a.id}`); changed = true }
  }
  if (changed) save(list)
}

export function listMyAppointments(by: User): Promise<Appointment[]> {
  return mockRequest(() => load().filter((a) => isOwner(a, by)).sort((a, b) => startsAt(b) - startsAt(a)))
}
export function listAppointments(by: User): Promise<(Appointment & { residentName: string })[]> {
  return mockRequest(() => {
    requireStaff(by)
    return load().sort((a, b) => startsAt(a) - startsAt(b)).map((a) => {
      const r = mockResidents.find((x) => x.id === a.residentId)
      return { ...a, residentName: r ? `${r.firstName} ${r.lastName}` : 'Resident' }
    })
  })
}
export function getAppointment(id: string, by: User): Promise<Appointment & { residentName: string }> {
  return mockRequest(() => {
    const a = load().find((x) => x.id === id)
    if (!a || (!isOwner(a, by) && !can(by, 'residents.approve'))) throw new ServiceError('not_found', 'Appointment not found.')
    const r = mockResidents.find((x) => x.id === a.residentId)
    return { ...a, residentName: r ? `${r.firstName} ${r.lastName}` : 'Resident' }
  })
}
export const appointmentForRequest = (changeRequestId: string) => load().filter((a) => a.subjectId === changeRequestId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

export function saveAppointmentSettings(s: AppointmentSettings, by: User) {
  requireStaff(by)
  if (toMin(s.start) >= toMin(s.end) || s.slotMinutes < 15 || s.capacity < 1) throw new ServiceError('settings', 'Check the hours, slot length and capacity.')
  localStorage.setItem(SET_KEY, JSON.stringify(s))
  audit(by, 'Changed visit hours or capacity', 'Settings')
}
