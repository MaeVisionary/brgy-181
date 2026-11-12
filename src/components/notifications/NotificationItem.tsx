import type { ReactNode } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, FileText, MessageSquareWarning, Package, Receipt, UserCheck, UserRoundPen, X } from '@/icons'
import { TONE as T } from '@/icons/tones'
import { cn } from '@/lib/cn'
import type { AppNotification, NotificationCategory } from '@/types/activity'

const TONE: Record<NotificationCategory, string> = {
  registration: T.green,
  resident_change: T.blue,
  document: T.blue,
  approval: T.green,
  payment: T.teal,
  complaint: T.orange,
  hearing: T.indigo,
  borrowing: T.orange,
  overdue: T.red,
  system: T.gray,
}

const ICON: Record<NotificationCategory, ReactNode> = {
  registration: <UserCheck className="size-4" />,
  resident_change: <UserRoundPen className="size-4" />,
  document: <FileText className="size-4" />,
  approval: <CheckCircle2 className="size-4" />,
  payment: <Receipt className="size-4" />,
  complaint: <MessageSquareWarning className="size-4" />,
  hearing: <CalendarClock className="size-4" />,
  borrowing: <Package className="size-4" />,
  overdue: <AlertTriangle className="size-4" />,
  system: <Bell className="size-4" />,
}

function actionLabel(link?: string) {
  if (!link) return null
  if (link.startsWith('/documents/approvals')) return 'Review Approvals'
  if (link.startsWith('/documents/') || link.startsWith('/my/documents')) return 'View Request'
  if (link.startsWith('/cases/') || link.startsWith('/my/complaints')) return 'Open Case'
  if (link.startsWith('/borrowing/') || link.startsWith('/my/borrowing')) return 'View Borrowing'
  if (link.startsWith('/residents/registrations')) return 'Review Registration'
  if (link.startsWith('/residents/change-requests')) return 'Review Request'
  if (link.startsWith('/reports')) return 'Open Reports'
  return 'Open Record'
}

/** "11:00 AM" today, "Yesterday", otherwise "Nov 5". */
function shortTime(iso: string) {
  const d = new Date(iso)
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (day(d) === day(today)) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
  if (day(d) === day(yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
}

/** Today / Yesterday / Earlier. */
export function groupByDay(items: AppNotification[]): [string, AppNotification[]][] {
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const today = day(new Date())
  const yesterday = day(new Date(Date.now() - 86_400_000))
  const groups: Record<string, AppNotification[]> = { Today: [], Yesterday: [], Earlier: [] }
  for (const n of items) {
    const d = day(new Date(n.createdAt))
    groups[d === today ? 'Today' : d === yesterday ? 'Yesterday' : 'Earlier'].push(n)
  }
  return Object.entries(groups).filter(([, list]) => list.length > 0)
}

/** Compact card: tap opens the related page (and marks it read); x dismisses. */
export function NotificationItem({
  n,
  onRead,
  onDismiss,
  onOpen,
}: {
  n: AppNotification
  onRead: (id: string) => void
  onDismiss?: (id: string) => void
  onOpen?: () => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const activate = () => {
    if (!n.read) onRead(n.id)
    if (n.link) { onOpen?.(); navigate(n.link) }
    else setOpen((o) => !o)
  }
  return (
    <div className="group relative rounded-xl bg-surface shadow-[0_1px_2px_rgba(0,33,50,0.06)] ring-1 ring-line-soft transition hover:ring-line">
      <button type="button" onClick={activate} aria-label={actionLabel(n.link) ? `${n.title}. ${actionLabel(n.link)}` : n.title} className="flex w-full items-start gap-3 px-3.5 py-3 pr-10 text-left">
        <span className={cn('relative mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px]', TONE[n.category] ?? TONE.system)}>
          {ICON[n.category] ?? ICON.system}
          {!n.read && <span aria-label="Unread" className="absolute -top-1 -left-1 size-2.5 rounded-full bg-info ring-2 ring-surface" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={cn('min-w-0 truncate text-[length:calc(15px*var(--fs))] text-navy-900', n.read ? 'font-semibold' : 'font-bold')}>{n.title}</span>
            <span className="shrink-0 text-[length:calc(12.5px*var(--fs))] text-ink-muted">{shortTime(n.createdAt)}</span>
          </span>
          <span className={cn('block text-[length:calc(14px*var(--fs))] text-ink-nav', !open && 'truncate')}>{n.body}</span>
        </span>
      </button>
      {onDismiss && (
        <button type="button" onClick={() => onDismiss(n.id)} aria-label={`Dismiss ${n.title}`} title="Dismiss" className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-muted opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:bg-surface-muted hover:text-navy-900 [@media(hover:none)]:opacity-100">
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

/** Shared empty state. */
export function NoNotifications() {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-surface-muted text-ink-muted"><Bell className="size-5" /></span>
      <p className="mt-2 text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">No notifications yet</p>
      <p className="text-[length:calc(14px*var(--fs))] text-ink-muted">You'll see updates here when something needs your attention.</p>
    </div>
  )
}
