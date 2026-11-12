import { APP_CONFIG } from '@/config/app'
import { TEST_LEVELS, testAccountByEmail, testAccountOf, testUserFor } from '@/config/testAccount'
import { mockUsers } from '@/mocks/users'
import type { RoleId, Session, User } from '@/types/auth'
import { addFailure, clearFailures, failedCount, getCredential, hashPassword } from './credentialStore'
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

const INVALID = 'Incorrect username/email or password. Forgot it? Use "Forgot password?" to get a reset link.'

export async function signIn(input: SignInInput): Promise<{ user: User; session: Session }> {
  const id = input.identifier.trim().toLowerCase()
  const lockKey = `login:${id}`
  if (failedCount(lockKey) >= APP_CONFIG.lockoutThreshold) {
    throw new ServiceError('locked', 'This account is locked after too many failed attempts. Use "Forgot password?" to set a new password, which unlocks it.')
  }
  const fail = (): never => {
    const n = addFailure(lockKey)
    const left = APP_CONFIG.lockoutThreshold - n
    throw new ServiceError('invalid', left > 0 ? `${INVALID} ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many failed attempts. The account is now locked.')
  }

  // Test account: any account type; the chosen type decides the starting level.
  const testAccount = testAccountByEmail(id)
  if (testAccount) {
    const cred = getCredential(testAccount.credentialKey)
    const expected = cred?.hash ?? testAccount.passwordHash
    if (!(await passwordMatches(testAccount.credentialKey, input.password, expected))) fail()
    clearFailures(lockKey)
    const role = input.roles[0]
    const user = testUserFor(role, testAccount)
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
  const testAccount = testAccountOf(userId)
  if (testAccount) {
    const role = userId.slice(testAccount.idPrefix.length) as RoleId
    // A level that no longer exists (e.g. a removed role) ends the saved session.
    return TEST_LEVELS.includes(role) ? testUserFor(role, testAccount) : undefined
  }
  return mockUsers.find((u) => u.id === userId)
}

/** DEVELOPMENT PREVIEW ONLY (not available in production builds). */
export function listPreviewAccounts(): User[] {
  return APP_CONFIG.devPreview ? mockUsers.filter((u) => u.status === 'active') : []
}

/**
 * Confirms the signed-in user's own password before a sensitive change
 * (e.g. account permissions). Accounts without a password yet (development
 * preview) cannot confirm.
 */
export async function verifyOwnPassword(user: User, password: string): Promise<boolean> {
  const test = testAccountOf(user.id)
  const key = test ? test.credentialKey : user.id
  const expected = getCredential(key)?.hash ?? test?.passwordHash
  if (!expected) return false
  return passwordMatches(key, password, expected)
}
