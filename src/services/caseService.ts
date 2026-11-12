import { mockDocumentRequests } from '@/mocks/documentRequests'
import { once } from '@/lib/idempotency'
import { KP } from '@/config/barangay'
import { mockCases } from '@/mocks/cases'
import { mockNotifications } from '@/mocks/notifications'
import { mockUsers } from '@/mocks/users'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import type { Permission, User } from '@/types/auth'
import type { CaseStage, Hearing, HearingKind, KPCase, Availability, AvailabilityWho, Party } from '@/types/case'
import { ServiceError, mockRequest } from './mockApi'

/**
 * Katarungang Pambarangay cases (SAMPLE DATA, in memory).
 * Stage changes follow the documented process; the backend must enforce them again.
 */

export interface CaseActor {
  user: User
  permissions: ReadonlySet<Permission>
}

export const STAGE_LABEL: Record<CaseStage, string> = {
  filed: 'Filed',
  under_review: 'Under Review',
  for_assessment: 'For Assessment',
  mediation_scheduled: 'Mediation Scheduled',
  ongoing_mediation: 'Ongoing Mediation',
  settled: 'Settled',
  referred_to_lupon: 'Referred to Lupon',
  lupon_mediation: 'Lupon Mediation',
  closed: 'Closed',
}

export const STAGE_TONE: Record<CaseStage, 'info' | 'warning' | 'success' | 'neutral' | 'danger'> = {
  filed: 'info',
  under_review: 'info',
  for_assessment: 'warning',
  mediation_scheduled: 'warning',
  ongoing_mediation: 'warning',
  settled: 'success',
  referred_to_lupon: 'danger',
  lupon_mediation: 'warning',
  closed: 'neutral',
}

export interface CaseStep {
  from: CaseStage[]
  to: CaseStage
  label: string
  by: Permission
  remarks?: 'required' | 'optional'
  /** Needs a hearing date (scheduling steps). */
  schedule?: HearingKind
  outcome?: 'settled' | 'not_settled' | 'dismissed' | 'withdrawn'
  hint?: string
}

/** Study: complaint → Chairman mediation up to 15 days → Lupon if not settled. */
export const CASE_STEPS: CaseStep[] = [
  { from: ['filed'], to: 'under_review', label: 'Start review', by: 'cases.manage' },
  { from: ['under_review'], to: 'for_assessment', label: 'Forward to the Barangay Chairman for assessment', by: 'cases.manage' },
  {
    from: ['for_assessment'], to: 'mediation_scheduled', label: 'Schedule mediation under the Barangay Chairman', by: 'cases.decide', schedule: 'chairman_mediation',
    hint: `Starts the Chairman's mediation period of up to ${KP.chairmanMediationDays} days.`,
  },
  { from: ['for_assessment'], to: 'closed', label: 'Close: not for barangay mediation', by: 'cases.decide', remarks: 'required', outcome: 'dismissed' },
  { from: ['mediation_scheduled', 'ongoing_mediation', 'lupon_mediation'], to: 'settled', label: 'Record settlement', by: 'cases.decide', remarks: 'required', outcome: 'settled' },
  { from: ['ongoing_mediation', 'mediation_scheduled'], to: 'referred_to_lupon', label: 'Not settled: refer to the Lupon', by: 'cases.decide', remarks: 'required' },
  { from: ['referred_to_lupon'], to: 'lupon_mediation', label: 'Schedule Lupon mediation', by: 'cases.manage', schedule: 'lupon_mediation' },
  { from: ['lupon_mediation'], to: 'closed', label: 'Close: no settlement', by: 'cases.decide', remarks: 'required', outcome: 'not_settled' },
  { from: ['settled'], to: 'closed', label: 'Close case', by: 'cases.manage', remarks: 'optional' },
  { from: ['filed', 'under_review', 'for_assessment'], to: 'closed', label: 'Close: complaint withdrawn', by: 'cases.manage', remarks: 'required', outcome: 'withdrawn' },
]

const isParty = (c: KPCase, u: User) => !!u.residentId && [...c.complainants, ...c.respondents].some((p) => p.residentId === u.residentId)
const isComplainant = (c: KPCase, u: User) => !!u.residentId && c.complainants.some((p) => p.residentId === u.residentId)

const isAssigned = (c: KPCase, a: CaseActor) => a.permissions.has('cases.assigned') && !!c.assignedTo?.includes(a.user.id)

