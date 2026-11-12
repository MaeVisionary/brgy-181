import type { SeniorRecord } from '@/analytics/seniorTypes'
import { mockRegistrations, mockResidents } from '@/mocks/residents'
import { mockUsers } from '@/mocks/users'
import type { User } from '@/types/auth'
import type { CheckResult, RegistrationEvidence, Resident, ResidentRegistration } from '@/types/resident'
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
  evidence: Omit<RegistrationEvidence, 'reasons' | 'recordSource'>
  checks: { ocr: CheckResult; faceMatch: CheckResult; liveness: CheckResult }
  record: RecordMatch
  /** The registration draft's id: a retry with the same id returns the first result instead of a second registration. */
  clientRequestId?: string
}

/**
 * Server-side check of a registration (the same rules as the form). Returns
 * one message per field that needs correcting; empty when everything is valid.
 */
export function registrationErrors(input: Pick<RegistrationInput, 'applicant' | 'username' | 'password' | 'evidence'>): Errors {
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
  if (ocr !== 'passed') reasons.push('The name on the ID could not be read clearly or did not match the name entered.')
  if (input.evidence.faceSimilarity === undefined) reasons.push('No clear face was found on the ID photo or the selfie, so the faces could not be compared.')
  else if (faceMatch === 'failed') reasons.push('The selfie does not look like the photo on the ID.')
  else if (faceMatch === 'inconclusive') reasons.push('The face comparison was not certain.')
  if (liveness !== 'passed') reasons.push('The live selfie check was not completed (a photo was uploaded instead).')
  // One verified account per resident.
  if (record.residentId && mockUsers.some((u) => u.residentId === record.residentId && u.status === 'active')) {
    reasons.push('This resident already has an active online account.')
  }
  const auto = reasons.length === 0

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
    evidence: { ...input.evidence, recordSource: record.source, reasons },
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
    if (auto) linkResident(reg)
    try {
      persist()
    } catch (e) {
      mockUsers.splice(mockUsers.indexOf(user), 1)
      mockRegistrations.splice(mockRegistrations.indexOf(reg), 1)
      throw e
    }
    setCredential(userId, { hash, mustChange: false, updatedAt: new Date().toISOString() })
    audit(user, auto ? 'Registration auto-approved' : 'Registration submitted for manual verification', 'Residents', reg.referenceNo)
    remember(onceKey, reg.id)
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
    reg.status = decision
    reg.decidedBy = by.id
    reg.decidedAt = new Date().toISOString()
    reg.decisionNote = note.trim() || undefined
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
    persist()
    audit(by, 'In-person verification completed', 'Residents', reg.referenceNo)
    return reg
  })
}
