import { EDITABLE_ROLES, GRANTABLE_ROLES, GRANTABLE_STAFF_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_LABELS, ROLES, ROLE_PERMISSIONS, writeRolePermissions } from '@/config/permissions'
import { mockUsers, rememberAccount } from '@/mocks/users'
import type { Permission, RoleId, User } from '@/types/auth'
import { audit } from './auditService'
import { sendResetLinkFor } from './passwordResetService'
import { ServiceError, mockRequest } from './mockApi'
import { consumeChallenge } from './stepUp'
import { mockNotifications } from '@/mocks/notifications'
import { personnelNumber } from '@/lib/ids'

/** Account administration (FR3). Simulated in memory; the backend must enforce it. */

const requireAdmin = (by: User) => {
  if (by.roleId !== 'system_admin') throw new ServiceError('forbidden', 'Only the System Administrator can manage accounts.')
}

export function listUsers(): Promise<User[]> {
  return mockRequest(() => mockUsers)
}

export function setStatus(id: string, status: 'active' | 'inactive', by: User): Promise<User> {
  return mockRequest(() => {
    requireAdmin(by)
    const u = mockUsers.find((x) => x.id === id)
    if (!u) throw new ServiceError('not_found', 'Account not found.')
    if (u.id === by.id) throw new ServiceError('self', 'You cannot deactivate your own account.')
    u.status = status
    rememberAccount(u)
    audit(by, status === 'active' ? 'Activated account' : 'Deactivated account', 'User accounts', u.username)
    return u
  })
}

/** Only positions without a documented name (Property Custodian, administrator, personnel) are renamable. */
export function setDisplayName(id: string, fullName: string, by: User): Promise<User> {
  return mockRequest(() => {
    requireAdmin(by)
    const u = mockUsers.find((x) => x.id === id)
    if (!u) throw new ServiceError('not_found', 'Account not found.')
    if (!['property_custodian', 'system_admin', 'staff'].includes(u.roleId)) throw new ServiceError('official', 'Officials\' names come from the barangay records and are not edited here.')
    if (!fullName.trim()) throw new ServiceError('invalid', 'Enter a name.')
    u.fullName = fullName.trim()
    rememberAccount(u)
    audit(by, 'Updated account name', 'User accounts', u.username)
    return u
  })
}

function notifyAccounts(userIds: string[], title: string, body: string, link = '/account') {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds)) mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category: 'system', title, body, createdAt: now, read: false, link })
  window.dispatchEvent(new Event('bmis:notifications-changed'))
}

const needReason = (reason: string) => {
  if (reason.trim().length < 5) throw new ServiceError('reason', 'Give the reason for this change.')
}

/** Roles a new Barangay Personnel account can be created for. Residents get accounts by registering. */
export const CREATABLE_ROLES: RoleId[] = ['kagawad', 'property_custodian']

export interface NewPersonnelAccount { fullName: string; username: string; email: string; contactNo?: string; roleId: RoleId; officialId?: string }

/** Field-by-field problems (empty object when the input is valid). Same rules on screen and here. */
export function newAccountErrors(i: NewPersonnelAccount): Partial<Record<keyof NewPersonnelAccount, string>> {
  const e: Partial<Record<keyof NewPersonnelAccount, string>> = {}
  const taken = (v: string) => mockUsers.some((u) => u.username.toLowerCase() === v || u.email.toLowerCase() === v)
  if (!i.fullName.trim()) e.fullName = 'Please enter the full name.'
  const un = i.username.trim().toLowerCase()
  if (!un) e.username = 'Please enter a username.'
  else if (!/^[a-z0-9._-]{4,30}$/.test(un)) e.username = 'Use 4 to 30 letters, numbers, dots, dashes or underscores, with no spaces.'
  else if (taken(un)) e.username = 'This username is already used by another account.'
  const em = i.email.trim().toLowerCase()
  if (!em) e.email = 'Please enter an email address.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) e.email = 'Please enter a valid email address, for example name@example.com.'
  else if (taken(em)) e.email = 'This email address is already used by another account.'
  if (i.contactNo && !/^09\d{9}$/.test(i.contactNo.replace(/[\s-]/g, ''))) e.contactNo = 'Please enter an 11-digit mobile number starting with 09, or leave it empty.'
  if (!CREATABLE_ROLES.includes(i.roleId)) e.roleId = 'Choose a position.'
  return e
}

