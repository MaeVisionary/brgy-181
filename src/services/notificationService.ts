import { DEMO_NOTIFICATIONS } from '@/mocks/demoNotifications'
import { mockDocumentRequests } from '@/mocks/documentRequests'
import { mockNotifications } from '@/mocks/notifications'
import type { AppNotification } from '@/types/activity'
import type { Permission } from '@/types/auth'
import { mockRequest } from './mockApi'

const DEMO_READ_KEY = 'bmis.demoNotificationsRead'
const DISMISSED_KEY = 'bmis.notificationsDismissed'

function dismissed(userId: string): Set<string> {
  try {
    return new Set((JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '{}')[userId] ?? []) as string[])
  } catch {
    return new Set()
  }
}

function demoRead(userId: string): Set<string> {
  try {
    return new Set((JSON.parse(localStorage.getItem(DEMO_READ_KEY) ?? '{}')[userId] ?? []) as string[])
  } catch {
    return new Set()
  }
}
function saveDemoRead(userId: string, ids: Set<string>) {
  try {
    const all = JSON.parse(localStorage.getItem(DEMO_READ_KEY) ?? '{}')
    all[userId] = [...ids]
    localStorage.setItem(DEMO_READ_KEY, JSON.stringify(all))
  } catch {
    /* storage unavailable */
  }
}

/**
 * The signed-in account's notifications, newest first. Real notifications
 * always win; demo notifications appear only when there are none, and only
 * those the account's permissions allow.
 */
export function getNotifications(userId: string, permissions: ReadonlySet<Permission>): Promise<AppNotification[]> {
  return mockRequest(() => {
    const own = mockNotifications.filter((n) => n.userId === userId)
    // Seeded sample notifications have fixed ids (ntf-001…); ones created by real actions do not.
    const hasActivity = own.some((n) => !/^ntf-\d{3}$/.test(n.id))
    const sorted = (list: AppNotification[]) => list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const hidden = dismissed(userId)
    const visible = own.filter((n) => !hidden.has(n.id))
    // Preview notifications only while developing; never on the live site.
    if (hasActivity || !import.meta.env.DEV) return sorted(visible)
    const read = demoRead(userId)
    const demo = DEMO_NOTIFICATIONS.filter((d) => permissions.has(d.permission) && !hidden.has(d.id))
      .map((d) => {
        const doc = d.documentRef ? mockDocumentRequests.find((r) => r.referenceNo === d.documentRef) : undefined
        return {
          id: d.id,
          userId,
          category: d.category,
          title: d.title,
          body: d.body,
          createdAt: d.createdAt,
          read: read.has(d.id),
          link: doc ? `/documents/${doc.id}` : d.link ?? (d.documentRef ? '/documents' : undefined),
          demo: true,
          priority: d.priority,
          reference: d.reference,
          subject: d.subject,
        }
      })
    // Avoid two entries about the same record (e.g. a seeded and a demo overdue notice).
    const seen = new Set(own.map((n) => n.link))
    return sorted([...visible, ...demo.filter((d) => !d.link || !seen.has(d.link))])
  })
}

export function markRead(userId: string, id: string): Promise<void> {
  return mockRequest(() => {
    const real = mockNotifications.find((n) => n.id === id && n.userId === userId)
    if (real) {
      real.read = true
      return
    }
    const read = demoRead(userId)
    read.add(id)
    saveDemoRead(userId, read)
  })
}

export function markAllRead(userId: string, ids: string[]): Promise<void> {
  return mockRequest(() => {
    mockNotifications.forEach((n) => {
      if (n.userId === userId) n.read = true
    })
    const read = demoRead(userId)
    ids.filter((id) => id.startsWith('demo-')).forEach((id) => read.add(id))
    saveDemoRead(userId, read)
  })
}

/** Hides a notification from the list; the record itself is kept. */
export function dismiss(userId: string, id: string): Promise<void> {
  return mockRequest(() => {
    try {
      const all = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '{}')
      all[userId] = [...new Set([...(all[userId] ?? []), id])]
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(all))
    } catch {
      /* storage unavailable */
    }
  })
}
