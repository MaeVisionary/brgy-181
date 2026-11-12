import type { SeniorRecord } from '@/analytics/seniorTypes'
import { mockRegistrations, mockResidents } from '@/mocks/residents'
import { mockUsers, applyAccountChanges, rememberAccount } from '@/mocks/users'
import type { Permission, User } from '@/types/auth'
import type { AltCheckKey, AltStatus, AltVerification, CheckResult, RegistrationEvidence, Resident, ResidentRegistration } from '@/types/resident'
import { verificationPolicy } from './verificationPolicy'
import { scheduleIdentityVisit } from './appointmentService'
import { audit } from './auditService'
import { hashPassword, passwordProblem, setCredential } from './credentialStore'
import { ServiceError, mockRequest } from './mockApi'
import { addResident } from './residentService'
import { BARANGAY_CONTACT } from '@/config/barangay'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import { mockNotifications } from '@/mocks/notifications'
import { sendEmail, type EmailRecord } from './emailService'
import { accountNumber, nextNumber } from '@/lib/ids'
import { recall, remember } from '@/lib/idempotency'
import { MSG, errorSummary, hasErrors, isEmail, isMobile, yearProblem, type Errors } from '@/lib/validation'

/**
 * ONLINE RESIDENT SELF-REGISTRATION (prototype).
 *
 * Flow: the applicant answers the record questions, uploads a valid ID and takes
 * a live selfie. The browser reads the ID text, compares the faces and looks the
 * person up in the resident records (and the OSCA masterlist when it is loaded on
 * this device). Every check passing → the account is approved automatically.
 * Anything else → the Barangay Secretary's manual verification queue.
 *
 * PROTOTYPE LIMITS: registrations and new accounts are saved in this browser's
 * localStorage only, so the Secretary sees them only on the same device. The
 * backend phase stores them on the server and repeats every check there (NFR7).
 */

const REG_KEY = 'bmis.registrations'
const USER_KEY = 'bmis.registeredUsers'
export const PRIVACY_NOTICE_VERSION = 'v1.0'
export const MIN_AGE = 18

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function persist() {
  try {
    localStorage.setItem(REG_KEY, JSON.stringify(mockRegistrations.filter((r) => r.id.startsWith('reg-self-'))))
    localStorage.setItem(USER_KEY, JSON.stringify(mockUsers.filter((u) => u.id.startsWith('usr-reg-'))))
  } catch {
    throw new ServiceError('storage', 'This device has no space left to save the registration. Please register at the Barangay Hall instead.')
  }
}

const isApproved = (r: ResidentRegistration) => r.status === 'approved' || r.status === 'auto_approved'

/** Creates (or finds) the resident record for an approved registration and links the account. */
function linkResident(reg: ResidentRegistration): Resident {
  let res = reg.matchedResidentId ? mockResidents.find((r) => r.id === reg.matchedResidentId) : undefined
  if (!res) {
    const a = reg.applicant
    res = addResident(
      {
        lastName: a.lastName,
        firstName: a.firstName,
        middleName: a.middleName,
        suffix: a.suffix,
        birthDate: a.birthDate,
        sex: a.sex ?? 'female',
        civilStatus: a.civilStatus ?? 'single',
        houseNo: a.houseNo ?? '',
        street: a.street ?? '',
        contactNo: a.contactNo,
        voter: !!a.voter,
      },
      {
        id: `res-${reg.id.replace('reg-self-', 'reg-')}`,
        residentSince: a.residentSince,
        oscaId: a.oscaId,
        sectors: { pwd: !!a.pwd, soloParent: !!a.soloParent, fourPs: !!a.fourPs },
        registrationStatus: 'verified',
      },
    )
    reg.matchedResidentId = res.id
  }
  res.registrationStatus = 'verified'
  const user = reg.accountUserId ? mockUsers.find((u) => u.id === reg.accountUserId) : undefined
  if (user) {
    user.residentId = res.id
    user.status = 'active'
  }
  return res
}

/** Restores this device's saved registrations and accounts (runs once on load). */
;(function hydrate() {
  for (const u of read<User[]>(USER_KEY, [])) if (!mockUsers.some((x) => x.id === u.id)) mockUsers.push(u)
  for (const r of read<ResidentRegistration[]>(REG_KEY, [])) {
    if (mockRegistrations.some((x) => x.id === r.id)) continue
    mockRegistrations.push(r)
    if (isApproved(r)) linkResident(r)
  }
  applyAccountChanges()
})()

// ── Record matching ──────────────────────────────────────────────────

const norm = (s: string | undefined) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const ymd = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

export interface RecordMatch {
  result: CheckResult
  residentId?: string
  source?: RegistrationEvidence['recordSource']
  note: string
}

/**
 * Looks the applicant up by full name + birthdate (study §1.4 rule).
 * Same name with a different birthdate is "inconclusive" (could be a typo or a namesake).
 */
export function matchRecord(a: { firstName: string; lastName: string; birthDate: string }, osca?: SeniorRecord[]): RecordMatch {
  const sameName = (first: string, last: string) => norm(last) === norm(a.lastName) && norm(first) === norm(a.firstName)
  const res = mockResidents.find((r) => sameName(r.firstName, r.lastName) && r.birthDate === a.birthDate)
  if (res) return { result: 'passed', residentId: res.id, source: 'resident_records', note: 'Found in the resident records.' }
  const sr = osca?.find((r) => sameName(r.firstName, r.lastName) && r.birthDate && ymd(r.birthDate) === a.birthDate)
  if (sr) return { result: 'passed', source: 'osca_masterlist', note: 'Found in the senior citizen (OSCA) masterlist.' }
  const namesake = mockResidents.some((r) => sameName(r.firstName, r.lastName)) || osca?.some((r) => sameName(r.firstName, r.lastName))
  if (namesake) return { result: 'inconclusive', note: 'A record with this name exists but the birthdate is different.' }
  return { result: 'failed', note: 'No matching record in the barangay records.' }
}