function canSee(c: KPCase, a: CaseActor) {
  return a.permissions.has('cases.view') || a.permissions.has('cases.manage') || isAssigned(c, a) || isComplainant(c, a.user)
}

/** Residents only see their own submission: no internal notes, no other party's contact details. */
function redactForResident(c: KPCase, a: CaseActor): KPCase {
  if (isAssigned(c, a)) return c
  if (a.permissions.has('cases.view') || a.permissions.has('cases.manage')) {
    return a.permissions.has('cases.manage') ? c : { ...c, internalNotes: [] }
  }
  return {
    ...c,
    respondents: c.respondents.map((p) => ({ name: p.name, address: p.address })),
    internalNotes: [],
    history: c.history.map((h) => ({ ...h, remarks: undefined })),
  }
}

export function stepsFor(c: KPCase, a: CaseActor): CaseStep[] {
  return CASE_STEPS.filter((s) => s.from.includes(c.stage) && a.permissions.has(s.by))
}

const REMOVED_CASES_KEY = 'bmis.removedCases'

/** Closed cases the Chairman removed from the lists (saved on this device in the prototype). */
export function removedCaseIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(REMOVED_CASES_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function saveRemoved(ids: Set<string>) {
  try {
    localStorage.setItem(REMOVED_CASES_KEY, JSON.stringify([...ids]))
  } catch {
    /* storage unavailable */
  }
}

/** Lists cases; removed (closed) cases are left out unless asked for. */
export function listCases(a: CaseActor, opts: { includeRemoved?: boolean } = {}): Promise<KPCase[]> {
  const removed = removedCaseIds()
  return mockRequest(() =>
    mockCases
      .filter((c) => canSee(c, a) && (opts.includeRemoved || !removed.has(c.id)))
      .map((c) => redactForResident(c, a))
      .sort((x, y) => y.filedAt.localeCompare(x.filedAt)),
  )
}

/**
 * The Barangay Chairman can remove a CLOSED case from the lists to keep them short.
 * The record itself is kept (KP records must be preserved) and can be restored.
 */
export function removeClosedCase(id: string, a: CaseActor): Promise<void> {
  return mockRequest(() => {
    if (!a.permissions.has('cases.decide')) throw new ServiceError('forbidden', 'Only the Barangay Chairman can remove cases from the list.')
    const c = mockCases.find((x) => x.id === id)
    if (!c) throw new ServiceError('not_found', 'Case not found.')
    if (c.stage !== 'closed') throw new ServiceError('open', 'Only closed cases can be removed from the list.')
    const ids = removedCaseIds()
    ids.add(id)
    saveRemoved(ids)
    c.history.push({ at: new Date().toISOString(), byUserId: a.user.id, byRole: a.user.roleId, action: 'Removed from the case list (record kept)', stage: c.stage })
  })
}

export function restoreCase(id: string, a: CaseActor): Promise<void> {
  return mockRequest(() => {
    if (!a.permissions.has('cases.decide')) throw new ServiceError('forbidden', 'Only the Barangay Chairman can restore cases.')
    const ids = removedCaseIds()
    ids.delete(id)
    saveRemoved(ids)
    const c = mockCases.find((x) => x.id === id)
    c?.history.push({ at: new Date().toISOString(), byUserId: a.user.id, byRole: a.user.roleId, action: 'Restored to the case list', stage: c.stage })
  })
}

export function getCase(id: string, a: CaseActor): Promise<KPCase> {
  return mockRequest(() => {
    const c = mockCases.find((x) => x.id === id)
    if (!c || !canSee(c, a)) throw new ServiceError('not_found', 'Case not found.')
    return redactForResident(c, a)
  })
}

function notify(userIds: string[], title: string, body: string, link: string, category: 'hearing' | 'complaint' = 'hearing') {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds)) {
    mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category, title, body, createdAt: now, read: false, link })
  }
  window.dispatchEvent(new Event('bmis:notifications-changed'))
}

const usersWith = (p: Permission) => mockUsers.filter((u) => u.status === 'active' && (ROLE_PERMISSIONS[u.roleId].includes(p) || u.extraPermissions?.includes(p))).map((u) => u.id)
const partyUserIds = (c: KPCase) =>
  mockUsers.filter((u) => u.residentId && [...c.complainants, ...c.respondents].some((p) => p.residentId === u.residentId)).map((u) => u.id)

