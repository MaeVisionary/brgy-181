import { APP_CONFIG } from '@/config/app'
import { DEMO_PASSWORD, mockUsers } from '@/mocks/users'
import type { Session, User } from '@/types/auth'
import { ServiceError, mockRequest } from './mockApi'

/**
 * SIMULATED authentication. Credentials are checked in the browser against
 * mock accounts. This is not secure and exists only for frontend testing.
 */

const failedAttempts = new Map<string, number>()

export function listDemoUsers(): User[] {
  return mockUsers.filter((u) => u.status === 'active')
}

export function findUser(userId: string): User | undefined {
  return mockUsers.find((u) => u.id === userId)
}

export function createSession(userId: string): Session {
  const now = new Date()
  return {
    userId,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + APP_CONFIG.sessionMinutes * 60_000).toISOString(),
  }
}

export function login(username: string, password: string): Promise<{ user: User; session: Session }> {
  return mockRequest(() => {
    const key = username.trim().toLowerCase()
    const user = mockUsers.find((u) => u.username === key)
    const attempts = failedAttempts.get(key) ?? 0

    if (user?.status === 'locked' || attempts >= APP_CONFIG.lockoutThreshold) {
      if (user) user.status = 'locked'
      throw new ServiceError(
        'locked',
        'This account is locked after too many failed attempts. Please contact the System Administrator.',
      )
    }
    if (!user || password !== DEMO_PASSWORD) {
      const next = attempts + 1
      failedAttempts.set(key, next)
      const left = APP_CONFIG.lockoutThreshold - next
      throw new ServiceError(
        'invalid',
        left > 0
          ? `Incorrect username or password. ${left} attempt${left === 1 ? '' : 's'} left before lockout.`
          : 'Incorrect username or password. The account is now locked.',
      )
    }
    if (user.status === 'inactive') {
      throw new ServiceError('inactive', 'This account is deactivated. Please contact the System Administrator.')
    }
    failedAttempts.delete(key)
    user.lastLoginAt = new Date().toISOString()
    return { user, session: createSession(user.id) }
  })
}
