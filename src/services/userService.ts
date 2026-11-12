import { EDITABLE_ROLES, GRANTABLE_ROLES, GRANTABLE_STAFF_PERMISSIONS, PERMISSION_GROUPS, ROLES, ROLE_PERMISSIONS, writeRolePermissions } from '@/config/permissions'
import { mockUsers } from '@/mocks/users'
import type { Permission, RoleId, User } from '@/types/auth'
import { audit } from './auditService'
import { clearFailures, hashPassword, resolveResetRequests, setCredential, temporaryPassword } from './credentialStore'
import { ServiceError, mockRequest } from './mockApi'
import { consumeChallenge } from './stepUp'
import { mockNotifications } from '@/mocks/notifications'

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
    audit(by, 'Updated account name', 'User accounts', u.username)
    return u
  })
}

/**
 * Administrator password reset: issues a one-time temporary password, unlocks the
 * account and requires a new password at next sign-in. Returns the temporary password
 * so the administrator can hand it over; it is never stored in plain text.
 */
export async function resetPassword(target: { credentialKey: string; identifiers: string[]; label: string }, by: User): Promise<string> {
  requireAdmin(by)
  const temp = temporaryPassword()
  setCredential(target.credentialKey, { hash: await hashPassword(target.credentialKey, temp), mustChange: true, updatedAt: new Date().toISOString() })
  for (const id of target.identifiers) clearFailures(`login:${id.toLowerCase()}`)
  resolveResetRequests(target.identifiers)
  audit(by, 'Reset password', 'User accounts', target.label)
  return temp
}

function notifyAccounts(userIds: string[], title: string, body: string) {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds)) mockNotifications.push({ id: `ntf-${Math.random().toString(36).slice(2, 9)}`, userId, category: 'system', title, body, createdAt: now, read: false, link: '/account' })
  window.dispatchEvent(new Event('bmis:notifications-changed'))
}

const needReason = (reason: string) => {
  if (reason.trim().length < 5) throw new ServiceError('reason', 'Give the reason for this change.')
}

export function setExtraPermissions(id: string, perms: Permission[], by: User, reason: string, challengeId: string | undefined): Promise<User> {
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
    u.extraPermissions = next
    const added = next.filter((p) => !before.includes(p))
    const removed = before.filter((p) => !next.includes(p))
    audit(by, 'Changed account permissions', 'Roles and permissions', `${u.username}: +[${added.join(', ')}] -[${removed.join(', ')}] · reason: ${reason.trim()}`)
    notifyAccounts([u.id], 'Your account access was updated', `${added.length} added, ${removed.length} removed by the System Administrator. Contact the Barangay Hall if you did not expect this.`)
    return u
  })
}

/** Personnel positions the administrator may assign (elected officials keep their role). */
export const ASSIGNABLE_ROLES: RoleId[] = ['property_custodian', 'treasurer']

export function setRole(id: string, roleId: RoleId, by: User, reason: string, challengeId: string | undefined): Promise<User> {
  return mockRequest(() => {
    requireAdmin(by)
    const u = mockUsers.find((x) => x.id === id)
    if (!u) throw new ServiceError('not_found', 'Account not found.')
    if (u.id === by.id) throw new ServiceError('self', 'You cannot change your own role.')
    if (!ASSIGNABLE_ROLES.includes(u.roleId) || !ASSIGNABLE_ROLES.includes(roleId)) throw new ServiceError('official', 'Only personnel positions can be reassigned here.')
    if (u.roleId === roleId) return u
    needReason(reason)
    consumeChallenge(challengeId, by, 'account-role', { id, roleId })
    const before = u.roleId
    u.roleId = roleId
    audit(by, 'Changed account role', 'Roles and permissions', `${u.username}: ${ROLES[before].name} to ${ROLES[roleId].name} · reason: ${reason.trim()}`)
    notifyAccounts([u.id], 'Your role was changed', `${ROLES[before].name} → ${ROLES[roleId].name}, by the System Administrator. Contact the Barangay Hall if you did not expect this.`)
    return u
  })
}

export interface RoleChange {
  roleId: RoleId
  permission: Permission
  on: boolean
}

/** Applies a reviewed set of role permission changes (System Administrator, confirmed with password). */
export function setRolePermissions(changes: RoleChange[], reason: string, challengeId: string | undefined, by: User): Promise<void> {
  return mockRequest(() => {
    requireAdmin(by)
    if (!changes.length) throw new ServiceError('empty', 'Nothing to change.')
    for (const c of changes) {
      if (!EDITABLE_ROLES.includes(c.roleId)) throw new ServiceError('locked', 'This role cannot be changed here.')
      if (!PERMISSION_GROUPS.some((g) => g.permissions.includes(c.permission))) throw new ServiceError('locked', 'This permission cannot be changed here.')
    }
    needReason(reason)
    consumeChallenge(challengeId, by, 'role-permissions', { changes })
    const byRole = new Map<RoleId, RoleChange[]>()
    for (const c of changes) byRole.set(c.roleId, [...(byRole.get(c.roleId) ?? []), c])
    for (const [roleId, list] of byRole) {
      const current = new Set(ROLE_PERMISSIONS[roleId])
      for (const c of list) (c.on ? current.add(c.permission) : current.delete(c.permission))
      writeRolePermissions(roleId, [...current])
      audit(by, `Changed permissions for ${ROLES[roleId].name}`, 'Roles and permissions', `${list.map((c) => `${c.on ? '+' : '-'}${c.permission}`).join(', ')} · reason: ${reason.trim()}`)
      notifyAccounts(mockUsers.filter((u) => u.roleId === roleId && u.status === 'active').map((u) => u.id), 'Your account access was updated', `${list.filter((c) => c.on).length} added, ${list.filter((c) => !c.on).length} removed for ${ROLES[roleId].name}. Contact the Barangay Hall if you did not expect this.`)
    }
  })
}
