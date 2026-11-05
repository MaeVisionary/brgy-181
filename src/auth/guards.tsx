import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Permission, Portal } from '@/types/auth'
import { AccessDenied } from '@/pages/system/AccessDenied'
import { useAuth } from './useAuth'

/** Redirects to the login page when nobody is signed in. */
export function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
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
