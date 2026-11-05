import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { APP_CONFIG } from '@/config/app'
import { cn } from '@/lib/cn'
import { formatDate, formatWeekday } from '@/lib/format'
import { BarangaySeal } from './BarangaySeal'
import { DemoBar } from './DemoBar'
import { NotificationMenu } from './NotificationMenu'
import { Sidebar } from './Sidebar'

const COLLAPSE_KEY = 'bmis.sidebar.collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const { role } = useAuth()
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
      {APP_CONFIG.demoMode && <DemoBar />}

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
          <div className="fixed inset-0 top-16 z-20 lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-navy-900/30" onClick={() => setMobileOpen(false)} />
            <aside className="relative h-full w-[272px] max-w-[85vw] border-r border-line shadow-xl">
              <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
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
