import { APP_CONFIG } from '@/config/app'
import { TEST_ACCOUNT, TEST_LEVELS, isTestUser, testUserFor } from '@/config/testAccount'
import { mockUsers } from '@/mocks/users'
import type { RoleId, Session, User } from '@/types/auth'
import { addFailure, addResetRequest, clearFailures, failedCount, getCredential, hashPassword } from './credentialStore'
import { ServiceError, mockRequest } from './mockApi'
import { pendingAccountMessage } from './registrationService'

/**
 * PROTOTYPE sign-in. Passwords exist only after the System Administrator resets an
 * account (or for the configured test account); nothing is hardcoded. The backend
 * replaces this with server-side verification, hashing and HTTPS (NFR5).
 */

export interface SignInInput {
  /** Roles allowed by the account type chosen on the portal. */
  roles: RoleId[]
  identifier: string
  password: string
  remember: boolean
}

/** Exact match, or the same password with stray spaces from copy-paste removed. */
async function passwordMatches(key: string, password: string, expected: string): Promise<boolean> {
  if ((await hashPassword(key, password)) === expected) return true
  const trimmed = password.trim()
  return trimmed !== password && (await hashPassword(key, trimmed)) === expected
}

const INVALID = 'Incorrect username/email or password. If you have no password yet, ask the System Administrator to reset your account.'

export async function signIn(input: SignInInput): Promise<{ user: User; session: Session }> {
  const id = input.identifier.trim().toLowerCase()
  const lockKey = `login:${id}`
  if (failedCount(lockKey) >= APP_CONFIG.lockoutThreshold) {
    throw new ServiceError('locked', 'This account is locked after too many failed attempts. Ask the System Administrator to reset your password.')
  }
  const fail = (): never => {
    const n = addFailure(lockKey)
    const left = APP_CONFIG.lockoutThreshold - n
    throw new ServiceError('invalid', left > 0 ? `${INVALID} ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many failed attempts. The account is now locked.')
  }

  // Test account: any account type; the chosen type decides the starting level.
  if (TEST_ACCOUNT.enabled && id === TEST_ACCOUNT.email) {
    const cred = getCredential(TEST_ACCOUNT.credentialKey)
    const expected = cred?.hash ?? TEST_ACCOUNT.passwordHash
    if (!(await passwordMatches(TEST_ACCOUNT.credentialKey, input.password, expected))) fail()
    clearFailures(lockKey)
    const role = input.roles.includes('staff') ? 'staff' : input.roles[0]
    const user = testUserFor(role)
    return mockRequest(() => ({ user, session: createSession(user.id, !!cred?.mustChange) }))
  }

  const user = mockUsers.find((u) => u.username.toLowerCase() === id || u.email.toLowerCase() === id)
  const cred = user ? getCredential(user.id) : undefined
  if (!user || !cred || !input.roles.includes(user.roleId)) fail()
  if (!(await passwordMatches(user!.id, input.password, cred!.hash))) fail()
  if (user!.status !== 'active') {
    clearFailures(lockKey)
    throw new ServiceError('inactive', pendingAccountMessage(user!.id) ?? 'This account is deactivated. Please contact the System Administrator.')
  }
  clearFailures(lockKey)
  user!.lastLoginAt = new Date().toISOString()
  return mockRequest(() => ({ user: user!, session: createSession(user!.id, cred!.mustChange) }))
}

/** Always answers the same way, so it never reveals whether an account exists. */
export function requestPasswordReset(identifier: string, accountType: string): Promise<void> {
  return mockRequest(() => {
    if (!identifier.trim()) throw new ServiceError('invalid', 'Enter your username or email.')
    addResetRequest(identifier, accountType)
  })
}

export function createSession(userId: string, mustChangePassword = false): Session {
  const now = new Date()
  return {
    userId,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + APP_CONFIG.sessionMinutes * 60_000).toISOString(),
    mustChangePassword,
  }
}

export function findUser(userId: string): User | undefined {
  if (isTestUser(userId) && TEST_ACCOUNT.enabled) {
    const role = userId.replace('usr-test-', '') as RoleId
    // A level that no longer exists (e.g. a removed role) ends the saved session.
    return TEST_LEVELS.includes(role) ? testUserFor(role) : undefined
  }
  return mockUsers.find((u) => u.id === userId)
}

/** DEVELOPMENT PREVIEW ONLY (not available in production builds). */
export function listPreviewAccounts(): User[] {
  return APP_CONFIG.devPreview ? mockUsers.filter((u) => u.status === 'active') : []
}