/** Creates a Barangay Personnel account. No password is set: the person gets a single-use setup link by e-mail. */
export async function createPersonnelAccount(i: NewPersonnelAccount, by: User): Promise<{ user: User }> {
  requireAdmin(by)
  const errs = newAccountErrors(i)
  if (Object.keys(errs).length) throw new ServiceError('invalid', Object.values(errs)[0]!)
  const id = `usr-${Date.now().toString(36)}`
  const created = await mockRequest(() => {
    const seq = mockUsers.map((u) => Number(u.accountNo?.match(/^EMP-181-(\d+)$/)?.[1] ?? 0)).reduce((a, b) => Math.max(a, b), 0) + 1
    const user: User = {
      id, username: i.username.trim().toLowerCase(), fullName: i.fullName.trim(), position: ROLES[i.roleId].name, roleId: i.roleId, email: i.email.trim().toLowerCase(),
      status: 'active', accountNo: personnelNumber(seq), createdAt: new Date().toISOString(), contactNo: i.contactNo?.replace(/[\s-]/g, '') || undefined,
    }
    mockUsers.push(user)
    rememberAccount(user, true)
    audit(by, 'Created account', 'User accounts', `${user.username} · ${ROLES[user.roleId].name}`)
    return user
  })
  await sendResetLinkFor(created.id, by, 'setup')
  return { user: created }
}

/** Personnel positions the administrator may assign (elected officials keep their role). */
export const ASSIGNABLE_ROLES: RoleId[] = ['property_custodian']

// ── Two-person approval for access changes ───────────────────────────
//
// Every role or permission change is a REQUEST: the initiating administrator
// confirms it (reason + password), then a second person approves it with
// their own confirmation before anything changes. Policy (not editable here):
// the approver is another System Administrator or the Barangay Chairman, never
// the initiator and never the account being changed. Requests expire after
// 24 hours. All steps are audited and both sides are notified.
//
// PROTOTYPE LIMIT: enforced in this service only. The same rules are written
// for the database in docs/supabase/security.sql (not yet connected).

export type ChangeKind = 'role-permissions' | 'account-role' | 'account-permissions'
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'

export interface AccessRequest {
  id: string
  ref: string
  kind: ChangeKind
  payload: { changes?: RoleChange[]; id?: string; roleId?: RoleId; perms?: Permission[] }
  /** Human-readable before/after rows, captured when requested. */
  rows: [string, boolean | string, boolean | string][]
  /** Account(s) whose access changes. */
  affectedUserIds: string[]
  title: string
  reason: string
  initiatorId: string
  createdAt: string
  expiresAt: string
  status: RequestStatus
  decidedBy?: string
  decidedAt?: string
  decisionReason?: string
}

const REQ_KEY = 'bmis.accessRequests'
const REQUEST_TTL_MS = 24 * 3600_000
const readRequests = (): AccessRequest[] => {
  try {
    return JSON.parse(localStorage.getItem(REQ_KEY) ?? '[]') as AccessRequest[]
  } catch {
    return []
  }
}
const writeRequests = (list: AccessRequest[]) => localStorage.setItem(REQ_KEY, JSON.stringify(list))

/** Who may act as the second person (policy). */
export const canApproveAccess = (u: User) => u.status === 'active' && (u.roleId === 'system_admin' || u.roleId === 'chairman')
/**
 * DEMO DATA ONLY (src/demo/seedDemo.ts): files an access-change REQUEST without the
 * initiator's password step, so the approval queue has an example. Nothing changes
 * until a second person approves it with their own password.
 */
