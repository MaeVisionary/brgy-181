import type { User } from '@/types/auth'
import { DEMO_RESIDENT_ID } from './residents'
import { isoDaysAgo } from './random'

/**
 * MOCK ACCOUNTS for the frontend role simulation. Fictional people.
 * Every demo account uses the password below. Never reuse it anywhere real.
 */
export const DEMO_PASSWORD = 'demo1234'

export const mockUsers: User[] = [
  {
    id: 'usr-admin', username: 'admin', fullName: 'Mark Villanueva', position: 'System Administrator',
    roleId: 'system_admin', email: 'admin@brgy181.test', status: 'active', lastLoginAt: isoDaysAgo(0, 7),
  },
  {
    id: 'usr-chair', username: 'chairman', fullName: 'Roberto Santos', position: 'Punong Barangay',
    roleId: 'chairman', email: 'chairman@brgy181.test', status: 'active', lastLoginAt: isoDaysAgo(1, 8),
  },
  {
    id: 'usr-sec', username: 'secretary', fullName: 'Juan Dela Cruz', position: 'Barangay Secretary',
    roleId: 'secretary', email: 'secretary@brgy181.test', status: 'active', lastLoginAt: isoDaysAgo(0, 8),
  },
  {
    id: 'usr-cust', username: 'custodian', fullName: 'Liza Mendoza', position: 'Property Custodian',
    roleId: 'property_custodian', email: 'custodian@brgy181.test', status: 'active', lastLoginAt: isoDaysAgo(2, 9),
  },
  {
    id: 'usr-staff', username: 'staff', fullName: 'Carlo Bautista', position: 'Front Desk Staff',
    roleId: 'staff', email: 'staff@brgy181.test', status: 'active', lastLoginAt: isoDaysAgo(1, 9),
    // Example configuration: assists walk-in residents with document requests.
    extraPermissions: ['residents.search', 'residents.view', 'documents.view', 'documents.create'],
  },
  {
    id: 'usr-res', username: 'resident', fullName: 'Maria Reyes', position: 'Resident',
    roleId: 'resident', email: 'maria.reyes@example.test', status: 'active', residentId: DEMO_RESIDENT_ID,
    lastLoginAt: isoDaysAgo(3, 19),
  },
  {
    id: 'usr-inactive', username: 'former.staff', fullName: 'Ernesto Ramos', position: 'Former Clerk',
    roleId: 'staff', email: 'eramos@brgy181.test', status: 'inactive',
  },
]
