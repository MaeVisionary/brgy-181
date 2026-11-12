/**
 * Identity and access types.
 * FRONTEND SIMULATION ONLY: real authentication and authorization
 * will be enforced by the backend in a later phase.
 */

export type RoleId =
  | 'system_admin'
  | 'chairman'
  | 'secretary'
  | 'kagawad'
  | 'property_custodian'
  | 'treasurer'
  | 'resident'

/** Which portal (shell + navigation set) a role uses. */
export type Portal = 'admin' | 'personnel' | 'resident'

export type Permission =
  // Residents (Module 2)
  | 'residents.view'
  | 'residents.search'
  | 'residents.import'
  | 'residents.create'
  | 'residents.update'
  | 'residents.verify'
  | 'residents.approve'
  | 'residents.reject'
  | 'residents.lookup_borrower'
  // Documents (Module 4)
  | 'documents.view'
  | 'documents.create'
  | 'documents.process'
  | 'documents.approve'
  | 'documents.reject'
  | 'documents.release'
  /** Record a verification or ocular inspection for a request. */
  | 'documents.inspect'
  /** Record the fee paid (official receipt) for a request. */
  | 'documents.payment'
  // Complaints, cases, hearings (Modules 5 and 6)
  | 'complaints.view'
  | 'complaints.create'
  | 'complaints.update'
  | 'cases.view'
  | 'cases.manage'
  | 'cases.decide'
  | 'cases.assigned'
  | 'hearings.view'
  | 'hearings.manage'
  // Inventory (Module 7)
  | 'inventory.view'
  | 'inventory.manage'
  | 'borrowing.approve'
  | 'borrowing.release'
  // Reports and analytics (Module 3)
  | 'analytics.view'
  | 'reports.view'
  | 'reports.export'
  // System (Modules 1 and 8)
  | 'users.manage'
  | 'roles.manage'
  | 'audit_logs.view'
  | 'system.settings'
  | 'system.health'
  | 'security.approve'
  | 'concerns.manage'
  | 'announcements.manage'
  | 'announcements.approve'
  | 'concerns.view'
  // Resident self-service (own records only)
  | 'self.profile'
  | 'self.documents'
  | 'self.complaints'
  | 'self.borrowing'
  | 'self.change_requests'

export interface Role {
  id: RoleId
  name: string
  portal: Portal
  /** Label shown at the top of the sidebar, e.g. "PERSONNEL PORTAL". */
  portalLabel: string
  description: string
}

export type AccountStatus = 'active' | 'inactive' | 'locked'

export interface User {
  id: string
  username: string
  fullName: string
  /** Position title shown under the name, e.g. "Barangay Secretary". */
  position: string
  roleId: RoleId
  email: string
  status: AccountStatus
  /** Linked resident record (residents only). */
  residentId?: string
  /**
   * Extra permissions granted to this account on top of its role.
   * Extra permissions an administrator adds to an official for an assigned duty.
   */
  extraPermissions?: Permission[]
  lastLoginAt?: string
}

export interface Session {
  userId: string
  startedAt: string
  expiresAt: string
  /** Set after an administrator reset: the user must choose a new password first. */
  mustChangePassword?: boolean
}
