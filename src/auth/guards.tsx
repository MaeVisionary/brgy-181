import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Permission, Portal } from '@/types/auth'
import { AccessDenied } from '@/pages/system/AccessDenied'
import { useAuth } from './useAuth'

/** Redirects to the portal when nobody is signed in; forces a new password after a reset. */
export function RequireAuth() {
  const { user, mustChangePassword } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/portal" replace state={{ from: location.pathname }} />
  if (mustChangePassword && location.pathname !== '/account') return <Navigate to="/account" replace />
  return <Outlet />
}

/**
 * Blocks a route unless the signed-in user has at least one of the permissions
 * (and, if given, uses the right portal). Typing the URL directly does not bypass it.
 */
export function RequirePermission({
  anyOf,
  portal,
  children,
}: {
  anyOf?: readonly Permission[]
  portal?: Portal
  children: ReactNode
}) {
  const { canAny, role } = useAuth()
  const portalOk = !portal || role?.portal === portal
  const permOk = !anyOf || anyOf.length === 0 || canAny(anyOf)
  if (!portalOk || !permOk) return <AccessDenied />
  return <>{children}</>
}