export function ageOn(birthDate: string, today = new Date()): number {
  const b = new Date(`${birthDate}T00:00:00`)
  return today.getFullYear() - b.getFullYear() - (today < new Date(today.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0)
}

/** Username/email must not belong to another account. */
/** Account whose registration was rejected: its username and email can be used to register again. */
const isRejectedAccount = (u: User) => u.status === 'inactive' && mockRegistrations.some((r) => r.accountUserId === u.id && r.status === 'rejected')

const matches = (u: User, v: string) => u.username.toLowerCase() === v || u.email.toLowerCase() === v

export function identifierTaken(value: string): boolean {
  const v = value.trim().toLowerCase()
  return !!v && mockUsers.some((u) => matches(u, v) && !isRejectedAccount(u))
}

// ── Submit ───────────────────────────────────────────────────────────

export interface RegistrationInput {
  applicant: ResidentRegistration['applicant'] & { email: string }
  username: string
  password: string
  /** Valid government ID path. Absent when the applicant has no valid ID (see `alt`). */
  evidence?: Omit<RegistrationEvidence, 'reasons' | 'recordSource'>
  /** No valid government ID: supporting documents, endorsement, in-person request. Never approved automatically. */
  alt?: AltSubmission
  checks: { ocr: CheckResult; faceMatch: CheckResult; liveness: CheckResult }
  record: RecordMatch
  /** The registration draft's id: a retry with the same id returns the first result instead of a second registration. */
  clientRequestId?: string
}

/**
 * Server-side check of a registration (the same rules as the form). Returns
 * one message per field that needs correcting; empty when everything is valid.
 */
export function registrationErrors(input: Pick<RegistrationInput, 'applicant' | 'username' | 'password' | 'evidence' | 'alt'>): Errors {
  const a = input.applicant
  const e: Errors = {}
  const year = new Date().getFullYear()
  if (!a.firstName?.trim()) e.firstName = MSG.required('your first name')
  if (!a.lastName?.trim()) e.lastName = MSG.required('your last name')
  if (a.sex !== 'male' && a.sex !== 'female') e.sex = MSG.choose('Male or Female')
  if (!a.birthDate || Number.isNaN(new Date(a.birthDate).getTime())) e.birthDate = 'Please enter your birthdate.'
  else if (new Date(a.birthDate) > new Date()) e.birthDate = 'Your birthdate cannot be a future date.'
  else if (ageOn(a.birthDate) < MIN_AGE) e.birthDate = `Online registration is for residents ${MIN_AGE} years old and above.`
  if (!['single', 'married', 'widowed', 'separated', 'live_in'].includes(a.civilStatus ?? '')) e.civilStatus = MSG.choose('your civil status')
  if (!a.houseNo?.trim()) e.houseNo = MSG.required('your house or unit number')
  if (!a.street?.trim()) e.street = MSG.choose('your street')
  if (!a.contactNo || !isMobile(a.contactNo)) e.contactNo = MSG.mobile
  if (!a.email || !isEmail(a.email)) e.email = MSG.email
  const yp = yearProblem(String(a.residentSince ?? ''), 1900, year)
  if (yp) e.residentSince = yp
  else if (a.birthDate && Number(a.residentSince) < new Date(a.birthDate).getFullYear()) e.residentSince = 'The year you started living here is before your birth year.'
  if (typeof a.voter !== 'boolean') e.voter = MSG.yesNo
  if (!input.username?.trim() || !/^[a-z0-9._@-]{4,}$/i.test(input.username.trim())) e.username = 'Please use at least 4 characters for your username: letters, numbers, dots, dashes or @.'
  const pw = passwordProblem(input.password ?? '')
  if (pw) e.password = pw
  if (input.alt) return { ...e, ...altErrors(input.alt) }
  if (!input.evidence?.idType) e.idType = MSG.choose('the type of ID you used')
  if (!input.evidence?.idNumber || input.evidence.idNumber.trim().length < 4) e.idNumber = 'Please enter the ID number printed on your card.'
  if (!input.evidence?.idImage) e.idImage = 'Please add a photo of your ID.'
  if (!input.evidence?.selfieImage) e.selfieImage = 'Please complete the face check.'
  return e
}

export async function submitRegistration(input: RegistrationInput): Promise<ResidentRegistration> {
  const a = input.applicant
  const onceKey = input.clientRequestId && `guest:${input.clientRequestId}`
  const prior = recall(onceKey, (id) => mockRegistrations.find((r) => r.id === id))
  if (prior) return structuredClone(prior)
  const invalid = registrationErrors(input)
  if (hasErrors(invalid)) throw new ServiceError('invalid', `Some details need correcting: ${errorSummary(invalid)}`)
  if (ageOn(a.birthDate) < MIN_AGE) throw new ServiceError('age', `Online registration is for residents ${MIN_AGE} years old and above.`)
  if (identifierTaken(input.username) || identifierTaken(a.email)) throw new ServiceError('taken', 'That username or email already has an account.')
  const pw = passwordProblem(input.password)
  if (pw) throw new ServiceError('password', pw)

  const reasons: string[] = []
  const { ocr, faceMatch, liveness } = input.checks
  const record = input.record
  if (record.result !== 'passed') reasons.push(record.note)
  if (input.alt) reasons.push('Registered without a valid government ID: alternative verification is needed.')
  else if (ocr !== 'passed') reasons.push('The name on the ID could not be read clearly or did not match the name entered.')
  if (input.alt || !input.evidence) { /* no ID photo or selfie to compare */ }
  else if (input.evidence.faceSimilarity === undefined) reasons.push('No clear face was found on the ID photo or the selfie, so the faces could not be compared.')
  else if (faceMatch === 'failed') reasons.push('The selfie does not look like the photo on the ID.')
  else if (faceMatch === 'inconclusive') reasons.push('The face comparison was not certain.')
  if (!input.alt && liveness !== 'passed') reasons.push('The live selfie check was not completed (a photo was uploaded instead).')
  // One verified account per resident.
  if (record.residentId && mockUsers.some((u) => u.residentId === record.residentId && u.status === 'active')) {
    reasons.push('This resident already has an active online account.')
  }
  // Without a valid ID a person always decides: never approved automatically.
  const auto = reasons.length === 0 && !input.alt

  const n = mockRegistrations.length + 1
  const id = `reg-self-${Date.now().toString(36)}`
  const userId = `usr-reg-${Date.now().toString(36)}`
  const fullName = [a.firstName, a.middleName, a.lastName, a.suffix].filter(Boolean).join(' ')
  const user: User = {
    id: userId,
    username: input.username.trim().toLowerCase(),
    fullName,
    position: 'Resident',
    roleId: 'resident',
    email: a.email.trim().toLowerCase(),
    status: 'inactive',
  }
  const reg: ResidentRegistration = {
    id,
    referenceNo: `REG-${new Date().getFullYear()}-${String(148 + n).padStart(4, '0')}`,
    submittedAt: new Date().toISOString(),
    applicant: { ...a, email: user.email },
    matchedResidentId: record.residentId,
    verification: { ocr, masterListMatch: record.result, faceMatch, liveness },
    status: auto ? 'auto_approved' : 'manual_review',
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    evidence: input.evidence ? { ...input.evidence, recordSource: record.source, reasons } : undefined,
    alt: input.alt ? newAlt(input.alt) : undefined,
    accountUserId: userId,
  }

  const hash = await hashPassword(userId, input.password)
  return mockRequest(() => {
    // Resubmission: the rejected account is replaced; its registration stays on record.
    for (const old of mockUsers.filter((u) => isRejectedAccount(u) && (matches(u, input.username.trim().toLowerCase()) || matches(u, user.email)))) {
      mockUsers.splice(mockUsers.indexOf(old), 1)
    }
    // Login number from the account sequence (never the resident number; never reused).
    user.accountNo = accountNumber(nextNumber('ACC', mockUsers.map((u) => u.accountNo ?? '')))
    mockUsers.push(user)
    mockRegistrations.push(reg)
    reg.history = [
      { at: reg.submittedAt, by: userId, action: 'Registration submitted online' },
      ...(input.evidence ? [{ at: reg.submittedAt, by: userId, action: 'ID photo and selfie uploaded' }] : []),
      ...(input.alt ? [{ at: reg.submittedAt, by: userId, action: 'No valid government ID: alternative verification requested', note: altSummary(input.alt) }] : []),
      { at: reg.submittedAt, by: 'system', action: 'Automated checks completed', note: checksNote({ ocr, faceMatch, liveness, masterListMatch: record.result }) },
      auto ? { at: reg.submittedAt, by: 'system', action: 'Approved automatically: every check passed' } : { at: reg.submittedAt, by: 'system', action: input.alt ? 'Sent for alternative verification' : 'Sent for manual verification', note: reasons.join('; ') || undefined },
    ]
    if (auto) linkResident(reg)
    try {
      persist()
    } catch (e) {
      mockUsers.splice(mockUsers.indexOf(user), 1)
      mockRegistrations.splice(mockRegistrations.indexOf(reg), 1)
      throw e
    }
    setCredential(userId, { hash, mustChange: false, updatedAt: new Date().toISOString() })
    audit(user, auto ? 'Registration auto-approved' : input.alt ? 'Registration submitted without a valid ID (alternative verification)' : 'Registration submitted for manual verification', 'Residents', reg.referenceNo)
    if (reg.alt) {
      notifyStaff(verifiers(), 'Registration without a valid ID', `${reg.referenceNo}: ${a.firstName} ${a.lastName} · ${altSummary(input.alt!)}`, reg)
      void tellApplicant(reg, 'We received your registration', `Your registration was received. Because you registered without a valid government ID, the Barangay Secretary will verify your identity and residency${reg.alt.inPersonRequested ? ' and contact you to set a visit to the Barangay Hall' : ''}. Status: ${ALT_STATUS_LABEL[reg.alt.status]}.`)
    }
    remember(onceKey, reg.id)
    return reg
  })
}

// ── Secretary's queue ────────────────────────────────────────────────

const word = (v: CheckResult) => (v === 'passed' ? 'Verified' : 'Needs checking')
/** Plain summary of the four checks for the activity history. */
const checksNote = (v: { ocr: CheckResult; faceMatch: CheckResult; liveness: CheckResult; masterListMatch: CheckResult }) =>
  `Barangay Record: ${word(v.masterListMatch)} · ID Information: ${word(v.ocr)} · Photo Verification: ${word(v.faceMatch)} · Live Photo Check: ${word(v.liveness)}`
const log = (reg: ResidentRegistration, by: string, action: string, note?: string) => {
  reg.history = [...(reg.history ?? []), { at: new Date().toISOString(), by, action, note: note?.trim() || undefined }]
}
const hasPerm = (u: User, p: Permission) => !!(ROLE_PERMISSIONS[u.roleId]?.includes(p) || u.extraPermissions?.includes(p))
/** Punong Barangay: acts on reports about approved registrations. */
export const canOverrideRegistration = (u: User) => hasPerm(u, 'residents.override')
const canOpenRegistration = (u: User) => canVerify(u) || canOverrideRegistration(u)

/** One registration for the details page (Barangay Personnel who review registrations, or the Punong Barangay). Opening it is logged. */
export function getRegistration(id: string, by: User): Promise<ResidentRegistration> {
  return mockRequest(() => {
    if (!canOpenRegistration(by)) throw new ServiceError('forbidden', 'You cannot view registrations.')
    const reg = mockRegistrations.find((r) => r.id === id)
    if (!reg) throw new ServiceError('not_found', 'Registration not found.')
    audit(by, 'Opened registration record', 'Residents', reg.referenceNo)
    return reg
  })
}

/**
 * Timeline for a registration: the recorded history, or (for older records
 * without one) what can be read from the record itself.
 */
export function registrationTimeline(r: ResidentRegistration): { at: string; by: string; action: string; note?: string }[] {
  // Records made before history was kept: rebuild the early steps from the record, then add what was logged since.
  const logged = r.history ?? []
  if (logged.some((h) => h.action.startsWith('Registration submitted'))) return [...logged].sort((a, b) => a.at.localeCompare(b.at))
  const out: { at: string; by: string; action: string; note?: string }[] = [{ at: r.submittedAt, by: r.accountUserId ?? '', action: 'Registration submitted' }]
  if (r.evidence) out.push({ at: r.submittedAt, by: r.accountUserId ?? '', action: 'ID photo and selfie uploaded' })
  const v = r.verification
  out.push({ at: r.submittedAt, by: 'system', action: 'Automated checks completed', note: [checksNote(v), ...(r.evidence?.reasons ?? [])].join(' · ') })
  if (r.status === 'auto_approved') out.push({ at: r.decidedAt ?? r.submittedAt, by: 'system', action: 'Approved automatically: every check passed' })
  if (r.inPerson) out.push({ at: r.inPerson.requestedAt, by: r.inPerson.requestedBy, action: 'In-person visit requested', note: r.inPerson.reason })
  if (r.inPerson?.completedAt) out.push({ at: r.inPerson.completedAt, by: r.inPerson.completedBy ?? '', action: 'In-person visit recorded', note: r.inPerson.inspected })
  if (r.decidedAt && r.status !== 'auto_approved' && !logged.some((h) => h.at === r.decidedAt)) out.push({ at: r.decidedAt, by: r.decidedBy ?? '', action: r.status === 'rejected' ? 'Rejected' : 'Approved after manual verification', note: r.decisionNote })
  // A step that was also logged is shown once (the logged version, with its exact time).
  const loggedActions = new Set(logged.map((h) => h.action))
  return [...out.filter((h) => !loggedActions.has(h.action)), ...logged].sort((a, b) => a.at.localeCompare(b.at))
}

const overriders = () => mockUsers.filter((u) => u.status === 'active' && canOverrideRegistration(u)).map((u) => u.id)
const notifyUsers = (ids: string[], title: string, body: string, link?: string) => {
  const now = new Date().toISOString()
  for (const userId of new Set(ids)) mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category: 'registration', title, body, createdAt: now, read: false, link })
}

