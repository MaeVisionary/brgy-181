import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { APP_CONFIG } from '@/config/app'
import { ROLES, ROLE_PERMISSIONS } from '@/config/permissions'
import { isTestUser } from '@/config/testAccount'
import { createSession, findUser, signIn as signInRequest, type SignInInput } from '@/services/authService'
import type { Permission, Role, RoleId, Session, User } from '@/types/auth'

/**
 * Session state for the frontend. Permission checks here only shape the UI;
 * the backend must enforce every rule.
 */

const STORAGE_KEY = 'bmis.session'

export interface AuthContextValue {
  user: User | null
  role: Role | null
  permissions: ReadonlySet<Permission>
  /** The user must set a new password before using the portal. */
  mustChangePassword: boolean
  signIn: (input: SignInInput) => Promise<{ user: User; mustChangePassword: boolean }>
  logout: () => void
  passwordChanged: () => void
  /** Test account only: view the portal as another level. */
  switchTestLevel: (role: RoleId) => void
  /** Development preview only: open the app as an account without signing in. */
  previewAs: (userId: string) => void
  can: (permission: Permission) => boolean
  canAny: (permissions: readonly Permission[]) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function readSession(): Session | null {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(STORAGE_KEY)
      if (!raw) continue
      const session = JSON.parse(raw) as Session
      if (new Date(session.expiresAt) > new Date() && findUser(session.userId)) return session
    } catch {
      /* ignore */
    }
  }
  return null
}

function writeSession(session: Session | null, remember: boolean) {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
    if (session) (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    /* storage unavailable: session lives in memory only */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession)
  const [remember, setRemember] = useState(() => {
    try {
      return !!localStorage.getItem(STORAGE_KEY)
    } catch {
      return false
    }
  })

  const user = useMemo(() => (session ? (findUser(session.userId) ?? null) : null), [session])

  const permissions = useMemo<ReadonlySet<Permission>>(() => {
    if (!user) return new Set()
    return new Set([...ROLE_PERMISSIONS[user.roleId], ...(user.extraPermissions ?? [])])
  }, [user])

  const start = useCallback((next: Session | null, keep: boolean) => {
    writeSession(next, keep)
    setRemember(keep)
    setSession(next)
  }, [])

  useEffect(() => {
    if (!session) return
    const ms = new Date(session.expiresAt).getTime() - Date.now()
    const timer = setTimeout(() => start(null, false), Math.max(ms, 0))
    return () => clearTimeout(timer)
  }, [session, start])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user ? ROLES[user.roleId] : null,
      permissions,
      mustChangePassword: !!session?.mustChangePassword,
      signIn: async (input) => {
        const result = await signInRequest(input)
        start(result.session, input.remember)
        return { user: result.user, mustChangePassword: !!result.session.mustChangePassword }
      },
      logout: () => start(null, false),
      passwordChanged: () => session && start({ ...session, mustChangePassword: false }, remember),
      switchTestLevel: (role) => {
        if (!session || !isTestUser(session.userId)) return
        start({ ...session, userId: `usr-test-${role}` }, remember)
      },
      previewAs: (userId) => {
        if (!APP_CONFIG.devPreview) return
        start(createSession(userId), false)
      },
      can: (p) => permissions.has(p),
      canAny: (ps) => ps.some((p) => permissions.has(p)),
    }),
    [user, permissions, session, remember, start],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