export function demoAccessRequest(userId: string, perms: Permission[], reason: string, by: User): AccessRequest {
  const u = mockUsers.find((x) => x.id === userId)
  if (!u || !GRANTABLE_ROLES.includes(u.roleId)) throw new ServiceError('invalid', 'Not a grantable account.')
  const before = u.extraPermissions ?? []
  const next = [...new Set([...before, ...perms])].filter((p) => GRANTABLE_STAFF_PERMISSIONS.includes(p)).sort()
  const rows: AccessRequest['rows'] = GRANTABLE_STAFF_PERMISSIONS.filter((p) => before.includes(p) !== next.includes(p)).map((p) => [PERMISSION_LABELS[p], before.includes(p), next.includes(p)])
  return createRequest('account-permissions', { id: userId, perms: next }, rows, [u.id], `Access for ${u.fullName}`, reason, by)
}

const approvers = (except: string[]) => mockUsers.filter((u) => canApproveAccess(u) && !except.includes(u.id)).map((u) => u.id)

function expireStale(list: AccessRequest[]): AccessRequest[] {
  const now = Date.now()
  let changed = false
  for (const r of list) {
    if (r.status === 'pending' && new Date(r.expiresAt).getTime() < now) {
      r.status = 'expired'
      r.decidedAt = new Date().toISOString()
      changed = true
      notifyAccounts([r.initiatorId], 'Access request expired', `${r.ref} · ${r.title}. Nothing was changed.`, '/admin/security')
    }
  }
  if (changed) writeRequests(list)
  return list
}

export function listAccessRequests(by: User): Promise<AccessRequest[]> {
  return mockRequest(() => {
    if (by.roleId !== 'system_admin' && !canApproveAccess(by)) throw new ServiceError('forbidden', 'Not allowed.')
    return expireStale(readRequests()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })
}

function createRequest(kind: ChangeKind, payload: AccessRequest['payload'], rows: AccessRequest['rows'], affected: string[], title: string, reason: string, by: User): AccessRequest {
  const list = expireStale(readRequests())
  // One open request per subject at a time, so approvals cannot be raced.
  const subject = kind === 'role-permissions' ? 'roles' : payload.id
  if (list.some((r) => r.status === 'pending' && (r.kind === 'role-permissions' ? 'roles' : r.payload.id) === subject)) throw new ServiceError('pending', 'There is already a pending request for this. Approve, reject or cancel it first.')
  const now = new Date()
  const req: AccessRequest = {
    id: `acc-${now.getTime().toString(36)}`,
    ref: `SEC-${now.getFullYear()}-${String(list.length + 1).padStart(4, '0')}`,
    kind,
    payload,
    rows,
    affectedUserIds: affected,
    title,
    reason: reason.trim(),
    initiatorId: by.id,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + REQUEST_TTL_MS).toISOString(),
    status: 'pending',
  }
  writeRequests([...list, req])
  audit(by, `Access change requested ${req.ref}`, 'Security', `${title} · reason: ${req.reason}`)
  const to = approvers([by.id, ...affected])
  if (!to.length) audit(by, `No second approver available for ${req.ref}`, 'Security', undefined, 'failure')
  notifyAccounts(to, 'Access change needs your approval', `${req.ref} · ${title}`, '/admin/security')
  return req
}

export function setExtraPermissions(id: string, perms: Permission[], by: User, reason: string, challengeId: string | undefined): Promise<AccessRequest> {
  return mockRequest(() => {
    requireAdmin(by)
    const u = mockUsers.find((x) => x.id === id)
    if (!u) throw new ServiceError('not_found', 'Account not found.')
    if (u.id === by.id) throw new ServiceError('self', 'You cannot change your own access.')
    if (!GRANTABLE_ROLES.includes(u.roleId)) throw new ServiceError('invalid', 'Permissions are set per role for this account.')
    needReason(reason)
    const next = perms.filter((p) => GRANTABLE_STAFF_PERMISSIONS.includes(p)).sort()
    consumeChallenge(challengeId, by, 'account-permissions', { id, perms: next })
    const before = u.extraPermissions ?? []
    const rows: AccessRequest['rows'] = GRANTABLE_STAFF_PERMISSIONS.filter((p) => before.includes(p) !== next.includes(p)).map((p) => [PERMISSION_LABELS[p], before.includes(p), next.includes(p)])
    if (!rows.length) throw new ServiceError('empty', 'Nothing to change.')
    return createRequest('account-permissions', { id, perms: next }, rows, [u.id], `Access for ${u.fullName}`, reason, by)
  })
}