/**
 * The Secretary (or anyone who reviews registrations) reports a problem with an
 * approved registration, e.g. an auto-approval that should not have passed. The
 * approval stays as it is; the Punong Barangay is asked to decide.
 */
export function reportRegistration(id: string, reason: string, by: User): Promise<ResidentRegistration> {
  return mockRequest(() => {
    if (!canVerify(by)) throw new ServiceError('forbidden', 'You cannot report registrations.')
    const reg = mockRegistrations.find((r) => r.id === id)
    if (!reg) throw new ServiceError('not_found', 'Registration not found.')
    if (!isApproved(reg)) throw new ServiceError('state', 'Only approved registrations can be reported. Pending ones are decided in the review.')
    if (reg.report && (reg.report.status === 'open' || reg.report.status === 'suspended')) throw new ServiceError('open', 'A report on this registration is already waiting for the Punong Barangay.')
    if (reason.trim().length < 10) throw new ServiceError('reason', 'Describe what is wrong (at least 10 characters), e.g. "The ID photo does not match the selfie".')
    const now = new Date().toISOString()
    reg.report = { status: 'open', reason: reason.trim(), reportedBy: by.id, reportedAt: now }
    log(reg, by.id, 'Problem reported to the Punong Barangay', reason)
    persist()
    audit(by, 'Reported a problem with an approved registration', 'Residents', reg.referenceNo)
    notifyUsers(overriders(), 'Registration reported for review', `${reg.referenceNo}: ${reason.trim()}`, `/residents/registrations/${reg.id}`)
    return reg
  })
}