export function applyStep(id: string, step: CaseStep, remarks: string, hearingAt: string | null, a: CaseActor): Promise<KPCase> {
  return mockRequest(() => {
    const c = mockCases.find((x) => x.id === id)
    if (!c || !canSee(c, a)) throw new ServiceError('not_found', 'Case not found.')
    const allowed = stepsFor(c, a).find((s) => s.to === step.to && s.label === step.label)
    if (!allowed) throw new ServiceError('invalid', 'This step is not available right now.')
    if (allowed.remarks === 'required' && !remarks.trim()) throw new ServiceError('remarks', 'Please add a note.')
    if (allowed.schedule && !hearingAt) throw new ServiceError('schedule', 'Choose the hearing date and time.')
    const now = new Date().toISOString()
    const prevStage = c.stage
    c.stage = allowed.to
    if (allowed.to === 'mediation_scheduled') c.mediationStartedAt = now
    if (allowed.to === 'lupon_mediation') c.luponStartedAt = now
    if (allowed.outcome) c.outcome = { type: allowed.outcome, summary: remarks.trim(), at: now }
    if (allowed.schedule && hearingAt) {
      c.hearings.push(newHearing(c, allowed.schedule, hearingAt))
      notify(partyUserIds(c), `Hearing scheduled: ${c.caseNo}`, `${new Date(hearingAt).toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })} at the Barangay 181 Hall.`, `/my/complaints/${c.id}`)
    }
    c.history.push({ at: now, byUserId: a.user.id, byRole: a.user.roleId, action: allowed.label, stage: allowed.to, remarks: remarks.trim() || undefined })
    if (allowed.to === 'for_assessment') notify(usersWith('cases.decide'), `Case for assessment: ${c.caseNo}`, `${c.title} (${c.nature}).`, `/cases/${c.id}`)
    // Tell the complainant only when what they see changes (not every internal step).
    const complainantIds = mockUsers.filter((u) => u.residentId && c.complainants.some((p) => p.residentId === u.residentId)).map((u) => u.id)
    const label = (st: CaseStage) => (st === 'filed' ? 0 : st === 'settled' || st === 'closed' ? 2 : 1)
    if (!allowed.schedule && label(prevStage) !== label(allowed.to))
      notify(complainantIds, allowed.to === 'settled' || allowed.to === 'closed' ? 'Complaint completed' : 'Complaint being processed', `${c.caseNo} · ${c.nature}`, `/my/complaints/${c.id}`, 'complaint')
    return c
  })
}

function newHearing(c: KPCase, kind: HearingKind, at: string): Hearing {
  return {
    id: `hr-${Date.now().toString(36)}`,
    kind,
    scheduledAt: new Date(at).toISOString(),
    place: 'Barangay 181 Hall',
    status: 'scheduled',
    remindersSentAt: [],
    availability: { complainant: 'unconfirmed', respondent: 'unconfirmed', chairman: 'unconfirmed' },
    attendance: [
      ...c.complainants.map((p) => ({ name: p.name, side: 'complainant' as const, present: null })),
      ...c.respondents.map((p) => ({ name: p.name, side: 'respondent' as const, present: null })),
    ],
  }
}

export function scheduleHearing(id: string, kind: HearingKind, at: string, a: CaseActor): Promise<KPCase> {
  return mockRequest(() => {
    const c = mockCases.find((x) => x.id === id)
    if (!c) throw new ServiceError('not_found', 'Case not found.')
    if (!a.permissions.has('hearings.manage')) throw new ServiceError('forbidden', 'Not allowed.')
    c.hearings.push(newHearing(c, kind, at))
    c.history.push({ at: new Date().toISOString(), byUserId: a.user.id, byRole: a.user.roleId, action: `Hearing scheduled for ${new Date(at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}`, stage: c.stage })
    return c
  })
}

/** Records attendance; the first held Chairman hearing moves the case to Ongoing Mediation. */
/** Attendance per person: true present, false absent, 'excused' absent with a valid reason. */
export function recordHearing(id: string, hearingId: string, attendance: (boolean | null | 'excused')[], notes: string, a: CaseActor): Promise<KPCase> {
  return mockRequest(() => {
    const c = mockCases.find((x) => x.id === id)
    const h = c?.hearings.find((x) => x.id === hearingId)
    if (!c || !h) throw new ServiceError('not_found', 'Hearing not found.')
    if (!a.permissions.has('hearings.manage')) throw new ServiceError('forbidden', 'Not allowed.')
    if (h.status !== 'scheduled') throw new ServiceError('state', 'Attendance for this hearing is already final.')
    if (attendance.some((x) => x === null || x === undefined)) throw new ServiceError('attendance', 'Mark everyone as present, absent or excused.')
    h.attendance = h.attendance.map((x, i) => ({ ...x, present: attendance[i] === true, excused: attendance[i] === 'excused' || undefined }))
    h.status = 'held'
    h.notes = notes.trim() || undefined
    const now = new Date().toISOString()
    if (c.stage === 'mediation_scheduled') c.stage = 'ongoing_mediation'
    c.history.push({ at: now, byUserId: a.user.id, byRole: a.user.roleId, action: 'Hearing held: attendance recorded', stage: c.stage, remarks: notes.trim() || undefined })
    return c
  })
}

