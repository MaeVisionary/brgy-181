import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ROLES, ROLE_PERMISSIONS } from '@/config/permissions'
import { createSession, findUser, login as loginRequest } from '@/services/authService'
import type { Permission, Role, Session, User } from '@/types/auth'

/**
 * FRONTEND ROLE SIMULATION. Checks here only shape what the UI shows.
 * They do not protect data; the backend must enforce every rule.
 */

const STORAGE_KEY = 'bmis.demo.session'

export interface AuthContextValue {
  user: User | null
  role: Role | null
  permissions: ReadonlySet<Permission>
  login: (username: string, password: string) => Promise<User>
  logout: () => void
  /** Demo mode only: switch to another mock account without a password. */
  switchUser: (userId: string) => void
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
    // Storage unavailable (private mode); session lives in memory only.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession)

  const user = useMemo(() => (session ? (findUser(session.userId) ?? null) : null), [session])

  const permissions = useMemo<ReadonlySet<Permission>>(() => {
    if (!user) return new Set()
    return new Set([...ROLE_PERMISSIONS[user.roleId], ...(user.extraPermissions ?? [])])
  }, [user])

  const start = useCallback((next: Session | null) => {
    writeSession(next)
    setSession(next)
  }, [])

  // Session expiry (simulated).
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
      login: async (username, password) => {
        const result = await loginRequest(username, password)
        start(result.session)
        return result.user
      },
      logout: () => start(null),
      switchUser: (userId) => start(createSession(userId)),
      can: (p) => permissions.has(p),
      canAny: (ps) => ps.some((p) => permissions.has(p)),
    }),
    [user, permissions, start],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
