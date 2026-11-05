import { OFFICIALS } from '@/config/barangay'
import type { RoleId, User } from '@/types/auth'
import { DEMO_RESIDENT_ID } from './residents'
import { isoDaysAgo } from './random'

/**
 * PROTOTYPE ACCOUNTS. Officials use the names in the study (§1.1). The Property
 * Custodian, System Administrator and other personnel have no documented names,
 * so only the position is shown; the administrator can set a name later.
 * The resident account is a fictional sample person.
 * No passwords exist in the frontend; sign-in will be verified by the backend.
 */

const roleOf: Record<string, RoleId> = {
  'Barangay Chairman': 'chairman',
  'Barangay Secretary': 'secretary',
  'Barangay Kagawad': 'kagawad',
  'SK Chairman': 'sk_chairman',
}

const usernames: Record<string, string> = {
  'usr-chair': 'robert.atad',
  'usr-sec': 'ana.salvador',
  'usr-kag-1': 'angelito.delacruz',
  'usr-kag-2': 'renz.cunanan',
  'usr-kag-3': 'manuel.cadiapa',
  'usr-kag-4': 'mario.antonio',
  'usr-kag-5': 'cecilia.espinosa',
  'usr-kag-6': 'alver.domingo',
  'usr-kag-7': 'rogelio.cristobal',
  'usr-sk': 'kriscelli.reyes',
}

const officialUsers: User[] = OFFICIALS.filter((o) => o.userId).map((o, i) => ({
  id: o.userId!,
  username: usernames[o.userId!],
  fullName: o.name,
  position: o.position,
  roleId: roleOf[o.position],
  email: `${usernames[o.userId!]}@brgy181.test`,
  status: 'active',
  lastLoginAt: isoDaysAgo(i % 4, 8 + (i % 3)),
}))

export const mockUsers: User[] = [
  ...officialUsers,
  {
    id: 'usr-cust', username: 'custodian', fullName: 'Property Custodian', position: 'Property Custodian',
    roleId: 'property_custodian', email: 'custodian@brgy181.test', status: 'active', lastLoginAt: isoDaysAgo(2, 9),
  },
  {
    id: 'usr-admin', username: 'admin', fullName: 'System Administrator', position: 'System Administrator',
    roleId: 'system_admin', email: 'admin@brgy181.test', status: 'active', lastLoginAt: isoDaysAgo(0, 7),
  },
  {
    id: 'usr-staff', username: 'frontdesk', fullName: 'Authorized Personnel', position: 'Other authorized personnel (configurable)',
    roleId: 'staff', email: 'frontdesk@brgy181.test', status: 'active', lastLoginAt: isoDaysAgo(1, 9),
    // Example configuration: assists walk-in residents with document requests.
    extraPermissions: ['residents.search', 'residents.view', 'documents.view', 'documents.create'],
  },
  {
    id: 'usr-res', username: 'maria.dizon', fullName: 'Maria Clara Dizon', position: 'Resident (sample)',
    roleId: 'resident', email: 'maria.dizon@example.test', status: 'active', residentId: DEMO_RESIDENT_ID,
    lastLoginAt: isoDaysAgo(3, 19),
  },
  {
    id: 'usr-inactive', username: 'former.clerk', fullName: 'Deactivated account', position: 'Former personnel',
    roleId: 'staff', email: 'former@brgy181.test', status: 'inactive',
  },
]

export const userById = (id: string) => mockUsers.find((u) => u.id === id)
