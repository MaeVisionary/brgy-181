import { GRANTABLE_STAFF_PERMISSIONS, ROLES } from '@/config/permissions'
import { DEMO_RESIDENT_ID } from '@/mocks/residents'
import type { RoleId, User } from '@/types/auth'

/**
 * TEST ACCOUNTS for the project team. Configured only through `.env.local`
 * (never committed) or repository secrets for the live site:
 *   account 1: VITE_TEST_ACCOUNT_EMAIL, VITE_TEST_ACCOUNT_PASSWORD_SHA256 (= SHA-256 of "usr-test:<password>")
 *   account 2: VITE_TEST_ACCOUNT_2_EMAIL, VITE_TEST_ACCOUNT_2_PASSWORD_SHA256 (= SHA-256 of "usr-test2:<password>")
 * Each signs in through the normal login form and can switch between every role ("level").
 */
export interface TestAccountDef {
  enabled: boolean
  email: string
  /** Initial password hash; a reset or change stored on this device overrides it. */
  passwordHash: string
  credentialKey: string
  /** Prefix of the per-level user ids (e.g. "usr-test-secretary"). */
  idPrefix: string
  name: string
}

const clean = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '')

function define(n: '' | '2', email: unknown, hash: unknown, name: string): TestAccountDef {
  const e = clean(email)
  const h = clean(hash)
  return { enabled: !!e && !!h, email: e, passwordHash: h, credentialKey: `usr-test${n}`, idPrefix: `usr-test${n}-`, name }
}

export const TEST_ACCOUNTS: TestAccountDef[] = [
  define('', import.meta.env.VITE_TEST_ACCOUNT_EMAIL, import.meta.env.VITE_TEST_ACCOUNT_PASSWORD_SHA256, 'Ruffa Mae Silorio'),
  define('2', import.meta.env.VITE_TEST_ACCOUNT_2_EMAIL, import.meta.env.VITE_TEST_ACCOUNT_2_PASSWORD_SHA256, 'Test Account'),
].filter((a) => a.enabled)

/** First test account (kept for older references). */
export const TEST_ACCOUNT: TestAccountDef = TEST_ACCOUNTS[0] ?? define('', '', '', 'Ruffa Mae Silorio')

export const TEST_LEVELS: RoleId[] = ['system_admin', 'chairman', 'secretary', 'kagawad', 'property_custodian', 'treasurer', 'staff', 'resident']

export const testAccountOf = (id: string | undefined): TestAccountDef | undefined =>
  id ? TEST_ACCOUNTS.find((a) => id.startsWith(a.idPrefix)) : undefined

export const testAccountByEmail = (email: string): TestAccountDef | undefined => TEST_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase())

/** Admin list rows use the credential key as their id. */
export const testAccountByKey = (key: string): TestAccountDef | undefined => TEST_ACCOUNTS.find((a) => a.credentialKey === key)

export const isTestUser = (id: string | undefined) => !!testAccountOf(id)

export function testUserFor(role: RoleId, account: TestAccountDef = TEST_ACCOUNT): User {
  return {
    id: `${account.idPrefix}${role}`,
    username: account.email,
    fullName: account.name,
    position: `${ROLES[role].name} (test account)`,
    roleId: role,
    email: account.email,
    status: 'active',
    residentId: role === 'resident' ? DEMO_RESIDENT_ID : undefined,
    extraPermissions: role === 'staff' ? [...GRANTABLE_STAFF_PERMISSIONS] : undefined,
  }
}
