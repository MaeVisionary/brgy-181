import { Menu, X } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { APP_CONFIG } from '@/config/app'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { cn } from '@/lib/cn'
import { formatDate, formatWeekday } from '@/lib/format'
import { BarangaySeal } from './BarangaySeal'
import { NotificationMenu } from './NotificationMenu'
import { TestAccountBar } from './TestAccountBar'
import { isTestUser } from '@/config/testAccount'
import { Sidebar } from './Sidebar'

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
    <div className="flex min-h-full flex-col">
      {isTestUser(user?.id) ? <TestAccountBar /> : DevPreviewBar && <Suspense fallback={null}><DevPreviewBar /></Suspense>}

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface px-4 sm:px-5">
        <button
          type="button"
          onClick={toggle}
          aria-label={mobileOpen ? 'Close menu' : 'Toggle menu'}
          className="grid size-9 place-items-center rounded-[var(--radius-control)] text-navy-900 hover:bg-surface-muted"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <div className="flex min-w-0 items-center gap-2.5">
          <BarangaySeal />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-[14px] font-extrabold text-navy-900">{APP_CONFIG.barangayName}</p>
            <p className="truncate text-[11px] text-ink-muted">{role?.portalLabel}</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-[11px] text-ink-muted">{formatWeekday(today)}</p>
            <p className="text-[13px] font-semibold text-navy-900">{formatDate(today)}</p>
          </div>
          <NotificationMenu />
        </div>
      </header>

      <div className="relative flex flex-1">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 border-r border-line transition-[width] lg:block',
            collapsed ? 'w-[68px]' : 'w-[248px]',
          )}
        >
          <Sidebar collapsed={collapsed} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-navy-900/40" onClick={() => setMobileOpen(false)} />
            <aside className="relative flex h-full w-[288px] max-w-[85vw] flex-col border-r border-line bg-surface shadow-xl">
              <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-4">
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="grid size-10 place-items-center rounded-[var(--radius-control)] text-navy-900 hover:bg-surface-muted">
                  <X className="size-5" />
                </button>
                <BarangaySeal />
                <div className="min-w-0 leading-tight">
                  <p className="truncate font-display text-[14px] font-extrabold text-navy-900">{APP_CONFIG.barangayName}</p>
                  <p className="truncate text-[11px] text-ink-muted">{role?.portalLabel}</p>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </div>
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          <div className="mx-auto max-w-[1180px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
