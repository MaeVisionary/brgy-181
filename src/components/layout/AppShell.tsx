import { Menu, X } from '@/icons'
import { lazy, Suspense, useEffect, useState } from 'react'
import { APP_CONFIG } from '@/config/app'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { runAppointmentJobs } from '@/services/appointmentService'
import { runBorrowingJobs } from '@/services/equipmentService'
import { runAnnouncementJobs } from '@/services/announcementService'
import { runCalendarJobs } from '@/services/calendarService'
import { useAuth } from '@/auth/useAuth'
import { cn } from '@/lib/cn'
import { formatDate, formatWeekday } from '@/lib/format'
import { BarangaySeal } from './BarangaySeal'
import { NotificationMenu } from './NotificationMenu'
import { TestAccountBar } from './TestAccountBar'
import { isTestUser } from '@/config/testAccount'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { TextSizeControl } from './TextSizeControl'
import { cleanupAbandoned } from '@/services/fileStore'
import { useTrail } from '@/components/ui/BackLink'

/** Development-only; not bundled in production builds. */
const DevPreviewBar = import.meta.env.DEV ? lazy(() => import('./DevPreviewBar').then((m) => ({ default: m.DevPreviewBar }))) : null

const COLLAPSE_KEY = 'bmis.sidebar.collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const { role, user } = useAuth()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [today] = useState(() => new Date())
  const { pathname } = useLocation()
  useTrail()
  // Remove uploads that were never submitted (after the configured period).
  useEffect(() => { cleanupAbandoned().catch(() => undefined) }, [])
  // Automatic jobs (a scheduled server job on Supabase): reminders, no-shows, overdue
  // equipment, scheduled announcements, closure and event notices. Each is idempotent.
  useEffect(() => {
    const run = () => { runAppointmentJobs(); runBorrowingJobs(); runAnnouncementJobs(); runCalendarJobs() }
    run()
    const t = window.setInterval(run, 5 * 60_000)
    return () => window.clearInterval(t)
  }, [])

  // The page scrolls inside <main>. A new page starts at the top; going Back
  // returns to where the user was on that page (content may load a moment later).
  const navType = useNavigationType()
  useEffect(() => {
    const el = document.getElementById('main-scroll')
    if (!el) return
    const key = `bmis.scroll:${pathname}`
    const saved = Number(sessionStorage.getItem(key) ?? 0)
    let frames = 0
    let raf = 0
    const restore = () => {
      el.scrollTo({ top: saved })
      if (el.scrollTop < saved - 2 && frames++ < 60) raf = requestAnimationFrame(restore)
    }
    if (navType === 'POP' && saved > 0) restore()
    else el.scrollTo({ top: 0 })
    const onScroll = () => { try { sessionStorage.setItem(key, String(Math.round(el.scrollTop))) } catch { /* ignore */ } }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { cancelAnimationFrame(raf); el.removeEventListener('scroll', onScroll) }
  }, [pathname, navType])

  const toggle = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setCollapsed((c) => {
        try {
          localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
        } catch {
          /* ignore */
        }
        return !c
      })
    } else {
      setMobileOpen((o) => !o)
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {isTestUser(user?.id) ? <TestAccountBar /> : DevPreviewBar && <Suspense fallback={null}><DevPreviewBar /></Suspense>}

      <header className="relative z-30 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface pr-2 pl-4 sm:gap-3 sm:px-5">
        <button
          type="button"
          onClick={toggle}
          aria-label={mobileOpen ? 'Close menu' : 'Toggle menu'}
          className="hidden size-9 place-items-center md:grid rounded-[var(--radius-control)] text-navy-900 hover:bg-surface-muted"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          <BarangaySeal />
          <div className="min-w-0 leading-tight">
            {/* Header text keeps a fixed size so the brand never gets cut off at large text sizes. */}
            <p className="font-display text-[17px] font-extrabold whitespace-nowrap text-navy-900">{APP_CONFIG.barangayName}</p>
            <p className="hidden truncate text-[13px] text-ink-muted min-[360px]:block">{role?.portalLabel}</p>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
          <div className="mr-2 hidden text-right leading-tight lg:block">
            <p className="text-[length:calc(13px*var(--fs))] text-ink-muted">{formatWeekday(today)}</p>
            <p className="text-[length:calc(15px*var(--fs))] font-semibold text-navy-900">{formatDate(today)}</p>
          </div>
          <TextSizeControl />
          <NotificationMenu />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'hidden h-full shrink-0 border-r border-line transition-[width] lg:block',
            collapsed ? 'w-[68px]' : 'w-[292px]',
          )}
        >
          <Sidebar collapsed={collapsed} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-navy-900/40" onClick={() => setMobileOpen(false)} />
            <aside className="relative flex h-full w-[310px] max-w-[88vw] flex-col border-r border-line bg-surface shadow-xl">
              <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-4">
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="grid size-10 place-items-center rounded-[var(--radius-control)] text-navy-900 hover:bg-surface-muted">
                  <X className="size-5" />
                </button>
                <BarangaySeal />
                <div className="min-w-0 leading-tight">
                  <p className="truncate font-display text-[length:calc(16px*var(--fs))] font-extrabold text-navy-900">{APP_CONFIG.barangayName}</p>
                  <p className="truncate text-[length:calc(13px*var(--fs))] text-ink-muted">{role?.portalLabel}</p>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </div>
            </aside>
          </div>
        )}

        <main id="main-scroll" className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
