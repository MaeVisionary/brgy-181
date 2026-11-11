import { GRANTABLE_ROLES, GRANTABLE_STAFF_PERMISSIONS } from '@/config/permissions'
import { mockUsers } from '@/mocks/users'
import type { Permission, RoleId, User } from '@/types/auth'
import { audit } from './auditService'
import { clearFailures, hashPassword, resolveResetRequests, setCredential, temporaryPassword } from './credentialStore'
import { ServiceError, mockRequest } from './mockApi'

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

export function setExtraPermissions(id: string, perms: Permission[], by: User): Promise<User> {
  return mockRequest(() => {
    requireAdmin(by)
    const u = mockUsers.find((x) => x.id === id)
    if (!u) throw new ServiceError('not_found', 'Account not found.')
    if (!GRANTABLE_ROLES.includes(u.roleId)) throw new ServiceError('invalid', 'Permissions are set per role for this account.')
    u.extraPermissions = perms.filter((p) => GRANTABLE_STAFF_PERMISSIONS.includes(p))
    audit(by, 'Changed account permissions', 'Roles and permissions', `${u.username}: ${u.extraPermissions.join(', ') || 'none'}`)
    return u
  })
}

/** Personnel positions the administrator may assign (elected officials keep their role). */
export const ASSIGNABLE_ROLES: RoleId[] = ['staff', 'property_custodian', 'treasurer']

export function setRole(id: string, roleId: RoleId, by: User): Promise<User> {
  return mockRequest(() => {
    requireAdmin(by)
    const u = mockUsers.find((x) => x.id === id)
    if (!u) throw new ServiceError('not_found', 'Account not found.')
    if (!ASSIGNABLE_ROLES.includes(u.roleId) || !ASSIGNABLE_ROLES.includes(roleId)) throw new ServiceError('official', 'Only personnel positions can be reassigned here.')
    if (u.roleId === roleId) return u
    const before = u.roleId
    u.roleId = roleId
    audit(by, 'Changed account role', 'Roles and permissions', `${u.username}: ${before} to ${roleId}`)
    return u
  })
}