/**
 * The Punong Barangay acts on a report: keep the approval (no change), suspend
 * the account while it is checked, or reinstate a suspended account. A reason is
 * required, the registration's status is never rewritten, and every step is logged.
 */
export function decideRegistrationReport(id: string, action: 'no_change' | 'suspend' | 'reinstate', note: string, by: User): Promise<ResidentRegistration> {
  return mockRequest(() => {
    if (!canOverrideRegistration(by)) throw new ServiceError('forbidden', 'Only the Punong Barangay can act on reports about approved registrations.')
    const reg = mockRegistrations.find((r) => r.id === id)
    if (!reg?.report) throw new ServiceError('not_found', 'There is no report on this registration.')
    if (note.trim().length < 10) throw new ServiceError('note', 'Give the reason for this decision (at least 10 characters).')
    const r = reg.report
    const account = mockUsers.find((u) => u.id === reg.accountUserId)
    const now = new Date().toISOString()
    if (action === 'no_change') {
      if (r.status !== 'open') throw new ServiceError('state', 'This report was already decided.')
      r.status = 'no_change'
      log(reg, by.id, 'Report closed: approval kept', note)
    } else if (action === 'suspend') {
      if (r.status !== 'open') throw new ServiceError('state', 'Only an open report can lead to a suspension.')
      r.status = 'suspended'
      if (account) { account.status = 'inactive'; rememberAccount(account) }
      log(reg, by.id, 'Account suspended while the registration is checked', note)
      if (account) notifyUsers([account.id], 'Your account is on hold', `${reg.referenceNo}: please visit the Barangay Hall with a valid ID. ${note.trim()}`)
    } else {
      if (r.status !== 'suspended') throw new ServiceError('state', 'Only a suspended account can be reinstated.')
      r.status = 'reinstated'
      if (account) { account.status = 'active'; rememberAccount(account) }
      log(reg, by.id, 'Account reinstated', note)
      if (account) notifyUsers([account.id], 'Your account is active again', `${reg.referenceNo}: ${note.trim()}`)
    }
    r.decision = note.trim(); r.decidedBy = by.id; r.decidedAt = now
    persist()
    audit(by, action === 'no_change' ? 'Registration report closed (no change)' : action === 'suspend' ? 'Account suspended after a registration report' : 'Account reinstated after review', 'Residents', reg.referenceNo)
    notifyUsers([r.reportedBy], 'Decision on your registration report', `${reg.referenceNo}: ${action === 'no_change' ? 'approval kept' : action === 'suspend' ? 'account suspended' : 'account reinstated'}. ${note.trim()}`, `/residents/registrations/${reg.id}`)
    return reg
  })
}

// ── Secretary's queue ────────────────────────────────────────────────

export function listRegistrations(): Promise<ResidentRegistration[]> {
  return mockRequest(() => [...mockRegistrations].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)))
}

export function decideRegistration(id: string, decision: 'approved' | 'rejected', note: string, by: User): Promise<ResidentRegistration> {
  return mockRequest(() => {
    const reg = mockRegistrations.find((r) => r.id === id)
    if (!reg) throw new ServiceError('not_found', 'Registration not found.')
    if (!(ROLE_PERMISSIONS[by.roleId]?.includes('residents.approve') || by.extraPermissions?.includes('residents.approve'))) throw new ServiceError('forbidden', 'You cannot decide registrations.')
    if (reg.status !== 'manual_review') throw new ServiceError('decided', 'This registration was already decided.')
    if (decision === 'rejected' && !note.trim()) throw new ServiceError('note', 'Add the reason for rejecting.')
    if (reg.alt && decision === 'approved' && reg.alt.status !== 'verified') throw new ServiceError('alt', 'Complete the alternative verification (identity and residency) before approving.')
    if (reg.alt && decision === 'rejected') throw new ServiceError('alt', 'Use "Reject" in the alternative verification, with the reason.')
    reg.status = decision
    reg.decidedBy = by.id
    reg.decidedAt = new Date().toISOString()
    reg.decisionNote = note.trim() || undefined
    log(reg, by.id, decision === 'approved' ? 'Approved after manual verification' : 'Rejected', note)
    if (decision === 'approved') linkResident(reg)
    persist()
    audit(by, decision === 'approved' ? 'Registration approved' : 'Registration rejected', 'Residents', reg.referenceNo)
    if (reg.accountUserId)
      mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId: reg.accountUserId, category: 'registration', title: decision === 'approved' ? 'Your registration was approved' : 'Your registration was not approved', body: `${reg.referenceNo}${decision === 'rejected' && reg.decisionNote ? ` · ${reg.decisionNote}` : ''}`, createdAt: reg.decidedAt!, read: false })
    return reg
  })
}

