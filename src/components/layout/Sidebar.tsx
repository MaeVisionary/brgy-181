import { ChevronRight, LogOut } from '@/icons'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { NAVIGATION, type NavGroup, type NavLeaf } from '@/config/navigation'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

const itemBase =
  'flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-[16px] leading-[1.3] font-medium transition-colors'

function useVisibleNav(): NavGroup[] {
  const { role, canAny } = useAuth()
  if (!role) return []
  const visible = (item: { anyOf?: NavLeaf['anyOf'] }) => !item.anyOf || canAny(item.anyOf)
  return NAVIGATION[role.portal]
    .map((g) => (g.children ? { ...g, children: g.children.filter(visible) } : g))
    .filter((g) => (g.children ? g.children.length > 0 : visible(g)))
}

export function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { user, role, logout } = useAuth()
  const groups = useVisibleNav()
  if (!user || !role) return null
  return <FlatNav groups={groups} collapsed={collapsed} onNavigate={onNavigate} user={user} logout={logout} foldable={role.id === 'secretary'} />
}

/**
 * Menus for every portal (Figma v2/v3): flat groups that are always open,
 * section labels in caps, active page highlighted. A child route (e.g. a request
 * detail) keeps its parent item highlighted.
 */
function FlatNav({
  groups,
  collapsed,
  onNavigate,
  user,
  logout,
  foldable,
}: {
  groups: NavGroup[]
  collapsed: boolean
  onNavigate?: () => void
  user: { fullName: string; position: string }
  logout: () => void
  /** Sections can be folded (Secretary: the longest menu). */
  foldable?: boolean
}) {
  const { pathname } = useLocation()
  const [folded, setFolded] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('bmis.nav.folded') ?? '{}') as Record<string, boolean>
    } catch {
      return {}
    }
  })
  const toggleSection = (label: string) =>
    setFolded((f) => {
      const next = { ...f, [label]: !f[label] }
      try {
        localStorage.setItem('bmis.nav.folded', JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  // Longest matching path wins, so /my/documents/new keeps "Document Requests" active.
  // A transaction's details page belongs to My Transactions (Figma v2), whichever list it came from.
  const isDetails = /^\/my\/(documents|complaints|borrowing)\/(?!new$)[^/]+$/.test(pathname) && groups.some((g) => g.path === '/my/transactions')
  const activePath = isDetails ? '/my/transactions' : groups
    .map((g) => g.path!)
    .filter((p) => pathname === p || (p !== '/dashboard' && pathname.startsWith(p + '/')))
    .sort((a, b) => b.length - a.length)[0]
  const sections: { label?: string; items: NavGroup[] }[] = []
  for (const g of groups) {
    const last = sections[sections.length - 1]
    if (last && last.label === g.section) last.items.push(g)
    else sections.push({ label: g.section, items: [g] })
  }
  return (
    <nav aria-label="Main" className="flex h-full flex-col bg-surface">
      <div className={cn('flex-1 overflow-y-auto pt-4', collapsed ? 'px-2' : 'px-3')}>
        {sections.map((sec, i) => (
          <div key={sec.label ?? i} className={i > 0 ? 'mt-4' : undefined}>
            {sec.label && !collapsed && (foldable ? (
              <button
                type="button"
                onClick={() => toggleSection(sec.label!)}
                aria-expanded={!folded[sec.label] || sec.items.some((g) => g.path === activePath)}
                className="mb-1 flex w-full items-center justify-between gap-2 rounded-md px-3 py-1 text-left text-[12.5px] leading-snug font-semibold tracking-[0.08em] text-ink-muted uppercase hover:text-navy-900"
              >
                <span className="min-w-0">{sec.label}</span>
                <ChevronRight className={cn('size-3.5 shrink-0 transition-transform', (!folded[sec.label] || sec.items.some((g) => g.path === activePath)) && 'rotate-90')} />
              </button>
            ) : (
              <p className="mb-1 px-3 text-[12.5px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{sec.label}</p>
            ))}
            {sec.label && collapsed && i > 0 && <hr className="mx-2 mb-2 border-line-soft" />}
            {!(foldable && !collapsed && sec.label && folded[sec.label] && !sec.items.some((g) => g.path === activePath)) && (
            <ul className="space-y-0.5">
              {sec.items.map((g) => {
                const Icon = g.icon
                const active = g.path === activePath
                return (
                  <li key={g.path}>
                    <NavLink
                      to={g.path!}
                      end
                      onClick={onNavigate}
                      title={collapsed ? g.label : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        itemBase,
                        'min-h-10',
                        collapsed && 'justify-center px-0',
                        active ? 'bg-sky-100 font-semibold text-navy-900' : 'text-ink-nav hover:bg-surface-muted hover:text-navy-900',
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
                      {!collapsed && <span className="min-w-0 leading-snug">{g.label}</span>}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
            )}
          </div>
        ))}
      </div>
      <div className={cn('p-3', collapsed && 'px-2')}>
        <div className={cn('flex items-center gap-3 rounded-md bg-surface-muted p-2.5', collapsed && 'justify-center p-1.5')}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-900 text-[13px] font-semibold text-white">{initials(user.fullName)}</span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-navy-900">{user.fullName}</span>
                <span className="block truncate text-[13px] text-ink-muted">{user.position}</span>
              </span>
              <button type="button" onClick={logout} aria-label="Sign out" title="Sign out" className="grid size-9 place-items-center rounded-md text-ink-nav hover:bg-surface hover:text-navy-900">
                <LogOut className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
