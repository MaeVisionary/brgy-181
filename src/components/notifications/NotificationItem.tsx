import type { ReactNode } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, ChevronRight, FileText, MessageSquareWarning, Package, Receipt, UserCheck, UserRoundPen } from '@/icons'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import type { AppNotification, NotificationCategory } from '@/types/activity'

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

const REF = /\b(?:REG|KP|BRW|CLR|IND|BUS|CRT|SNG|NRC|COH|INC|SUM|NOH|BLT|RES|FTJ)-\d{4}-\d{3,4}\b/

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

/** Compact card; tap to expand for details and actions (opening it marks it read). */
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
  const reference = n.reference ?? (n.title + ' ' + n.body).match(REF)?.[0]
  const action = actionLabel(n.link)
  const toggle = () => {
    if (!open && !n.read) onRead(n.id)
    setOpen((o) => !o)
  }
  return (
    <div className={cn('rounded-xl border bg-surface transition-shadow', open ? 'border-line shadow-[0_4px_16px_rgba(0,33,50,0.08)]' : 'border-line-soft hover:border-line')}>
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-start gap-3 px-3.5 py-3 text-left">
        <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', n.category === 'overdue' ? 'bg-danger-tint text-danger' : 'bg-sky-100 text-navy-900')}>{ICON[n.category] ?? ICON.system}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn('truncate text-[15px] text-navy-900', n.read ? 'font-semibold' : 'font-bold')}>{n.title}</span>
            <span className="shrink-0 text-[12.5px] text-ink-muted">{shortTime(n.createdAt)}</span>
          </span>
          <span className={cn('block text-[14px] text-ink-nav', !open && 'truncate')}>{n.body}</span>
        </span>
        {!n.read && <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-info" />}
      </button>
      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="border-t border-line-soft px-3.5 pt-2.5 pb-3 pl-[56px]">
            <dl className="space-y-0.5 text-[13.5px]">
              {reference && <div className="flex gap-2"><dt className="text-ink-muted">Reference</dt><dd className="font-semibold text-navy-900">{reference}</dd></div>}
              {n.subject && <div className="flex gap-2"><dt className="text-ink-muted">Regarding</dt><dd className="text-navy-900">{n.subject}</dd></div>}
              <div className="flex gap-2"><dt className="text-ink-muted">Received</dt><dd className="text-navy-900">{formatDateTime(n.createdAt)}</dd></div>
            </dl>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {action && (
                <button
                  type="button"
                  onClick={() => { onOpen?.(); navigate(n.link!) }}
                  className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-control)] bg-navy-900 px-3.5 text-[14px] font-semibold text-white hover:bg-navy-800"
                >
                  {action} <ChevronRight className="size-4" />
                </button>
              )}
              {onDismiss && (
                <button type="button" onClick={() => onDismiss(n.id)} className="inline-flex h-9 items-center rounded-[var(--radius-control)] px-3 text-[14px] font-semibold text-ink-nav hover:bg-surface-muted">
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Shared empty state. */
export function NoNotifications() {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-surface-muted text-ink-muted"><Bell className="size-5" /></span>
      <p className="mt-2 text-[15px] font-semibold text-navy-900">No notifications yet</p>
      <p className="text-[14px] text-ink-muted">You'll see updates here when something needs your attention.</p>
    </div>
  )
}
