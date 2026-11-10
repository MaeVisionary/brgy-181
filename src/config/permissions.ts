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
  staff: {
    id: 'staff',
    name: 'Authorized Personnel',
    portal: 'personnel',
    portalLabel: 'Personnel Portal',
    description:
      'Additional staff. Base access is minimal; the System Administrator grants extra permissions per account.',
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
  system_admin: ['users.manage', 'roles.manage', 'audit_logs.view', 'system.settings', 'system.health'],

  chairman: [
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
  kagawad: ['analytics.view', 'reports.view'],


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
    'complaints.view',
    'complaints.create',
    'complaints.update',
    'cases.view',
    'cases.manage',
    'hearings.view',
    'hearings.manage',
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

  // Base set only; real access comes from each account's extraPermissions.
  staff: [],

  resident: ['self.profile', 'self.documents', 'self.complaints', 'self.borrowing', 'self.change_requests'],
}

/** Permissions the System Administrator may grant to "Authorized Personnel" accounts. */
export const GRANTABLE_STAFF_PERMISSIONS: readonly Permission[] = [
  'residents.view',
  'residents.search',
  'documents.view',
  'documents.create',
  'documents.process',
  'documents.release',
  'complaints.view',
  'complaints.create',
  'hearings.view',
  'inventory.view',
  'analytics.view',
  'reports.view',
  'cases.view',
]

/** Every barangay official account can receive these per account (residents and the administrator cannot). */
export const GRANTABLE_ROLES: readonly string[] = ['chairman', 'secretary', 'kagawad', 'property_custodian', 'staff']

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
  'complaints.view': 'View complaints and incident reports',
  'complaints.create': 'Encode complaints and incident reports',
  'complaints.update': 'Update complaint status',
  'cases.view': 'View case summaries',
  'cases.manage': 'Create and manage cases and blotter records',
  'cases.decide': 'Assess complaints, record settlement or Lupon referral',
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
  'self.profile': 'View own profile',
  'self.documents': 'Request and track own documents',
  'self.complaints': 'Submit and track own complaints',
  'self.borrowing': 'Request and track own borrowing',
  'self.change_requests': 'Request corrections to own information',
}