export function setRole(id: string, roleId: RoleId, by: User, reason: string, challengeId: string | undefined): Promise<AccessRequest> {
  return mockRequest(() => {
    requireAdmin(by)
    const u = mockUsers.find((x) => x.id === id)
    if (!u) throw new ServiceError('not_found', 'Account not found.')
    if (u.id === by.id) throw new ServiceError('self', 'You cannot change your own role.')
    if (!ASSIGNABLE_ROLES.includes(u.roleId) || !ASSIGNABLE_ROLES.includes(roleId)) throw new ServiceError('official', 'Only personnel positions can be reassigned here.')
    if (u.roleId === roleId) throw new ServiceError('empty', 'Nothing to change.')
    needReason(reason)
    consumeChallenge(challengeId, by, 'account-role', { id, roleId })
    return createRequest('account-role', { id, roleId }, [['Role', ROLES[u.roleId].name, ROLES[roleId].name]], [u.id], `Role for ${u.fullName}`, reason, by)
  })
}

export interface RoleChange {
  roleId: RoleId
  permission: Permission
  on: boolean
}

export function setRolePermissions(changes: RoleChange[], reason: string, challengeId: string | undefined, by: User): Promise<AccessRequest> {
  return mockRequest(() => {
    requireAdmin(by)
    if (!changes.length) throw new ServiceError('empty', 'Nothing to change.')
    for (const c of changes) {
      if (!EDITABLE_ROLES.includes(c.roleId)) throw new ServiceError('locked', 'This role cannot be changed here.')
      if (!PERMISSION_GROUPS.some((g) => g.permissions.includes(c.permission))) throw new ServiceError('locked', 'This permission cannot be changed here.')
    }
    needReason(reason)
    consumeChallenge(challengeId, by, 'role-permissions', { changes })
    const roles = [...new Set(changes.map((c) => c.roleId))]
    const affected = mockUsers.filter((u) => roles.includes(u.roleId) && u.status === 'active').map((u) => u.id)
    const rows: AccessRequest['rows'] = changes.map((c) => [`${ROLES[c.roleId].name}: ${PERMISSION_LABELS[c.permission]}`, !c.on, c.on])
    return createRequest('role-permissions', { changes }, rows, affected, `Permissions for ${roles.map((r) => ROLES[r].name).join(', ')}`, reason, by)
  })
}

function apply(r: AccessRequest) {
  if (r.kind === 'role-permissions') {
    const byRole = new Map<RoleId, RoleChange[]>()
    for (const c of r.payload.changes!) byRole.set(c.roleId, [...(byRole.get(c.roleId) ?? []), c])
    for (const [roleId, list] of byRole) {
      const current = new Set(ROLE_PERMISSIONS[roleId])
      for (const c of list) (c.on ? current.add(c.permission) : current.delete(c.permission))
      writeRolePermissions(roleId, [...current])
    }
  } else {
    const u = mockUsers.find((x) => x.id === r.payload.id)
    if (!u) throw new ServiceError('not_found', 'Account not found.')
    if (r.kind === 'account-role') u.roleId = r.payload.roleId!
    else u.extraPermissions = r.payload.perms!
    rememberAccount(u)
  }
}

