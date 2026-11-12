import type { Permission, Role, RoleId } from '@/types/auth'

/**
 * PROPOSED role–permission matrix (draft for review, see docs/PERMISSION_MATRIX.md).
 *
 * This drives the frontend role simulation only. It is NOT security:
 * the backend must enforce the same rules server-side in a later phase.
 */

export const ROLES: Record<RoleId, Role> = {
  system_admin: {
    id: 'system_admin',
    name: 'System Administrator',
    portal: 'admin',
    portalLabel: 'Admin Console',
    description:
      'Technical administration: accounts, roles, settings, activity logs. No official barangay approvals.',
  },
  chairman: {
    id: 'chairman',
    name: 'Barangay Chairman',
    portal: 'personnel',
    portalLabel: 'Personnel Portal',
    description: 'Executive oversight and final approval of documents verified by the Secretary.',
  },
  secretary: {
    id: 'secretary',
    name: 'Barangay Secretary',
    portal: 'personnel',
    portalLabel: 'Personnel Portal',
    description: 'Resident records, document processing, complaints, cases and hearings.',
  },
  kagawad: {
    id: 'kagawad',
    name: 'Barangay Kagawad',
    portal: 'personnel',
    portalLabel: 'Barangay Council',
    description:
      'Member of the Barangay Council. Base access is community summaries and reports; anything more is granted per account once the barangay confirms the responsibility.',
  },
  property_custodian: {
    id: 'property_custodian',
    name: 'Property Custodian',
    portal: 'personnel',
    portalLabel: 'Personnel Portal',
    description: 'Equipment inventory, borrowing, releases and returns.',
  },
  treasurer: {
    id: 'treasurer',
    name: 'Barangay Treasurer',
    portal: 'personnel',
    portalLabel: 'Personnel Portal',
    description: 'Records fees paid for documents (official receipt) and views collection reports.',
  },
  resident: {
    id: 'resident',
    name: 'Resident',
    portal: 'resident',
    portalLabel: 'Resident Portal',
    description: 'Own profile, requests, complaints and borrowing only.',
  },
}

export const ROLE_PERMISSIONS: Record<RoleId, readonly Permission[]> = {
  system_admin: ['users.manage', 'roles.manage', 'audit_logs.view', 'system.settings', 'system.health', 'security.approve'],

  chairman: [
    'security.approve',
    'announcements.approve',
    'concerns.manage',
    'analytics.view',
    'documents.view',
    'documents.approve',
    'documents.reject',
    'complaints.view',
    'cases.view',
    'cases.decide',
    'hearings.view',
    'reports.view',
  ],

  // Study §1.5: Kagawads may access community population summaries and reports
  // related to their responsibilities. Further access is granted per account.
  kagawad: ['analytics.view', 'reports.view', 'cases.assigned', 'concerns.view'],


  secretary: [
    'residents.view',
    'residents.search',
    'residents.import',
    'residents.create',
    'residents.update',
    'residents.verify',
    'residents.approve',
    'residents.reject',
    'documents.view',
    'documents.create',
    'documents.process',
    'documents.release',
    'documents.inspect',
    'complaints.view',
    'complaints.create',
    'complaints.update',
    'cases.view',
    'cases.manage',
    'hearings.view',
    'hearings.manage',
    'concerns.manage',
    'announcements.manage',
    'analytics.view',
    'reports.view',
    'reports.export',
  ],

  property_custodian: [
    'inventory.view',
    'inventory.manage',
    'borrowing.approve',
    'borrowing.release',
    'residents.lookup_borrower',
  ],

  // Fees for documents such as the Business Clearance are paid to the Treasurer.
  treasurer: ['documents.view', 'documents.payment', 'reports.view'],


  resident: ['self.profile', 'self.documents', 'self.complaints', 'self.borrowing', 'self.change_requests'],
}

