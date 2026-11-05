import { GRANTABLE_ROLES, GRANTABLE_STAFF_PERMISSIONS } from '@/config/permissions'
import { mockUsers } from '@/mocks/users'
import type { Permission, User } from '@/types/auth'
import { audit } from './auditService'
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