/** Why a self-registered account cannot sign in yet (used by sign-in). */
export function pendingAccountMessage(userId: string): string | null {
  const reg = mockRegistrations.find((r) => r.accountUserId === userId)
  if (!reg) return null
  if (reg.status === 'manual_review' && reg.alt)
    return `Status: ${ALT_STATUS_LABEL[reg.alt.status]}. Your registration (${reg.referenceNo}) is being verified. Check the registration status page with your reference number and birth date for what to do next.`
  if (reg.status === 'manual_review' && reg.inPerson && !reg.inPerson.completedAt)
    return `Please visit the ${BARANGAY_CONTACT.hall} to complete your registration (${reg.referenceNo}). Reason: ${reg.inPerson.reason} Please bring: ${reg.inPerson.bring}.`
  if (reg.status === 'manual_review')
    return `Status: Pending Approval. Your registration (${reg.referenceNo}) is being reviewed by the Barangay Secretary. You can sign in once it is approved.`
  if (reg.status === 'rejected')
    return `Status: Rejected. Your registration (${reg.referenceNo}) was not approved${reg.decisionNote ? `. Reason: ${reg.decisionNote.trim().replace(/[.\s]+$/, '')}` : ''}. You can register again with corrected details, or visit the Barangay Hall with a valid ID.`
  return null
}

// ── In-person verification ───────────────────────────────────────────

export const IN_PERSON_REASONS = [
  'The ID needs to be checked in person.',
  'Your name or birthdate does not match our records.',
  'The face check needs to be confirmed in person.',
  'Your existing barangay record needs clarification.',
  'Additional supporting documents are needed.',
] as const

const canVerify = (u: User) => !!(ROLE_PERMISSIONS[u.roleId]?.includes('residents.verify') || u.extraPermissions?.includes('residents.verify'))

/** Email text built only from real applicant data and what the Secretary entered. */
export function inPersonEmail(reg: ResidentRegistration, v: { reason: string; bring: string; date?: string; time?: string; notes?: string }) {
  const name = [reg.applicant.firstName, reg.applicant.lastName].join(' ')
  const when = v.date ? `${new Date(v.date + 'T12:00:00+08:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}${v.time ? `, ${v.time}` : ''}` : null
  const lines = [
    `Dear ${name},`,
    '',
    'Thank you for registering with Barangay 181.',
    '',
    'We need to check some information in your registration before we can complete it.',
    '',
    `Reason: ${v.reason.trim()}`,
    '',
    `Please bring: ${v.bring.trim()}`,
    '',
    `Visit: ${BARANGAY_CONTACT.hall}, ${BARANGAY_CONTACT.address}`,
    when ? `Appointment: ${when}` : `Office hours: ${BARANGAY_CONTACT.officeHours}`,
    ...(v.notes?.trim() ? ['', v.notes.trim()] : []),
    '',
    `Your registration (${reg.referenceNo}) is still under review. We will update you once the check is done.`,
    '',
    'Thank you.',
    '',
    'Barangay 181',
    'Resident Registration Office',
  ]
  return { subject: 'Action required: please visit Barangay 181 for your resident registration', body: lines.join('\n') }
}

/** Secretary asks the applicant to come in. Not an approval or a rejection. */
export async function requestInPerson(id: string, v: { reason: string; bring: string; date?: string; time?: string; notes?: string; body?: string }, by: User): Promise<{ reg: ResidentRegistration; email: EmailRecord | null }> {
  const reg = mockRegistrations.find((r) => r.id === id)
  if (!reg) throw new ServiceError('not_found', 'Registration not found.')
  if (!canVerify(by)) throw new ServiceError('forbidden', 'You cannot review registrations.')
  if (reg.status !== 'manual_review') throw new ServiceError('decided', 'This registration was already decided.')
  if (reg.inPerson && !reg.inPerson.completedAt) throw new ServiceError('duplicate', 'A visit was already requested. Resend the email instead.')
  if (!v.reason.trim()) throw new ServiceError('reason', 'Give the reason for the visit.')
  if (!v.bring.trim()) throw new ServiceError('bring', 'Say what the applicant needs to bring.')
  const mail = inPersonEmail(reg, v)
  const to = reg.applicant.email
  const email = to ? await sendEmail({ to, subject: mail.subject, body: v.body?.trim() || mail.body, ref: reg.referenceNo }) : null
  const now = new Date().toISOString()
  log(reg, by.id, 'In-person visit requested', `${v.reason.trim()} · bring ${v.bring.trim()}`)
  reg.inPerson = { reason: v.reason.trim(), bring: v.bring.trim(), date: v.date || undefined, time: v.time || undefined, notes: v.notes?.trim() || undefined, requestedBy: by.id, requestedAt: now, emailIds: email ? [email.id] : [] }
  if (reg.accountUserId) {
    mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId: reg.accountUserId, category: 'registration', title: 'Please visit Barangay 181', body: `${reg.referenceNo} · bring ${v.bring.trim()}`, createdAt: now, read: false })
  }
  persist()
  audit(by, `In-person verification requested${email ? ` (${email.status})` : ' (no email address)'}`, 'Residents', reg.referenceNo)
  return { reg, email }
}

/** Sends the visit email again (e.g. after a failure). */
export async function resendInPersonEmail(id: string, by: User): Promise<EmailRecord> {
  const reg = mockRegistrations.find((r) => r.id === id)
  if (!reg?.inPerson) throw new ServiceError('not_found', 'No visit request found.')
  if (!canVerify(by)) throw new ServiceError('forbidden', 'You cannot review registrations.')
  if (!reg.applicant.email) throw new ServiceError('no_email', 'This applicant has no email address.')
  const mail = inPersonEmail(reg, reg.inPerson)
  const email = await sendEmail({ to: reg.applicant.email, subject: mail.subject, body: mail.body, ref: reg.referenceNo })
  reg.inPerson.emailIds.push(email.id)
  persist()
  audit(by, `Visit email resent (${email.status})`, 'Residents', reg.referenceNo)
  return email
}

