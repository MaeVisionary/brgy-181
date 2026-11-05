import { mockNotifications } from '@/mocks/notifications'
import type { AppNotification } from '@/types/activity'
import { mockRequest } from './mockApi'

/** Only the signed-in account's own notifications are ever returned. */
export function getNotifications(userId: string): Promise<AppNotification[]> {
  return mockRequest(() =>
    mockNotifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )
}

export function markAllRead(userId: string): Promise<void> {
  return mockRequest(() => {
    mockNotifications.forEach((n) => {
      if (n.userId === userId) n.read = true
    })
  })
}
