import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import * as notificationService from '@/services/notificationService'
import type { AppNotification } from '@/types/activity'
import type { Permission } from '@/types/auth'

/** Shared notification state for the signed-in account. Refetches when the account changes. */
export function useNotifications(userId: string | undefined) {
  const { user } = useAuth()
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId || !user) return
    // Only the first load shows the placeholder; refreshes keep the list (and any open card) in place.
    const perms = new Set<Permission>([...ROLE_PERMISSIONS[user.roleId], ...(user.extraPermissions ?? [])])
    setItems(await notificationService.getNotifications(userId, perms))
    setLoading(false)
  }, [userId, user])

  useEffect(() => {
    load()
    window.addEventListener('bmis:notifications-changed', load)
    return () => window.removeEventListener('bmis:notifications-changed', load)
  }, [load])

  const refresh = () => window.dispatchEvent(new Event('bmis:notifications-changed'))

  const markAllRead = useCallback(async () => {
    if (!userId) return
    await notificationService.markAllRead(userId, items.map((n) => n.id))
    refresh()
  }, [userId, items])

  const markRead = useCallback(async (id: string) => {
    if (!userId) return
    await notificationService.markRead(userId, id)
    refresh()
  }, [userId])

  const dismiss = useCallback(async (id: string) => {
    if (!userId) return
    await notificationService.dismiss(userId, id)
    refresh()
  }, [userId])

  return { items, loading, unread: items.filter((n) => !n.read).length, markAllRead, markRead, dismiss }
}
