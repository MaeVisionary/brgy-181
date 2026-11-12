import { useAuth } from '@/auth/useAuth'
import { NoNotifications, NotificationItem, groupByDay } from '@/components/notifications/NotificationItem'
import { PageHeader } from '@/components/ui/PageHeader'
import { useNotifications } from '@/hooks/useNotifications'

export function NotificationsPage() {
  const { user } = useAuth()
  const { items, unread, loading, markAllRead, markRead, dismiss } = useNotifications(user?.id)

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader
        title="Notifications"
        actions={unread > 0 && (
          <button type="button" onClick={markAllRead} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-info hover:underline">
            Mark all as read
          </button>
        )}
      />
      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />)}</div>
      ) : items.length === 0 ? (
        <NoNotifications />
      ) : (
        <div className="space-y-5">
          {groupByDay(items).map(([label, list]) => (
            <section key={label}>
              <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-[0.04em] text-ink-muted uppercase">{label}</h2>
              <div className="space-y-2">
                {list.map((n) => <NotificationItem key={n.id} n={n} onRead={markRead} onDismiss={dismiss} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
