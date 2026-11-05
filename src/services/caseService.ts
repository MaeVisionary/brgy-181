import { KP } from '@/config/barangay'
import { mockCases } from '@/mocks/cases'
import { mockNotifications } from '@/mocks/notifications'
import { mockUsers } from '@/mocks/users'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import type { Permission, User } from '@/types/auth'
import type { CaseStage, Hearing, HearingKind, KPCase } from '@/types/case'
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

function canSee(c: KPCase, a: CaseActor) {
  return a.permissions.has('cases.view') || a.permissions.has('cases.manage') || isComplainant(c, a.user)
}

/** Residents only see their own submission: no internal notes, no other party's contact details. */
function redactForResident(c: KPCase, a: CaseActor): KPCase {
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

export function listCases(a: CaseActor): Promise<KPCase[]> {
  return mockRequest(() => mockCases.filter((c) => canSee(c, a)).map((c) => redactForResident(c, a)).sort((x, y) => y.filedAt.localeCompare(x.filedAt)))
}

export function getCase(id: string, a: CaseActor): Promise<KPCase> {
  return mockRequest(() => {
    const c = mockCases.find((x) => x.id === id)
    if (!c || !canSee(c, a)) throw new ServiceError('not_found', 'Case not found.')
    return redactForResident(c, a)
  })
}

function notify(userIds: string[], title: string, body: string, link: string) {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds)) {
    mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category: 'hearing', title, body, createdAt: now, read: false, link })
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
export function recordHearing(id: string, hearingId: string, attendance: (boolean | null)[], notes: string, a: CaseActor): Promise<KPCase> {
  return mockRequest(() => {
    const c = mockCases.find((x) => x.id === id)
    const h = c?.hearings.find((x) => x.id === hearingId)
    if (!c || !h) throw new ServiceError('not_found', 'Hearing not found.')
    if (!a.permissions.has('hearings.manage')) throw new ServiceError('forbidden', 'Not allowed.')
    h.attendance = h.attendance.map((x, i) => ({ ...x, present: attendance[i] ?? null }))
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
    if (!a.permissions.has('cases.manage')) throw new ServiceError('forbidden', 'Not allowed.')
    c.internalNotes.push(`${new Date().toLocaleDateString('en-PH')}: ${note.trim()}`)
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