/** The applicant came in: record what was checked, then the Secretary decides. */
export function completeInPerson(id: string, v: { inspected: string; notes: string }, by: User): Promise<ResidentRegistration> {
  return mockRequest(() => {
    const reg = mockRegistrations.find((r) => r.id === id)
    if (!reg?.inPerson) throw new ServiceError('not_found', 'No visit request found.')
    if (!canVerify(by)) throw new ServiceError('forbidden', 'You cannot review registrations.')
    if (reg.inPerson.completedAt) throw new ServiceError('done', 'The visit was already recorded.')
    if (!v.inspected.trim()) throw new ServiceError('inspected', 'List the documents you checked.')
    reg.inPerson.completedAt = new Date().toISOString()
    reg.inPerson.completedBy = by.id
    reg.inPerson.inspected = v.inspected.trim()
    reg.inPerson.outcomeNotes = v.notes.trim() || undefined
    log(reg, by.id, 'In-person visit recorded', `Checked: ${v.inspected.trim()}`)
    persist()
    audit(by, 'In-person verification completed', 'Residents', reg.referenceNo)
    return reg
  })
}

// ── Alternative identity verification (no valid government ID) ───────

export const ALT_STATUS_LABEL: Record<AltStatus, string> = {
  pending: 'Pending alternative verification',
  document_review: 'For document review',
  in_person_required: 'In-person verification required',
  scheduled: 'Verification scheduled',
  under_verification: 'Under verification',
  needs_more: 'Needs additional requirements',
  verified: 'Verified',
  rejected: 'Rejected',
}
export const ALT_CHECKS: { key: AltCheckKey; label: string }[] = [
  { key: 'personal', label: 'Name and personal information reviewed' },
  { key: 'evidence', label: 'Supporting evidence reviewed' },
  { key: 'identity', label: 'Identity verified (the applicant is who they say)' },
  { key: 'residency', label: 'Residency verified (lives in Barangay 181)' },
  { key: 'community', label: 'Household or community verification' },
  { key: 'in_person', label: 'In-person verification completed' },
]
/** Legitimate reasons to reject. Having no government ID is never one of them. */
export const ALT_REJECT_REASONS = [
  'Not a resident of Barangay 181',
  'Identity could not be established after verification',
  'False or inconsistent information',
  'Duplicate registration (already registered)',
  'No response to the requested requirements by the deadline',
] as const

export interface AltSubmission {
  documents: { category: string; fileName: string; dataUrl: string; kind: 'image' | 'pdf' }[]
  noDocuments: boolean
  endorsement?: { name: string; relationship: string; source?: string; contactNo?: string; purok?: string; document?: { fileName: string; dataUrl: string; kind: 'image' | 'pdf' } }
  inPersonRequested: boolean
}
const MAX_DOC_CHARS = 2_200_000 // about 1.6 MB of file per document

/** Problems with the "no valid ID" section (empty when it can be submitted). */
export function altErrors(alt: AltSubmission): Record<string, string> {
  const e: Record<string, string> = {}
  const pol = verificationPolicy()
  if (!alt.noDocuments && !alt.documents.length) e.documents = 'Add at least one supporting document, or tick "I don\'t have any supporting documents".'
  for (const d of alt.documents) {
    if (!pol.documentCategories.includes(d.category)) e.documents = 'Choose the type of each document from the list.'
    if (!d.dataUrl || d.dataUrl.length > MAX_DOC_CHARS) e.documents = `"${d.fileName}" is too large. Please use a photo or PDF smaller than 1.5 MB.`
  }
  const en = alt.endorsement
  if (en && (en.name.trim() || en.relationship.trim())) {
    if (en.name.trim().length < 3) e.endorser = 'Please enter the full name of the person who can vouch for you.'
    if (en.relationship.trim().length < 3) e.endorserRole = 'Please say how they know you, or their position (for example "Purok 3 leader").'
    if (en.contactNo && !/^09\d{9}$/.test(en.contactNo.replace(/[\s-]/g, ''))) e.endorserContact = 'Please enter an 11-digit mobile number starting with 09, or leave it empty.'
  }
  const hasEndorsement = !!en && en.name.trim().length >= 3 && en.relationship.trim().length >= 3
  if (alt.noDocuments && !hasEndorsement && !alt.inPersonRequested) e.choice = 'With no documents, please name someone who can vouch for you, or request in-person verification (or both).'
  if (pol.inPersonWhen === 'always' && !alt.inPersonRequested) e.choice = 'Please request in-person verification. Barangay 181 checks every registration without a valid ID in person.'
  if (pol.inPersonWhen === 'no_documents' && alt.noDocuments && !alt.inPersonRequested) e.choice = 'Without documents, please request in-person verification at the Barangay Hall.'
  return e
}

const verifiers = () => mockUsers.filter((u) => u.status === 'active' && canVerify(u)).map((u) => u.id)
const notifyStaff = (ids: string[], title: string, body: string, reg: ResidentRegistration) => {
  const now = new Date().toISOString()
  for (const userId of new Set(ids)) mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category: 'registration', title, body, createdAt: now, read: false, link: `/residents/registrations/${reg.id}` })
}
/** The applicant has no active account yet: e-mail (simulated here) plus the in-app notice they see once approved. Never includes documents. */
async function tellApplicant(reg: ResidentRegistration, subject: string, body: string) {
  const to = reg.applicant.email
  if (to) await sendEmail({ to, subject: `${subject} (${reg.referenceNo})`, body: `${body}\n\nCheck your registration: ${location.origin}${import.meta.env.BASE_URL}register/status (reference ${reg.referenceNo} and your birth date).\n\nBarangay 181`, ref: reg.referenceNo })
  if (reg.accountUserId) mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId: reg.accountUserId, category: 'registration', title: subject, body: `${reg.referenceNo}: ${body}`, createdAt: new Date().toISOString(), read: false })
}
const altOf = (id: string, by: User) => {
  if (!canVerify(by)) throw new ServiceError('forbidden', 'You cannot review registrations.')
  const reg = mockRegistrations.find((r) => r.id === id)
  if (!reg?.alt) throw new ServiceError('not_found', 'This registration has no alternative verification.')
  if (reg.alt.status === 'verified' || reg.alt.status === 'rejected') throw new ServiceError('closed', 'Verification is already finished for this registration.')
  return { reg, alt: reg.alt }
}

