import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Panel'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'

export function NotificationsPage() {
  const { user } = useAuth()
  const { items, unread, loading, markAllRead } = useNotifications(user?.id)

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Updates about your requests and the work assigned to you."
        actions={unread > 0 && <Button variant="secondary" onClick={markAllRead}>Mark all as read</Button>}
      />
      <Card>
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-surface-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Bell className="size-5" />} title="No notifications yet" body="You'll see updates here when something needs your attention." />
        ) : (
          <ul>
            {items.map((n) => {
              const inner = (
                <>
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-line' : 'bg-info')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-navy-900">{n.title}</span>
                    <span className="block text-[13px] text-ink-muted">{n.body}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-ink-subtle">{formatDateTime(n.createdAt)}</span>
                </>
              )
              const cls = cn('flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:gap-3', !n.read && 'bg-sky-50/60')
              return (
                <li key={n.id} className="border-b border-line-soft last:border-0">
                  {n.link ? (
                    <Link to={n.link} className={cn(cls, 'hover:bg-sky-50')}>
                      {inner}
                    </Link>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}
