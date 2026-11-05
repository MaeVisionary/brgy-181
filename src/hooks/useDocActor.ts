import { useMemo } from 'react'
import { useAuth } from '@/auth/useAuth'
import type { DocActor } from '@/services/documentService'

/** The signed-in user in the shape the document service expects. */
export function useDocActor(): DocActor | null {
  const { user, permissions } = useAuth()
  return useMemo(() => (user ? { user, permissions } : null), [user, permissions])
}
