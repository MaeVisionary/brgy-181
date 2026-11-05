import { useCallback, useEffect, useState } from 'react'
import * as notificationService from '@/services/notificationService'
import type { AppNotification } from '@/types/activity'

/** Shared notification state. Refetches when the signed-in user changes. */
export function useNotifications(userId: string | undefined) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setItems(await notificationService.getNotifications(userId))
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
    window.addEventListener('bmis:notifications-changed', load)
    return () => window.removeEventListener('bmis:notifications-changed', load)
  }, [load])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    await notificationService.markAllRead(userId)
    window.dispatchEvent(new Event('bmis:notifications-changed'))
  }, [userId])

  return { items, loading, unread: items.filter((n) => !n.read).length, markAllRead }
}