export function reschedule(id: string, hearingId: string, at: string, a: CaseActor): Promise<KPCase> {
  return mockRequest(() => {
    const c = mockCases.find((x) => x.id === id)
    const h = c?.hearings.find((x) => x.id === hearingId)
    if (!c || !h) throw new ServiceError('not_found', 'Hearing not found.')
    if (!a.permissions.has('hearings.manage')) throw new ServiceError('forbidden', 'Not allowed.')
    h.status = 'rescheduled'
    c.hearings.push({ ...newHearing(c, h.kind, at) })
    c.history.push({ at: new Date().toISOString(), byUserId: a.user.id, byRole: a.user.roleId, action: 'Hearing rescheduled', stage: c.stage })
    notify(partyUserIds(c), `Hearing rescheduled: ${c.caseNo}`, `New schedule: ${new Date(at).toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}.`, `/my/complaints/${c.id}`)
    return c
  })
}

/** FR20: reminders before scheduled hearings (simulated; real email/SMS need the backend). */
export function sendReminder(id: string, hearingId: string, a: CaseActor): Promise<KPCase> {
  return mockRequest(() => {
    const c = mockCases.find((x) => x.id === id)
    const h = c?.hearings.find((x) => x.id === hearingId)
    if (!c || !h) throw new ServiceError('not_found', 'Hearing not found.')
    if (!a.permissions.has('hearings.manage')) throw new ServiceError('forbidden', 'Not allowed.')
    h.remindersSentAt.push(new Date().toISOString())
    notify(partyUserIds(c), `Reminder: hearing for ${c.caseNo}`, `${new Date(h.scheduledAt).toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })} at the ${h.place}.`, `/my/complaints/${c.id}`)
    return c
  })
}

export function addInternalNote(id: string, note: string, a: CaseActor): Promise<KPCase> {
  return mockRequest(() => {
    const c = mockCases.find((x) => x.id === id)
    if (!c) throw new ServiceError('not_found', 'Case not found.')
    if (!a.permissions.has('cases.manage') && !isAssigned(c, a)) throw new ServiceError('forbidden', 'Not allowed.')
    if (!note.trim()) throw new ServiceError('note', 'Write the note first.')
    c.internalNotes.push(`${new Date().toLocaleDateString('en-PH')} · ${a.user.fullName}: ${note.trim()}`)
    return c
  })
}

/** Day count of the Chairman's mediation period (up to 15 days per the study). */
export function mediationDay(c: KPCase, now = new Date()): { day: number; total: number; overdue: boolean } | null {
  if (!c.mediationStartedAt || !['mediation_scheduled', 'ongoing_mediation'].includes(c.stage)) return null
  const day = Math.floor((now.getTime() - new Date(c.mediationStartedAt).getTime()) / 86400000) + 1
  return { day, total: KP.chairmanMediationDays, overdue: day > KP.chairmanMediationDays }
}

export const upcomingHearings = (cases: KPCase[], now = new Date()) =>
  cases
    .flatMap((c) => c.hearings.filter((h) => h.status === 'scheduled' && new Date(h.scheduledAt) >= now).map((h) => ({ c, h })))
    .sort((x, y) => x.h.scheduledAt.localeCompare(y.h.scheduledAt))

export { isParty }

export interface NewCaseInput {
  nature: string
  complainants: Party[]
  respondents: Party[]
  details: string
  incidentDate?: string
  incidentPlace?: string
  filedVia: 'online' | 'walk_in'
  /** Online complaint, incident or blotter report this entry comes from. */
  sourceRequestId?: string
}

const pad = (n: number, w: number) => String(n).padStart(w, '0')