/** Record one verification finding. A checklist item is marked done only through this, with how it was verified. */
export function altRecordCheck(id: string, key: AltCheckKey, f: { method: string; evidence: string; note?: string }, by: User): Promise<ResidentRegistration> {
  return mockRequest(() => {
    const { reg, alt } = altOf(id, by)
    if (f.method.trim().length < 3 || f.evidence.trim().length < 5) throw new ServiceError('evidence', 'Say how it was verified and what evidence you reviewed.')
    alt.checklist[key] = { done: true, method: f.method.trim(), evidence: f.evidence.trim(), note: f.note?.trim() || undefined, by: by.id, at: new Date().toISOString() }
    if (alt.status !== 'scheduled' && alt.status !== 'in_person_required') alt.status = 'under_verification'
    if (key === 'in_person' && (alt.status === 'scheduled' || alt.status === 'in_person_required')) alt.status = 'under_verification'
    log(reg, by.id, `Checked: ${ALT_CHECKS.find((c) => c.key === key)!.label}`, `${f.method.trim()} · ${f.evidence.trim()}`)
    persist()
    audit(by, 'Recorded a verification finding', 'Residents', reg.referenceNo)
    return reg
  })
}

/** Ask the applicant for something specific, with how to send it and (optionally) by when. */
export async function altRequestMore(id: string, r: { items: string; explanation: string; instructions: string; deadline?: string }, by: User): Promise<ResidentRegistration> {
  const { reg, alt } = altOf(id, by)
  if (r.items.trim().length < 3 || r.explanation.trim().length < 5 || r.instructions.trim().length < 5) throw new ServiceError('request', 'Say exactly what is missing, why it is needed and how to send it.')
  const now = new Date().toISOString()
  alt.requests.push({ id: `rq-${Date.now().toString(36)}`, at: now, by: by.id, items: r.items.trim(), explanation: r.explanation.trim(), instructions: r.instructions.trim(), deadline: r.deadline || undefined })
  alt.status = 'needs_more'
  log(reg, by.id, 'Additional requirements requested', `${r.items.trim()}${r.deadline ? ` · by ${r.deadline}` : ''}`)
  persist()
  audit(by, 'Requested additional requirements', 'Residents', reg.referenceNo)
  await tellApplicant(reg, 'More information needed for your registration', `Please send: ${r.items.trim()}. Why: ${r.explanation.trim()} How: ${r.instructions.trim()}${r.deadline ? ` Please send it by ${r.deadline}.` : ''}`)
  return reg
}

/** Schedule (or move) the in-person identity verification. Shows on the officer's calendar; the applicant is told by e-mail and on the status page. */
export async function altSchedule(id: string, s: { date: string; time: string; staffId: string; instructions: string }, by: User): Promise<ResidentRegistration> {
  const { reg, alt } = altOf(id, by)
  const name = [reg.applicant.firstName, reg.applicant.lastName].join(' ')
  const appt = await scheduleIdentityVisit(reg.id, reg.referenceNo, name, s, by)
  const moved = !!alt.schedule
  alt.schedule = { date: s.date, time: s.time, location: `${BARANGAY_CONTACT.hall}, ${BARANGAY_CONTACT.address}`, staffId: s.staffId, instructions: s.instructions.trim(), appointmentId: appt.id, setBy: by.id, setAt: new Date().toISOString() }
  alt.status = 'scheduled'
  log(reg, by.id, moved ? 'In-person verification moved' : 'In-person verification scheduled', `${s.date} ${s.time} · ${mockUsers.find((u) => u.id === s.staffId)?.fullName ?? ''}`)
  persist()
  await tellApplicant(reg, moved ? 'Your verification visit was moved' : 'Your verification visit is scheduled', `Please come to the ${BARANGAY_CONTACT.hall} on ${s.date} at ${s.time}. ${s.instructions.trim()} Bring any documents you have.`)
  return reg
}

/** Mark verified: identity and residency must each be recorded first; method, evidence, date, personnel and remarks are kept. */
export async function altMarkVerified(id: string, d: { evidenceReviewed: string; remarks: string }, by: User): Promise<ResidentRegistration> {
  const { reg, alt } = altOf(id, by)
  if (!alt.checklist.identity?.done || !alt.checklist.residency?.done) throw new ServiceError('checks', 'Record how identity and residency were verified before marking this registration verified.')
  if (alt.inPersonRequested && !alt.checklist.in_person?.done) throw new ServiceError('checks', 'The applicant asked for in-person verification: record it first.')
  if (d.evidenceReviewed.trim().length < 5 || d.remarks.trim().length < 5) throw new ServiceError('remarks', 'Describe the evidence reviewed and your findings.')
  const now = new Date().toISOString()
  alt.decision = { result: 'verified', identityMethod: alt.checklist.identity.method, residencyMethod: alt.checklist.residency.method, evidenceReviewed: d.evidenceReviewed.trim(), date: now, by: by.id, remarks: d.remarks.trim() }
  alt.status = 'verified'
  log(reg, by.id, 'Verified (alternative verification)', d.remarks.trim())
  persist()
  audit(by, 'Alternative verification completed', 'Residents', reg.referenceNo)
  await tellApplicant(reg, 'Your identity was verified', 'Your registration will now be approved by the Barangay Secretary. You will be told when you can sign in.')
  return reg
}

/** Reject with a legitimate reason (never for lacking a government ID). The applicant may register again or ask for reconsideration. */
export async function altReject(id: string, d: { reason: (typeof ALT_REJECT_REASONS)[number]; remarks: string }, by: User): Promise<ResidentRegistration> {
  const { reg, alt } = altOf(id, by)
  if (!(ROLE_PERMISSIONS[by.roleId]?.includes('residents.reject') || by.extraPermissions?.includes('residents.reject'))) throw new ServiceError('forbidden', 'You cannot reject registrations.')
  if (!ALT_REJECT_REASONS.includes(d.reason)) throw new ServiceError('reason', 'Choose the reason for rejecting.')
  if (d.remarks.trim().length < 10) throw new ServiceError('remarks', 'Describe what was found (at least 10 characters).')
  const now = new Date().toISOString()
  alt.decision = { result: 'rejected', evidenceReviewed: d.remarks.trim(), date: now, by: by.id, remarks: d.remarks.trim(), reasonCategory: d.reason }
  alt.status = 'rejected'
  reg.status = 'rejected'; reg.decidedBy = by.id; reg.decidedAt = now; reg.decisionNote = `${d.reason}. ${d.remarks.trim()}`
  log(reg, by.id, 'Rejected', reg.decisionNote)
  persist()
  audit(by, 'Registration rejected (alternative verification)', 'Residents', reg.referenceNo)
  await tellApplicant(reg, 'Your registration was not approved', `Reason: ${reg.decisionNote} If something was incomplete or wrong, you can register again with corrected information or visit the ${BARANGAY_CONTACT.hall} to ask for reconsideration.`)
  return reg
}

