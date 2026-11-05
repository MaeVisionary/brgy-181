import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { APP_CONFIG } from '@/config/app'
import { ROLES, ROLE_PERMISSIONS } from '@/config/permissions'
import { createSession, findUser, signIn as signInRequest, type SignInInput } from '@/services/authService'
import type { Permission, Role, Session, User } from '@/types/auth'

/**
 * Session state for the frontend. Permission checks here only shape the UI;
 * the backend must enforce every rule. There is no frontend credential check.
 */

const STORAGE_KEY = 'bmis.session'

export interface AuthContextValue {
  user: User | null
  role: Role | null
  permissions: ReadonlySet<Permission>
  signIn: (input: SignInInput) => Promise<User>
  logout: () => void
  /** Development preview only: open the app as an account without signing in. */
  previewAs: (userId: string) => void
  can: (permission: Permission) => boolean
  canAny: (permissions: readonly Permission[]) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    return new Date(session.expiresAt) > new Date() ? session : null
  } catch {
    return null
  }
}

function writeSession(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable; session lives in memory only.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Sessions only exist through the development preview until the backend exists.
  const [session, setSession] = useState<Session | null>(() => (APP_CONFIG.devPreview ? readSession() : null))

  const user = useMemo(() => (session ? (findUser(session.userId) ?? null) : null), [session])

  const permissions = useMemo<ReadonlySet<Permission>>(() => {
    if (!user) return new Set()
    return new Set([...ROLE_PERMISSIONS[user.roleId], ...(user.extraPermissions ?? [])])
  }, [user])

  const start = useCallback((next: Session | null) => {
    writeSession(next)
    setSession(next)
  }, [])

  useEffect(() => {
    if (!session) return
    const ms = new Date(session.expiresAt).getTime() - Date.now()
    const timer = setTimeout(() => start(null), Math.max(ms, 0))
    return () => clearTimeout(timer)
  }, [session, start])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user ? ROLES[user.roleId] : null,
      permissions,
      signIn: async (input) => {
        const result = await signInRequest(input)
        start(result.session)
        return result.user
      },
      logout: () => start(null),
      previewAs: (userId) => {
        if (!APP_CONFIG.devPreview) return
        start(createSession(userId))
      },
      can: (p) => permissions.has(p),
      canAny: (ps) => ps.some((p) => permissions.has(p)),
    }),
    [user, permissions, start],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
