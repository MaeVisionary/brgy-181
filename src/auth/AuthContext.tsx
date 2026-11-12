import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { clearDraftsFor, purgeExpiredDrafts } from '@/lib/drafts'
import { APP_CONFIG } from '@/config/app'
import { ROLES, ROLE_PERMISSIONS } from '@/config/permissions'
import { testAccountOf } from '@/config/testAccount'
import { createSession, findUser, signIn as signInRequest, type SignInInput } from '@/services/authService'
import { audit } from '@/services/auditService'
import { sessionsValidFrom } from '@/services/credentialStore'
import type { Permission, Role, RoleId, Session, User } from '@/types/auth'

/**
 * Session state for the frontend. Permission checks here only shape the UI;
 * the backend must enforce every rule.
 */

const STORAGE_KEY = 'bmis.session'
export const RESET_SIGNOUT_KEY = 'bmis.signedOutByReset'
/** A password reset ends every earlier session of the account (this tab and others). */
const endedByReset = (s: Session) => { const from = sessionsValidFrom(testAccountOf(s.userId)?.credentialKey ?? s.userId); return !!from && s.startedAt < from }
export const EXPIRED_KEY = 'bmis.sessionExpired'

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
      if (new Date(session.expiresAt) > new Date() && findUser(session.userId) && !endedByReset(session)) return session
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

  // Keyed on the account id only: extending the session (new expiry time) must not create a new user
  // object, or every page would reload its data and redraw on each extension.
  const userId = session?.userId ?? null
  const user = useMemo(() => (userId ? (findUser(userId) ?? null) : null), [userId])

  const permissions = useMemo<ReadonlySet<Permission>>(() => {
    if (!user) return new Set()
    return new Set([...ROLE_PERMISSIONS[user.roleId], ...(user.extraPermissions ?? [])])
  }, [user])

  const start = useCallback((next: Session | null, keep: boolean) => {
    writeSession(next, keep)
    setRemember(keep)
    setSession(next)
  }, [])

  // Expiry: signed out after the idle period; the sign-in page explains why.
  useEffect(() => {
    if (!session) return
    const ms = new Date(session.expiresAt).getTime() - Date.now()
    const timer = setTimeout(() => {
      const u = findUser(session.userId)
      if (u) audit(u, 'Session expired', 'Security')
      try { sessionStorage.setItem(EXPIRED_KEY, '1') } catch { /* ignore */ }
      start(null, false)
    }, Math.max(ms, 0))
    return () => clearTimeout(timer)
  }, [session, start])

  // Password reset elsewhere (another tab, another device in the real system): sign out here too.
  useEffect(() => {
    if (!session) return
    const check = () => { if (endedByReset(session)) { try { sessionStorage.setItem(RESET_SIGNOUT_KEY, '1') } catch { /* ignore */ } start(null, false) } }
    const onStorage = (e: StorageEvent) => { if (e.key === 'bmis.sessionEpoch') check() }
    window.addEventListener('storage', onStorage)
    const t = window.setInterval(check, 30_000)
    return () => { window.removeEventListener('storage', onStorage); window.clearInterval(t) }
  }, [session, start])

  // Activity keeps the session alive (extended at most once a minute), so working users are never interrupted.
  // The last-extension time and the current session live in refs: listeners are added once per sign-in,
  // not again after every extension. (Before, re-adding them reset the one-minute guard, so every scroll
  // event extended the session, which re-rendered the page, which scrolled again: the page flickered and
  // could not be scrolled.)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const rememberRef = useRef(remember)
  rememberRef.current = remember
  const lastTouch = useRef(Date.now())
  useEffect(() => {
    if (!userId) return
    const touch = () => {
      const now = Date.now()
      const cur = sessionRef.current
      if (!cur || now - lastTouch.current < 60_000) return
      lastTouch.current = now
      start({ ...cur, expiresAt: new Date(now + APP_CONFIG.sessionMinutes * 60_000).toISOString() }, rememberRef.current)
    }
    const events = ['pointerdown', 'keydown', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }))
    return () => events.forEach((e) => window.removeEventListener(e, touch, { capture: true }))
  }, [userId, start])

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
      logout: () => {
        if (user) audit(user, 'Signed out', 'Security')
        // Signing out removes this account's unsent drafts from the device, so the next person cannot see them.
        // (A session that times out keeps them: only this account can open them again after signing in.)
        if (user) clearDraftsFor(user.id)
        start(null, false)
        try {
          // Drop per-session navigation history so Back cannot reopen protected pages.
          for (const k of Object.keys(sessionStorage)) if (k.startsWith('bmis.') && k !== EXPIRED_KEY) sessionStorage.removeItem(k)
        } catch { /* ignore */ }
        window.location.replace(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/portal`)
      },
      passwordChanged: () => session && start({ ...session, mustChangePassword: false }, remember),
      switchTestLevel: (role) => {
        const account = testAccountOf(session?.userId)
        if (!session || !account) return
        start({ ...session, userId: `${account.idPrefix}${role}` }, remember)
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

// Expired drafts are removed whenever the app starts.
purgeExpiredDrafts()
