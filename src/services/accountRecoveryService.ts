import { ROLE_PERMISSIONS } from '@/config/permissions'
import { mockNotifications } from '@/mocks/notifications'
import { mockUsers, rememberAccount } from '@/mocks/users'
import type { RoleId, User } from '@/types/auth'
import { audit } from './auditService'
import { sendEmail } from './emailService'
import { ServiceError, mockRequest } from './mockApi'
import { issueResetLink } from './passwordResetService'

/**
 * ACCOUNT RECOVERY when the registered e-mail cannot be used.
 *
 * Who reviews (never the account holder themself):
 * - Resident accounts: the Barangay Secretary (residents.verify), using the
 *   barangay's identity verification procedure and the registration record.
 * - Barangay Personnel (Secretary, Punong Barangay, Kagawad, Property
 *   Custodian): the System Administrator (users.manage).
 * - System Administrator accounts: the Punong Barangay (security.approve), as
 *   the independent second person; an administrator can never handle their own.
 *
 * Approval never shows or sets a password: it sends a single-use reset link to
 * the contact the reviewer verified. The registered e-mail is not replaced by
 * the request itself. Every step is logged; answers to the requester never say
 * whether an account matched.
 */

export type RecoveryStatus = 'pending_review' | 'more_info' | 'in_person' | 'approved' | 'rejected' | 'completed'
export const RECOVERY_STATUS_LABEL: Record<RecoveryStatus, string> = {
  pending_review: 'Pending review',
  more_info: 'Additional verification required',
  in_person: 'In-person verification required',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
}
export type ReviewerRole = 'secretary' | 'system_admin' | 'chairman'
export const REVIEWER_LABEL: Record<ReviewerRole, string> = { secretary: 'Barangay Secretary', system_admin: 'System Administrator', chairman: 'Punong Barangay' }

export interface RecoveryRequest {
  id: string
  ref: string
  createdAt: string
  accountType: 'resident' | 'personnel'
  fullName: string
  identifier: string
  accountNo?: string
  reason: string
  newEmail?: string
  newMobile?: string
  /** Internal: the account it matched (never shown to the requester). */
  matchedUserId?: string
  reviewer: ReviewerRole
  status: RecoveryStatus
  findings: { at: string; by: string; text: string }[]
  infoRequest?: { at: string; by: string; text: string }
  inPerson?: { date: string; time: string; place: string; by: string }
  decision?: { at: string; by: string; result: 'approved' | 'rejected'; reason: string; sentTo?: string }
  completedAt?: string
  history: { at: string; by: string; action: string }[]
}

const KEY = 'bmis.recoveryRequests'
const RATE = 'bmis.recoveryRate'
const read = (): RecoveryRequest[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } }
const save = (l: RecoveryRequest[]) => { try { localStorage.setItem(KEY, JSON.stringify(l)) } catch { /* storage unavailable */ } }
const can = (u: User, p: string) => !!((ROLE_PERMISSIONS[u.roleId] as readonly string[] | undefined)?.includes(p) || u.extraPermissions?.includes(p as never))

/** Which reviewer role handles this account. */
const reviewerFor = (role: RoleId | undefined, type: 'resident' | 'personnel'): ReviewerRole => (role === 'system_admin' ? 'chairman' : type === 'resident' && (!role || role === 'resident') ? 'secretary' : 'system_admin')
const isReviewer = (u: User, r: ReviewerRole) => (r === 'secretary' ? can(u, 'residents.verify') && u.roleId === 'secretary' : r === 'system_admin' ? can(u, 'users.manage') : u.roleId === 'chairman' && can(u, 'security.approve'))
export const canReviewRecovery = (u: User) => (['secretary', 'system_admin', 'chairman'] as ReviewerRole[]).some((r) => isReviewer(u, r))
const notify = (ids: string[], title: string, body: string, link?: string) => {
  const now = new Date().toISOString()
  for (const userId of new Set(ids)) mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category: 'system', title, body, createdAt: now, read: false, link })
}
const reviewersOf = (r: ReviewerRole, except?: string) => mockUsers.filter((u) => u.status === 'active' && u.id !== except && isReviewer(u, r)).map((u) => u.id)
/** Contact for messages about the request: the new e-mail given, else the registered one (never revealed in the answer). */
const contactOf = (q: RecoveryRequest) => q.newEmail || mockUsers.find((u) => u.id === q.matchedUserId)?.email

