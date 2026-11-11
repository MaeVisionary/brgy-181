import { Bell, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'

export function NotificationMenu() {
  const { user } = useAuth()
  const { items, unread, markAllRead } = useNotifications(user?.id)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        className="relative grid size-9 place-items-center rounded-[var(--radius-control)] border border-line bg-surface text-navy-900 hover:bg-surface-muted"
      >
        <Bell className="size-[18px]" strokeWidth={1.75} />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-danger ring-2 ring-surface" />}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-xl border border-line bg-surface shadow-[0_8px_24px_rgba(0,33,50,0.10)]">
          <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
            <p className="font-display text-[16px] font-bold text-navy-900">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-[14px] font-semibold text-info hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-[360px] overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-5">
                <p className="text-[15px] font-semibold text-navy-900">No notifications yet</p>
                <p className="text-[14.5px] text-ink-muted">You\u2019ll see updates here when something needs your attention.</p>
              </li>
            )}
            {items.slice(0, 6).map((n) => (
              <li key={n.id} className="border-b border-line-soft last:border-0">
                <Link
                  to={n.link ?? '/notifications'}
                  onClick={() => setOpen(false)}
                  className={cn('flex gap-3 px-4 py-3 hover:bg-sky-50', !n.read && 'bg-sky-50/60')}
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-info')} />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-navy-900">{n.title}</span>
                    <span className="block text-[14px] text-ink-muted">{n.body}</span>
                    <span className="mt-1 block text-[13px] text-ink-subtle">{formatRelative(n.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 border-t border-line-soft px-4 py-3 text-[14.5px] font-semibold text-info hover:bg-surface-muted"
          >
            View All Notifications <ChevronRight className="size-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
