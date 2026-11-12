import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { DotsThreeCircle } from '@phosphor-icons/react'
import { X } from '@/icons'
import { useAuth } from '@/auth/useAuth'
import { cn } from '@/lib/cn'
import { Sidebar, useVisibleNav } from './Sidebar'

/** Most-used destinations first; the rest live under More. */
const PRIORITY = [
  '/dashboard',
  '/my/transactions',
  '/my/documents',
  '/documents/approvals',
  '/documents',
  '/residents/registrations',
  '/inventory',
  '/borrowing',
  '/cases',
  '/residents',
  '/reports',
  '/analytics',
  '/admin/users',
  '/admin/roles',
  '/admin/activity',
  '/notifications',
]

const SHORT: Record<string, string> = {
  '/dashboard': 'Home',
  '/my/transactions': 'Activity',
  '/my/documents': 'Requests',
  '/documents': 'Requests',
  '/documents/approvals': 'Approvals',
  '/residents/registrations': 'Sign-ups',
  '/residents': 'Residents',
  '/inventory': 'Equipment',
  '/borrowing': 'Borrowing',
  '/cases': 'Cases',
  '/reports': 'Reports',
  '/analytics': 'Analytics',
  '/admin/users': 'Users',
  '/admin/roles': 'Roles',
  '/admin/activity': 'Activity',
  '/notifications': 'Alerts',
}

/** Phone navigation: four destinations the account can open, plus More (a sheet with everything else). */
export function BottomNav() {
  const { user } = useAuth()
  const groups = useVisibleNav()
  const { pathname } = useLocation()
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [pathname])
  if (!user) return null
  const items = PRIORITY.map((p) => groups.find((g) => g.path === p)).filter((g): g is NonNullable<typeof g> => !!g).slice(0, 4)
  const active = (p: string) => pathname === p || (p !== '/dashboard' && pathname.startsWith(p + '/') && !items.some((o) => o.path !== p && o.path!.startsWith(p + '/') && pathname.startsWith(o.path!)))

  return (
    <>
      <nav aria-label="Main" className="shrink-0 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {items.map((g) => {
            const Icon = g.icon
            const on = active(g.path!)
            return (
              <li key={g.path}>
                <NavLink to={g.path!} end={g.path === '/dashboard'} aria-current={on ? 'page' : undefined} className={cn('flex min-h-[56px] flex-col items-center justify-start gap-0.5 pt-2 pb-1 text-[length:calc(11.5px*var(--fs))] font-semibold', on ? 'text-navy-900' : 'text-ink-muted')}>
                  <Icon className={cn('size-[22px] shrink-0', on && 'text-info')} />
                  <span className="line-clamp-2 max-w-full px-1 text-center leading-tight">{SHORT[g.path!] ?? g.label}</span>
                </NavLink>
              </li>
            )
          })}
          <li>
            <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={cn('flex min-h-[56px] w-full flex-col items-center justify-start gap-0.5 pt-2 pb-1 text-[length:calc(11.5px*var(--fs))] font-semibold', more ? 'text-navy-900' : 'text-ink-muted')}>
              <DotsThreeCircle className="size-[22px] shrink-0" weight="duotone" />
              <span className="line-clamp-2 max-w-full px-1 text-center leading-tight">More</span>
            </button>
          </li>
        </ul>
      </nav>

      {more && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-navy-900/35" onClick={() => setMore(false)} />
          <div className="relative flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-xl">
            <div className="relative flex items-center justify-end px-4 pt-3 pb-1">
              <span aria-hidden className="absolute top-3 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-line" />
              <button type="button" onClick={() => setMore(false)} aria-label="Close" className="grid size-10 place-items-center rounded-full text-ink-nav hover:bg-surface-muted"><X className="size-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Sidebar collapsed={false} onNavigate={() => setMore(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