/** Records a complaint in the barangay blotter and opens its case (cases.manage). */
export function createCase(input: NewCaseInput, a: CaseActor, clientRequestId?: string): Promise<KPCase> {
  return mockRequest(() => once(clientRequestId && `${a.user.id}:${clientRequestId}`, (id) => mockCases.find((c) => c.id === id), (c) => c.id, () => {
    if (!a.permissions.has('cases.manage')) throw new ServiceError('forbidden', 'Only case personnel can record blotter entries.')
    const complainants = input.complainants.filter((p) => p.name.trim())
    const respondents = input.respondents.filter((p) => p.name.trim())
    if (!complainants.length) throw new ServiceError('complainant', 'Enter the complainant.')
    if (!respondents.length) throw new ServiceError('respondent', 'Enter the respondent.')
    if (!input.nature.trim()) throw new ServiceError('nature', 'Enter the nature of the complaint.')
    if (!input.details.trim()) throw new ServiceError('details', 'Describe the complaint.')
    if (input.sourceRequestId && mockCases.some((c) => c.sourceRequestId === input.sourceRequestId)) throw new ServiceError('duplicate', 'This report is already recorded in the blotter.')
    const year = new Date().getFullYear()
    const seq = Math.max(0, ...mockCases.map((c) => Number(c.caseNo.split('-')[2]) || 0)) + 1
    const now = new Date().toISOString()
    const c: KPCase = {
      id: `case-${Date.now().toString(36)}`,
      caseNo: `KP-${year}-${pad(seq, 3)}`,
      blotterNo: `BE-${year}-${pad(seq, 4)}`,
      title: `${complainants.map((p) => p.name.split(' ').pop()).join(', ')} vs. ${respondents.map((p) => p.name.split(' ').pop()).join(', ')}`,
      nature: input.nature.trim(),
      complainants,
      respondents,
      details: input.details.trim(),
      incidentDate: input.incidentDate || undefined,
      incidentPlace: input.incidentPlace?.trim() || undefined,
      filedAt: now,
      filedVia: input.filedVia,
      stage: 'filed',
      hearings: [],
      history: [{ at: now, byUserId: a.user.id, byRole: a.user.roleId, action: 'Recorded in the barangay blotter', stage: 'filed' }],
      documentIds: [],
      internalNotes: [],
      sourceRequestId: input.sourceRequestId,
    }
    mockCases.unshift(c)
    const src = input.sourceRequestId && mockDocumentRequests.find((r) => r.id === input.sourceRequestId)
    if (src) {
      src.caseId = c.id
      src.history.push({ status: src.status, at: now, byUserId: a.user.id, byRole: a.user.roleId, action: `Recorded in the blotter as ${c.blotterNo} (case ${c.caseNo})` })
    }
    return c
  }))
}

/** Records whether a person can attend a scheduled hearing. */
export function setAvailability(id: string, hearingId: string, who: AvailabilityWho, value: Availability, a: CaseActor): Promise<KPCase> {
  return mockRequest(() => {
    const c = mockCases.find((x) => x.id === id)
    const h = c?.hearings.find((x) => x.id === hearingId)
    if (!c || !h) throw new ServiceError('not_found', 'Hearing not found.')
    if (!a.permissions.has('hearings.manage')) throw new ServiceError('forbidden', 'Not allowed.')
    h.availability = { ...(h.availability ?? { complainant: 'unconfirmed', respondent: 'unconfirmed', chairman: 'unconfirmed' }), [who]: value }
    return c
  })
}

/** What a resident can file online (its own workflow, separate from document requests). */
export const COMPLAINT_CATEGORIES = ['Complaint against a person', 'Incident report', 'Community concern'] as const
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number]

export interface ResidentComplaintInput {
  category: ComplaintCategory
  /** Short subject, e.g. "Unpaid loan", "Noise at night". */
  nature: string
  details: string
  incidentDate?: string
  incidentPlace?: string
  /** Required only for a complaint against a person. */
  respondents: Party[]
}

/**
 * Resident files a complaint, incident or community concern. Saved as a case
 * (KP reference), never as a document request. The complainant is the signed-in
 * resident, taken from their record. Staff with case rights are notified.
 */