export interface RecoveryInput { accountType: 'resident' | 'personnel'; fullName: string; identifier: string; accountNo?: string; reason: string; newEmail?: string; newMobile?: string }
export function recoveryErrors(i: Partial<RecoveryInput>): Record<string, string> {
  const e: Record<string, string> = {}
  if (!i.accountType) e.accountType = 'Please choose your account type.'
  if (!i.fullName || i.fullName.trim().length < 4) e.fullName = 'Please enter your full name.'
  if (!i.identifier || i.identifier.trim().length < 4) e.identifier = 'Please enter your username or the e-mail you registered with.'
  if (!i.reason || i.reason.trim().length < 15) e.reason = 'Please tell us briefly why you cannot use your e-mail (at least 15 characters).'
  if (i.newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.newEmail.trim())) e.newEmail = 'Please enter a valid email address, or leave it empty.'
  if (i.newMobile && !/^09\d{9}$/.test(i.newMobile.replace(/[\s-]/g, ''))) e.newMobile = 'Please enter an 11-digit mobile number starting with 09, or leave it empty.'
  if (!i.newEmail?.trim() && !i.newMobile?.trim()) e.newEmail = 'Please give a new e-mail or mobile number we can reach you on.'
  return e
}

/** Submit a recovery request. The answer is the same whether or not an account matched. */
export function submitRecovery(i: RecoveryInput): Promise<{ ref: string }> {
  return mockRequest(() => {
    const errs = recoveryErrors(i)
    if (Object.keys(errs).length) throw new ServiceError('invalid', Object.values(errs)[0])
    const now = Date.now()
    const rate = (JSON.parse(localStorage.getItem(RATE) ?? '[]') as number[]).filter((t) => now - t < 60 * 60_000)
    if (rate.length >= 3) throw new ServiceError('limit', 'Too many requests from this device. Please wait an hour, or visit the Barangay Hall.')
    localStorage.setItem(RATE, JSON.stringify([...rate, now]))
    const id = i.identifier.trim().toLowerCase()
    const u = mockUsers.find((x) => x.username.toLowerCase() === id || x.email.toLowerCase() === id)
    // A resident request cannot reach a personnel account (and vice versa): it is routed by the account found.
    const type = u && u.roleId !== 'resident' ? 'personnel' : i.accountType
    const list = read()
    const at = new Date().toISOString()
    const q: RecoveryRequest = {
      id: `acr-${now.toString(36)}`, ref: `ACR-${new Date().getFullYear()}-${String(list.length + 1).padStart(4, '0')}`, createdAt: at,
      accountType: type, fullName: i.fullName.trim(), identifier: id, accountNo: i.accountNo?.trim().toUpperCase() || undefined, reason: i.reason.trim(),
      newEmail: i.newEmail?.trim().toLowerCase() || undefined, newMobile: i.newMobile?.replace(/[\s-]/g, '') || undefined,
      matchedUserId: u?.id, reviewer: reviewerFor(u?.roleId, type), status: 'pending_review', findings: [], history: [{ at, by: 'requester', action: 'Recovery request submitted' }],
    }
    save([...list, q])
    notify(reviewersOf(q.reviewer, u?.id), 'Account recovery request', `${q.ref}: ${q.fullName} (${q.accountType === 'resident' ? 'resident' : 'Barangay Personnel'})`, `/account-recovery/${q.id}`)
    return { ref: q.ref }
  })
}