/** Second person approves (confirmed with their own password); only then is the change applied. */
export function approveAccessRequest(id: string, challengeId: string | undefined, by: User): Promise<AccessRequest> {
  return mockRequest(() => {
    const list = expireStale(readRequests())
    const r = list.find((x) => x.id === id)
    if (!r) throw new ServiceError('not_found', 'Request not found.')
    if (!canApproveAccess(by)) { audit(by, `Unauthorized approval attempt ${r.ref}`, 'Security', undefined, 'failure'); throw new ServiceError('forbidden', 'You cannot approve access changes.') }
    if (r.initiatorId === by.id) { audit(by, `Self-approval blocked ${r.ref}`, 'Security', undefined, 'failure'); throw new ServiceError('self', 'You cannot approve your own request.') }
    if (r.affectedUserIds.includes(by.id)) { audit(by, `Approval of own access blocked ${r.ref}`, 'Security', undefined, 'failure'); throw new ServiceError('self', 'You cannot approve a change to your own access.') }
    if (r.status !== 'pending') throw new ServiceError('closed', r.status === 'expired' ? 'This request expired. Nothing was changed.' : 'This request was already decided.')
    consumeChallenge(challengeId, by, 'approve-access', { id })
    // Apply and record together; on failure the request stays pending and nothing is half-applied.
    const snapshot = JSON.stringify({ roles: ROLE_PERMISSIONS, users: mockUsers.map((u) => [u.id, u.roleId, u.extraPermissions]) })
    try {
      apply(r)
      r.status = 'approved'
      r.decidedBy = by.id
      r.decidedAt = new Date().toISOString()
      writeRequests(list)
    } catch (e) {
      const s = JSON.parse(snapshot) as { roles: Record<RoleId, Permission[]>; users: [string, RoleId, Permission[] | undefined][] }
      for (const roleId of EDITABLE_ROLES) writeRolePermissions(roleId, s.roles[roleId])
      for (const [uid, roleId, extra] of s.users) { const u = mockUsers.find((x) => x.id === uid); if (u) { u.roleId = roleId; u.extraPermissions = extra } }
      throw e
    }
    const initiator = mockUsers.find((u) => u.id === r.initiatorId)?.fullName ?? 'an administrator'
    audit(by, `Access change approved ${r.ref}`, 'Security', `${r.title} · requested by ${initiator}`)
    notifyAccounts([r.initiatorId], 'Access change approved', `${r.ref} · ${r.title} · approved by ${by.fullName}.`, '/admin/security')
    notifyAccounts(r.affectedUserIds, 'Your account access was updated', `${r.title}. Requested by ${initiator}, approved by ${by.fullName}. Sign in again if menus look out of date. Contact the Barangay Hall if you did not expect this.`, '/account')
    notifyAccounts(approvers([by.id, r.initiatorId, ...r.affectedUserIds]), 'Access request closed', `${r.ref} was approved by ${by.fullName}.`, '/admin/security')
    return r
  })
}

export function rejectAccessRequest(id: string, reason: string, by: User): Promise<AccessRequest> {
  return mockRequest(() => {
    const list = expireStale(readRequests())
    const r = list.find((x) => x.id === id)
    if (!r) throw new ServiceError('not_found', 'Request not found.')
    if (!canApproveAccess(by) || r.initiatorId === by.id) throw new ServiceError('forbidden', 'You cannot decide this request.')
    if (r.status !== 'pending') throw new ServiceError('closed', 'This request is no longer pending.')
    needReason(reason)
    r.status = 'rejected'
    r.decidedBy = by.id
    r.decidedAt = new Date().toISOString()
    r.decisionReason = reason.trim()
    writeRequests(list)
    audit(by, `Access change rejected ${r.ref}`, 'Security', reason.trim())
    notifyAccounts([r.initiatorId], 'Access change rejected', `${r.ref} · ${reason.trim()}`, '/admin/security')
    return r
  })
}

export function cancelAccessRequest(id: string, by: User): Promise<AccessRequest> {
  return mockRequest(() => {
    const list = expireStale(readRequests())
    const r = list.find((x) => x.id === id)
    if (!r) throw new ServiceError('not_found', 'Request not found.')
    if (r.initiatorId !== by.id) throw new ServiceError('forbidden', 'Only the person who asked can cancel.')
    if (r.status !== 'pending') throw new ServiceError('closed', 'This request is no longer pending.')
    r.status = 'cancelled'
    r.decidedAt = new Date().toISOString()
    writeRequests(list)
    audit(by, `Access change cancelled ${r.ref}`, 'Security')
    notifyAccounts(approvers([by.id]), 'Access request cancelled', `${r.ref} was cancelled.`, '/admin/security')
    return r
  })
}