export function submitComplaint(input: ResidentComplaintInput, a: CaseActor, me: { residentId: string; name: string; address: string; contactNo?: string }, clientRequestId?: string): Promise<KPCase> {
  return mockRequest(() => once(clientRequestId && `${a.user.id}:${clientRequestId}`, (id) => mockCases.find((c) => c.id === id), (c) => c.id, () => {
    if (!a.permissions.has('self.complaints')) throw new ServiceError('forbidden', 'You cannot file complaints.')
    if (!a.user.residentId || a.user.residentId !== me.residentId) throw new ServiceError('forbidden', 'You can only file complaints as yourself.')
    if (!COMPLAINT_CATEGORIES.includes(input.category)) throw new ServiceError('category', 'Choose what you are reporting.')
    // Community concerns are not disputes: they go to the community concern workflow (concernService).
    if (input.category === 'Community concern') throw new ServiceError('category', 'Community concerns are sent through the community concern form.')
    if (!input.nature.trim()) throw new ServiceError('nature', 'Enter a short subject.')
    if (input.details.trim().length < 10) throw new ServiceError('details', 'Describe what happened.')
    const respondents = input.respondents.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), address: p.address.trim() }))
    if (input.category === 'Complaint against a person' && !respondents.length) throw new ServiceError('respondent', 'Enter the name of the person you are complaining about.')
    if (input.incidentDate && input.incidentDate > new Date().toISOString().slice(0, 10)) throw new ServiceError('date', 'The date cannot be in the future.')
    const year = new Date().getFullYear()
    const seq = Math.max(0, ...mockCases.map((c) => Number(c.caseNo.split('-')[2]) || 0)) + 1
    const now = new Date().toISOString()
    const complainant: Party = { residentId: me.residentId, name: me.name, address: me.address, contactNo: me.contactNo }
    const c: KPCase = {
      id: `case-${Date.now().toString(36)}`,
      caseNo: `KP-${year}-${pad(seq, 3)}`,
      blotterNo: `BE-${year}-${pad(seq, 4)}`,
      title: respondents.length ? `${me.name.split(' ').pop()} vs. ${respondents.map((p) => p.name.split(' ').pop()).join(', ')}` : `${input.category}: ${input.nature.trim()}`,
      nature: input.nature.trim(),
      complainants: [complainant],
      respondents,
      details: `[${input.category}] ${input.details.trim()}`,
      incidentDate: input.incidentDate || undefined,
      incidentPlace: input.incidentPlace?.trim() || undefined,
      filedAt: now,
      filedVia: 'online',
      stage: 'filed',
      hearings: [],
      history: [{ at: now, byUserId: a.user.id, byRole: a.user.roleId, action: `${input.category} submitted online`, stage: 'filed' }],
      documentIds: [],
      internalNotes: [],
    }
    mockCases.unshift(c)
    const staff = mockUsers.filter((u) => u.status === 'active' && (ROLE_PERMISSIONS[u.roleId]?.includes('cases.manage') || u.extraPermissions?.includes('cases.manage'))).map((u) => u.id)
    notify(staff, 'New complaint filed', `${c.caseNo} · ${input.category}`, `/cases/${c.id}`, 'complaint')
    notify([a.user.id], 'Complaint received', `${c.caseNo} · the barangay will review it.`, `/my/complaints/${c.id}`, 'complaint')
    return c
  }))
}

/** Kagawads who can be assigned to a complaint. */
export function assignableKagawads() {
  return mockUsers.filter((u) => u.status === 'active' && (ROLE_PERMISSIONS[u.roleId]?.includes('cases.assigned') || u.extraPermissions?.includes('cases.assigned')))
}

/** Case personnel assign Kagawads; each newly assigned Kagawad is notified. */
export function assignCase(id: string, userIds: string[], a: CaseActor): Promise<KPCase> {
  return mockRequest(() => {
    if (!a.permissions.has('cases.manage')) throw new ServiceError('forbidden', 'Only case personnel can assign Kagawads.')
    const c = mockCases.find((x) => x.id === id)
    if (!c) throw new ServiceError('not_found', 'Case not found.')
    const valid = new Set(assignableKagawads().map((u) => u.id))
    const next = [...new Set(userIds)].filter((u) => valid.has(u))
    const added = next.filter((u) => !c.assignedTo?.includes(u))
    c.assignedTo = next
    const now = new Date().toISOString()
    c.history.push({ at: now, byUserId: a.user.id, byRole: a.user.roleId, action: next.length ? `Assigned to ${next.map((u) => mockUsers.find((x) => x.id === u)?.fullName).join(', ')}` : 'Assignment removed', stage: c.stage })
    if (added.length) notify(added, `Complaint assigned to you: ${c.caseNo}`, `${c.nature}`, `/cases/${c.id}`, 'complaint')
    return c
  })
}