export function listRecovery(by: User): Promise<RecoveryRequest[]> {
  return mockRequest(() => read().filter((q) => isReviewer(by, q.reviewer) && q.matchedUserId !== by.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
}
function own(id: string, by: User) {
  const list = read()
  const q = list.find((x) => x.id === id)
  if (!q || !isReviewer(by, q.reviewer)) throw new ServiceError('not_found', 'Request not found.')
  if (q.matchedUserId === by.id) throw new ServiceError('self', 'You cannot review a recovery request for your own account.')
  return { list, q }
}
export function getRecovery(id: string, by: User): Promise<RecoveryRequest & { account?: { name: string; role: string; accountNo?: string; registeredEmail: string } }> {
  return mockRequest(() => {
    const { q } = own(id, by)
    const u = mockUsers.find((x) => x.id === q.matchedUserId)
    audit(by, 'Opened account recovery request', 'Security', q.ref)
    return { ...q, account: u ? { name: u.fullName, role: u.position, accountNo: u.accountNo, registeredEmail: u.email } : undefined }
  })
}
const step = (id: string, by: User, fn: (q: RecoveryRequest) => string) => mockRequest(() => {
  const { list, q } = own(id, by)
  if (q.status === 'rejected' || q.status === 'completed') throw new ServiceError('closed', 'This request is closed.')
  const action = fn(q)
  q.history.push({ at: new Date().toISOString(), by: by.id, action })
  save(list)
  audit(by, `${action} (${q.ref})`, 'Security')
  return q
})

/** Record what was checked (identity, registration record, documents). */
export const recordRecoveryFinding = (id: string, text: string, by: User) => step(id, by, (q) => {
  if (text.trim().length < 10) throw new ServiceError('text', 'Describe what you checked (at least 10 characters).')
  q.findings.push({ at: new Date().toISOString(), by: by.id, text: text.trim() })
  return 'Verification finding recorded'
})
/** Ask for more information (sent to the contact the requester gave). */
export const requestRecoveryInfo = (id: string, text: string, by: User) => step(id, by, (q) => {
  if (text.trim().length < 10) throw new ServiceError('text', 'Say exactly what is missing.')
  q.infoRequest = { at: new Date().toISOString(), by: by.id, text: text.trim() }
  q.status = 'more_info'
  const to = contactOf(q)
  if (to) void sendEmail({ to, subject: `More information needed (${q.ref})`, body: `To recover your account we need: ${text.trim()}\n\nReply at the Barangay Hall or bring it in person, with your reference ${q.ref}.\n\nBarangay 181`, ref: q.ref })
  return 'Additional verification requested'
})
/** Require a visit to the Barangay Hall, with the date and time. */
export const scheduleRecoveryVisit = (id: string, v: { date: string; time: string }, by: User) => step(id, by, (q) => {
  if (!v.date || !v.time) throw new ServiceError('when', 'Choose the date and time.')
  q.inPerson = { date: v.date, time: v.time, place: 'Barangay 181 Hall', by: by.id }
  q.status = 'in_person'
  const to = contactOf(q)
  if (to) void sendEmail({ to, subject: `Please visit the Barangay Hall (${q.ref})`, body: `Please come on ${v.date} at ${v.time} with a valid ID (or the documents you used to register) and your reference ${q.ref}.\n\nBarangay 181`, ref: q.ref })
  return `In-person verification set for ${v.date} ${v.time}`
})
/** Reject with a reason (the requester is told, without account details). */
export const rejectRecovery = (id: string, reason: string, by: User) => step(id, by, (q) => {
  if (reason.trim().length < 10) throw new ServiceError('reason', 'Give the reason (at least 10 characters).')
  q.status = 'rejected'
  q.decision = { at: new Date().toISOString(), by: by.id, result: 'rejected', reason: reason.trim() }
  const to = q.newEmail
  if (to) void sendEmail({ to, subject: `Account recovery request ${q.ref}`, body: `We could not complete your account recovery: ${reason.trim()}\n\nYou can visit the Barangay Hall with a valid ID for help.\n\nBarangay 181`, ref: q.ref })
  return `Rejected: ${reason.trim()}`
})

/**
 * Approve and start the secure reset: a single-use link goes to the contact the
 * reviewer verified (the new e-mail only when the reviewer confirms it was checked).
 * Needs at least one recorded finding; never the account holder's own request.
 */
export async function approveRecovery(id: string, reason: string, sendTo: 'registered' | 'new', by: User, confirmedEmail?: string): Promise<RecoveryRequest> {
  const { q } = own(id, by)
  const given = confirmedEmail?.trim().toLowerCase()
  if (given && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(given)) throw new ServiceError('email', 'Please enter a valid email address, for example name@example.com.')
  if (given && mockUsers.some((x) => x.id !== q.matchedUserId && x.email.toLowerCase() === given)) throw new ServiceError('email', 'This e-mail address is already used by another account.')
  if (given) q.newEmail = given
  if (q.status === 'rejected' || q.status === 'completed' || q.status === 'approved') throw new ServiceError('closed', 'This request is already decided.')
  if (!q.findings.length) throw new ServiceError('findings', 'Record how the person\'s identity was verified before approving.')
  if (reason.trim().length < 10) throw new ServiceError('reason', 'Give the reason for approving (at least 10 characters).')
  const u = mockUsers.find((x) => x.id === q.matchedUserId)
  if (!u) throw new ServiceError('no_account', 'No account matches this request. Reject it with the reason, or help the person register.')
  // Stronger control for administrator accounts: identity must be checked in person, not only from documents sent in.
  if (u.roleId === 'system_admin' && !q.inPerson) throw new ServiceError('in_person', 'Administrator accounts need in-person verification first. Set the visit, check the person at the Hall, record the finding, then approve.')
  if (sendTo === 'new' && !q.newEmail) throw new ServiceError('no_email', 'The person gave no new e-mail address.')
  const to = sendTo === 'new' ? q.newEmail! : u.email
  if (given) { const l0 = read(); const r0 = l0.find((r) => r.id === q.id)!; r0.newEmail = given; r0.history.push({ at: new Date().toISOString(), by: by.id, action: 'New e-mail confirmed with the person by the reviewer' }); save(l0) }
  await issueResetLink({ credentialKey: u.id, userId: u.id, email: u.email, personnel: u.roleId !== 'resident', name: u.fullName }, 'recovery', { recoveryId: q.id, to })
  const list = read()
  const x = list.find((r) => r.id === q.id)!
  x.status = 'approved'
  x.decision = { at: new Date().toISOString(), by: by.id, result: 'approved', reason: reason.trim(), sentTo: sendTo === 'new' ? 'new e-mail (verified by the reviewer)' : 'registered e-mail' }
  x.history.push({ at: x.decision.at, by: by.id, action: `Approved; reset link sent to the ${x.decision.sentTo}` })
  save(list)
  audit(by, `Account recovery approved (${q.ref})`, 'Security', `reset link to ${x.decision.sentTo}`)
  notify([u.id], 'Account recovery approved', 'A password reset link was sent. It works once and expires in 15 minutes.', '/account')
  return x
}

/** Marks a request completed when its reset link is used (called from the reset page). */
export function completeRecovery(recoveryId: string) {
  const list = read()
  const q = list.find((r) => r.id === recoveryId)
  if (!q || q.status !== 'approved') return
  q.status = 'completed'
  q.completedAt = new Date().toISOString()
  q.history.push({ at: q.completedAt, by: 'system', action: 'New password set with the reset link' })
  // The person lost the old address: once the link sent to the verified new e-mail is used, that address becomes the account's e-mail.
  const u = mockUsers.find((x) => x.id === q.matchedUserId)
  if (u && q.newEmail && q.decision?.sentTo?.startsWith('new') && !mockUsers.some((x) => x.id !== u.id && x.email.toLowerCase() === q.newEmail)) {
    u.email = q.newEmail
    rememberAccount(u)
    q.history.push({ at: q.completedAt, by: 'system', action: 'Account e-mail changed to the verified new address' })
    audit(u, 'Account e-mail changed after recovery', 'Security', q.ref)
  }
  save(list)
}
if (typeof window !== 'undefined') window.addEventListener('bmis:recovery-completed', (e) => completeRecovery((e as CustomEvent<string>).detail))