/** Roles whose permissions the System Administrator can change in Roles and Permissions. */
export const EDITABLE_ROLES: RoleId[] = ['chairman', 'secretary', 'kagawad', 'property_custodian', 'treasurer']

/** Permission groups shown in the role manager (system and self-service permissions are not role-editable). */
export const PERMISSION_GROUPS: { id: string; name: string; permissions: Permission[] }[] = [
  { id: 'residents', name: 'Resident records', permissions: ['residents.view', 'residents.search', 'residents.import', 'residents.create', 'residents.update', 'residents.verify', 'residents.approve', 'residents.reject', 'residents.lookup_borrower'] },
  { id: 'documents', name: 'Document requests', permissions: ['documents.view', 'documents.create', 'documents.process', 'documents.inspect', 'documents.approve', 'documents.reject', 'documents.release', 'documents.payment'] },
  { id: 'cases', name: 'Complaints, cases and hearings', permissions: ['complaints.view', 'complaints.create', 'complaints.update', 'cases.view', 'cases.manage', 'cases.decide', 'cases.assigned', 'hearings.view', 'hearings.manage', 'concerns.manage', 'concerns.view'] },
  { id: 'equipment', name: 'Property and equipment', permissions: ['inventory.view', 'inventory.manage', 'borrowing.approve', 'borrowing.release'] },
  { id: 'announcements', name: 'Announcements', permissions: ['announcements.manage', 'announcements.approve'] },
  { id: 'reports', name: 'Reports and analytics', permissions: ['analytics.view', 'reports.view', 'reports.export'] },
]

const ROLE_OVERRIDES_KEY = 'bmis.rolePermissions'

/**
 * Saved changes from the role manager (prototype: this device; backend: a
 * roles table). Stored as differences from the defaults ({ on, off }), so a
 * permission added in a later release keeps its default unless someone
 * changed it on purpose. Old saves (a full list) are read the same way, but
 * permissions introduced after that format always follow the defaults.
 */
const DEFAULT_ROLE_PERMISSIONS: Record<RoleId, Permission[]> = Object.fromEntries(Object.entries(ROLE_PERMISSIONS).map(([k, v]) => [k, [...v]])) as Record<RoleId, Permission[]>
const ADDED_AFTER_LIST_FORMAT: Permission[] = ['cases.assigned', 'concerns.manage', 'concerns.view', 'security.approve', 'announcements.manage', 'announcements.approve']
type RoleDiff = { on: Permission[]; off: Permission[] }

function applyDiff(role: RoleId, d: RoleDiff) {
  const set = new Set(DEFAULT_ROLE_PERMISSIONS[role])
  for (const p of d.on) set.add(p)
  for (const p of d.off) set.delete(p)
  ;(ROLE_PERMISSIONS as Record<RoleId, Permission[]>)[role] = [...set]
}

;(function applyRoleOverrides() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROLE_OVERRIDES_KEY) ?? '{}') as Partial<Record<RoleId, Permission[] | RoleDiff>>
    const editable = new Set<Permission>(PERMISSION_GROUPS.flatMap((g) => g.permissions))
    for (const r of EDITABLE_ROLES) {
      const v = saved[r]
      if (!v) continue
      if (Array.isArray(v)) {
        const defaults = DEFAULT_ROLE_PERMISSIONS[r]
        applyDiff(r, {
          on: v.filter((p) => editable.has(p) && !defaults.includes(p) && !ADDED_AFTER_LIST_FORMAT.includes(p)),
          off: defaults.filter((p) => editable.has(p) && !v.includes(p) && !ADDED_AFTER_LIST_FORMAT.includes(p)),
        })
      } else applyDiff(r, v)
    }
  } catch {
    /* no saved changes */
  }
})()

