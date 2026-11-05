import { GRANTABLE_STAFF_PERMISSIONS, ROLES } from '@/config/permissions'
import { DEMO_RESIDENT_ID } from '@/mocks/residents'
import type { RoleId, User } from '@/types/auth'

/**
 * TEST ACCOUNT for the project team. Configured only through `.env.local`
 * (never committed): VITE_TEST_ACCOUNT_EMAIL and VITE_TEST_ACCOUNT_PASSWORD_SHA256
 * (= SHA-256 of "usr-test:<password>"). It signs in through the normal login form
 * and can switch between every role ("level") to test each experience.
 */
const email = (import.meta.env.VITE_TEST_ACCOUNT_EMAIL as string | undefined)?.trim().toLowerCase()
const passwordHash = (import.meta.env.VITE_TEST_ACCOUNT_PASSWORD_SHA256 as string | undefined)?.trim().toLowerCase()

export const TEST_ACCOUNT = {
  enabled: !!email && !!passwordHash,
  email: email ?? '',
  /** Initial password hash; a reset or change stored on this device overrides it. */
  passwordHash: passwordHash ?? '',
  credentialKey: 'usr-test',
  name: 'Ruffa Mae Silorio',
} as const

export const TEST_LEVELS: RoleId[] = ['system_admin', 'chairman', 'secretary', 'kagawad', 'sk_chairman', 'property_custodian', 'staff', 'resident']

export const isTestUser = (id: string | undefined) => !!id && id.startsWith('usr-test-')

export function testUserFor(role: RoleId): User {
  return {
    id: `usr-test-${role}`,
    username: TEST_ACCOUNT.email,
    fullName: TEST_ACCOUNT.name,
    position: `${ROLES[role].name} (test account)`,
    roleId: role,
    email: TEST_ACCOUNT.email,
    status: 'active',
    residentId: role === 'resident' ? DEMO_RESIDENT_ID : undefined,
    extraPermissions: role === 'staff' ? [...GRANTABLE_STAFF_PERMISSIONS] : undefined,
  }
}
