import { Bell, ChevronRight } from '@/icons'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { NoNotifications, NotificationItem } from '@/components/notifications/NotificationItem'

export function NotificationMenu() {
  const { user } = useAuth()
  const { items, unread, markAllRead, markRead, dismiss } = useNotifications(user?.id)
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
        className="relative grid size-11 place-items-center rounded-full text-navy-900 hover:bg-surface-muted"
      >
        <Bell className="size-[22px]" strokeWidth={1.75} />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-danger ring-2 ring-surface" />}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(400px,calc(100vw-24px))] overflow-hidden rounded-xl border border-line bg-canvas shadow-[0_12px_32px_rgba(0,33,50,0.14)]">
          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
            <p className="font-display text-[length:calc(16px*var(--fs))] font-bold text-navy-900">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-[length:calc(14px*var(--fs))] font-semibold text-info hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-[440px] space-y-2 overflow-y-auto px-3 pb-3">
            {items.length === 0 ? <NoNotifications /> : items.slice(0, 5).map((n) => <NotificationItem key={n.id} n={n} onRead={markRead} onDismiss={dismiss} onOpen={() => setOpen(false)} />)}
          </div>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1 border-t border-line-soft bg-surface px-4 py-3 text-[length:calc(14.5px*var(--fs))] font-semibold text-info hover:bg-surface-muted"
          >
            View All Notifications <ChevronRight className="size-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