export function writeRolePermissions(role: RoleId, list: Permission[]) {
  ;(ROLE_PERMISSIONS as Record<RoleId, Permission[]>)[role] = list
  const defaults = DEFAULT_ROLE_PERMISSIONS[role]
  const diff: RoleDiff = { on: list.filter((p) => !defaults.includes(p)), off: defaults.filter((p) => !list.includes(p)) }
  try {
    const saved = JSON.parse(localStorage.getItem(ROLE_OVERRIDES_KEY) ?? '{}')
    saved[role] = diff
    localStorage.setItem(ROLE_OVERRIDES_KEY, JSON.stringify(saved))
  } catch {
    /* storage unavailable: change lasts until reload */
  }
  window.dispatchEvent(new Event('bmis:roles-changed'))
}

/** Permissions the System Administrator may add to a barangay official's account for an assigned duty. */
export const GRANTABLE_STAFF_PERMISSIONS: readonly Permission[] = [
  'residents.view',
  'residents.search',
  'documents.view',
  'documents.create',
  'documents.process',
  'documents.release',
  'documents.inspect',
  'documents.payment',
  'complaints.view',
  'complaints.create',
  'hearings.view',
  'inventory.view',
  'analytics.view',
  'reports.view',
  'cases.view',
]

/** Every barangay official account can receive these per account (residents and the administrator cannot). */
export const GRANTABLE_ROLES: readonly string[] = ['chairman', 'secretary', 'kagawad', 'property_custodian', 'treasurer']

export const PERMISSION_LABELS: Record<Permission, string> = {
  'residents.view': 'View resident records',
  'residents.search': 'Search the resident master list',
  'residents.import': 'Import resident CSV',
  'residents.create': 'Create resident records',
  'residents.update': 'Update official resident records',
  'residents.verify': 'Review registrations (manual verification)',
  'residents.approve': 'Approve registrations and change requests',
  'residents.reject': 'Reject registrations and change requests',
  'residents.lookup_borrower': 'Look up borrower name and address only',
  'documents.view': 'View document requests',
  'documents.create': 'Encode requests for residents (assisted service)',
  'documents.process': 'Verify and process document requests',
  'documents.approve': 'Approve documents (official)',
  'documents.reject': 'Reject documents (official)',
  'documents.release': 'Record document release',
  'documents.inspect': 'Record verification and ocular inspection findings',
  'documents.payment': 'Record fees paid (official receipt)',
  'complaints.view': 'View complaints and incident reports',
  'complaints.create': 'Encode complaints and incident reports',
  'complaints.update': 'Update complaint status',
  'cases.view': 'View case summaries',
  'cases.manage': 'Create and manage cases and blotter records',
  'cases.decide': 'Assess complaints, record settlement or Lupon referral',
  'cases.assigned': 'Work on complaints assigned to them (view and add notes)',
  'hearings.view': 'View hearing schedules',
  'hearings.manage': 'Schedule hearings and record attendance',
  'inventory.view': 'View equipment inventory',
  'inventory.manage': 'Add and update equipment',
  'borrowing.approve': 'Approve or reject borrowing requests',
  'borrowing.release': 'Record equipment release and return',
  'analytics.view': 'View population analytics and ayuda planning',
  'reports.view': 'View reports',
  'reports.export': 'Export reports (PDF, Excel)',
  'users.manage': 'Manage user accounts',
  'roles.manage': 'Manage roles and permissions',
  'audit_logs.view': 'View activity logs',
  'system.settings': 'Manage system settings',
  'system.health': 'View system health and backups',
  'security.approve': 'Approve access changes as the second person',
  'concerns.manage': 'Manage community concerns (group, assign, resolve)',
  'concerns.view': 'View community concerns',
  'announcements.manage': 'Write and submit announcements',
  'announcements.approve': 'Approve or reject announcements',
  'self.profile': 'View own profile',
  'self.documents': 'Request and track own documents',
  'self.complaints': 'Submit and track own complaints',
  'self.borrowing': 'Request and track own borrowing',
  'self.change_requests': 'Request corrections to own information',
}