/** Public status page: the applicant identifies the registration by reference number and birth date. Only their own registration's status is shown. */
const tries = new Map<string, number[]>()
function findOwn(ref: string, birthDate: string) {
  const key = ref.trim().toUpperCase()
  const now = Date.now()
  const recent = (tries.get(key) ?? []).filter((t) => now - t < 15 * 60_000)
  if (recent.length >= 5) throw new ServiceError('limit', 'Too many tries. Please wait 15 minutes, or call the Barangay Hall.')
  const reg = mockRegistrations.find((r) => r.referenceNo.toUpperCase() === key && r.applicant.birthDate === birthDate)
  if (!reg) { tries.set(key, [...recent, now]); throw new ServiceError('not_found', 'We could not find a registration with that reference number and birth date. Please check both and try again.') }
  return reg
}
export interface RegistrationStatusView {
  referenceNo: string; name: string; submittedAt: string; status: string; approved: boolean; rejected: boolean; reason?: string
  alt?: { status: AltStatus; label: string; requests: AltVerification['requests']; schedule?: { date: string; time: string; location: string; instructions: string } }
  visit?: { reason: string; bring: string; date?: string; time?: string }
}
export function lookupRegistration(ref: string, birthDate: string): Promise<RegistrationStatusView> {
  return mockRequest(() => {
    const r = findOwn(ref, birthDate)
    return {
      referenceNo: r.referenceNo, name: r.applicant.firstName, submittedAt: r.submittedAt,
      status: r.status === 'manual_review' ? (r.alt ? ALT_STATUS_LABEL[r.alt.status] : 'Being reviewed') : r.status === 'rejected' ? 'Not approved' : 'Approved',
      approved: r.status === 'approved' || r.status === 'auto_approved', rejected: r.status === 'rejected', reason: r.status === 'rejected' ? r.decisionNote : undefined,
      alt: r.alt ? { status: r.alt.status, label: ALT_STATUS_LABEL[r.alt.status], requests: r.alt.requests, schedule: r.alt.schedule && { date: r.alt.schedule.date, time: r.alt.schedule.time, location: r.alt.schedule.location, instructions: r.alt.schedule.instructions } } : undefined,
      visit: r.inPerson && !r.inPerson.completedAt ? { reason: r.inPerson.reason, bring: r.inPerson.bring, date: r.inPerson.date, time: r.inPerson.time } : undefined,
    }
  })
}
/** The applicant answers a request: a note and any documents. Goes back to document review; the Secretary is notified. */
export function respondToRequest(ref: string, birthDate: string, requestId: string, note: string, docs: AltSubmission['documents']): Promise<RegistrationStatusView> {
  return mockRequest(() => {
    const reg = findOwn(ref, birthDate)
    const alt = reg.alt
    const rq = alt?.requests.find((x) => x.id === requestId)
    if (!alt || !rq) throw new ServiceError('not_found', 'This request was not found.')
    if (rq.response) throw new ServiceError('done', 'You already answered this request. The Barangay Secretary will review it.')
    if (alt.status === 'verified' || alt.status === 'rejected') throw new ServiceError('closed', 'Verification is already finished.')
    if (note.trim().length < 3 && !docs.length) throw new ServiceError('empty', 'Add a short note or a document.')
    for (const d of docs) if (!d.dataUrl || d.dataUrl.length > MAX_DOC_CHARS) throw new ServiceError('size', `"${d.fileName}" is too large. Please use a photo or PDF smaller than 1.5 MB.`)
    const now = new Date().toISOString()
    const added = docs.map((d, i) => ({ ...d, id: `doc-${Date.now().toString(36)}${i}`, submittedAt: now, inResponseTo: rq.id }))
    alt.documents.push(...added)
    rq.response = { at: now, note: note.trim(), documentIds: added.map((d) => d.id) }
    alt.status = 'document_review'
    log(reg, reg.accountUserId ?? 'applicant', 'Applicant sent the requested information', `${note.trim()}${added.length ? ` · ${added.length} document(s)` : ''}`)
    persist()
    notifyStaff(verifiers(), 'Applicant answered your request', `${reg.referenceNo}: ${rq.items}`, reg)
    return null
  }).then(() => lookupRegistration(ref, birthDate))
}

function newAlt(a: AltSubmission): AltVerification {
  const now = new Date().toISOString()
  const pol = verificationPolicy()
  const documents = a.documents.map((d, i) => ({ ...d, id: `doc-${Date.now().toString(36)}${i}`, submittedAt: now }))
  const needsVisit = a.inPersonRequested || pol.inPersonWhen === 'always' || (pol.inPersonWhen === 'no_documents' && a.noDocuments)
  return {
    status: documents.length ? 'document_review' : needsVisit ? 'in_person_required' : 'pending',
    documents, noDocuments: a.noDocuments,
    endorsement: a.endorsement && a.endorsement.name.trim() ? { ...a.endorsement, name: a.endorsement.name.trim(), relationship: a.endorsement.relationship.trim(), document: a.endorsement.document ? { ...a.endorsement.document, id: `doc-${Date.now().toString(36)}e`, category: 'Endorsement', submittedAt: now } : undefined } : undefined,
    inPersonRequested: a.inPersonRequested, checklist: {}, requests: [],
  }
}
const altSummary = (a: AltSubmission) => [a.documents.length ? `${a.documents.length} document(s): ${a.documents.map((d) => d.category).join(', ')}` : 'no documents', a.endorsement?.name.trim() ? `endorsed by ${a.endorsement.name.trim()}` : '', a.inPersonRequested ? 'in-person verification requested' : ''].filter(Boolean).join(' · ')
