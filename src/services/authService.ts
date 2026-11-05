import { mockUsers } from '@/mocks/users'
import type { RoleId, Session, User } from '@/types/auth'
import { APP_CONFIG } from '@/config/app'
import { ServiceError, mockRequest } from './mockApi'

/**
 * Authentication boundary. The frontend never checks credentials: there are no
 * demo usernames or passwords. `signIn` is where the backend API will be called
 * (it must verify the password, the account status and that the account's role
 * matches the account type selected on the portal).
 */

export interface SignInInput {
  accountType: RoleId | 'personnel'
  identifier: string
  password: string
  remember: boolean
}

export function signIn(input: SignInInput): Promise<{ user: User; session: Session }> {
  return mockRequest(() => {
    void input
    throw new ServiceError(
      'backend_not_connected',
      'Sign-in is not available yet. Account verification will be connected during backend development.',
    )
  })
}

export function createSession(userId: string): Session {
  const now = new Date()
  return {
    userId,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + APP_CONFIG.sessionMinutes * 60_000).toISOString(),
  }
}

export function findUser(userId: string): User | undefined {
  return mockUsers.find((u) => u.id === userId)
}

/** DEVELOPMENT PREVIEW ONLY (not available in production builds). */
export function listPreviewAccounts(): User[] {
  return APP_CONFIG.devPreview ? mockUsers.filter((u) => u.status === 'active') : []
}
